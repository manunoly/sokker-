import { getPlayerHistory } from '../core/storageClient';
import { fetchTodayInfo, type TodayInfo } from '../core/apiClient';
import { computeSkillChanges, type SkillChange } from '../core/skillChanges';
import { PLAYER_SKILL_COLUMNS, type PlayerSkill } from '../core/playerTimeline';
import { mapSkillLabelToKey } from './i18n';
import { contextFromPath, resolvePageContext, type PageContext } from './pageContext';
import { scanBetaPlayers } from './betaPlayerPage';
import { bindPlayerAnchors, isPlayerAnchorActive, type PlayerAnchors } from './playerBindings';

const skills = new Set<string>(PLAYER_SKILL_COLUMNS.flat());
let renderGeneration = 0;
interface HighlightIdentity { playerId: number; skill: PlayerSkill }
interface HighlightSnapshot extends HighlightIdentity {
    color: string;
    colorPriority: string;
    weight: string;
    weightPriority: string;
    title: string | null;
    appliedColor: string;
    appliedTitle: string;
}
const changeColors = { up: 'rgb(40, 167, 69)', down: 'rgb(220, 53, 69)' };
const highlighted = new Map<HTMLElement, HighlightSnapshot>();
function hasAppliedStyle(value: HTMLElement, property: 'color' | 'font-weight', expected: string): boolean {
    return value.style.getPropertyValue(property) === expected && !value.style.getPropertyPriority(property);
}
function restoreHighlight(value: HTMLElement): void {
    const original = highlighted.get(value);
    if (!original) return;
    value.removeAttribute('data-sokkerpp-skill-change');
    // A native render may already have replaced our declarations and title.
    if (hasAppliedStyle(value, 'color', original.appliedColor)) {
        value.style.setProperty('color', original.color, original.colorPriority);
    }
    if (hasAppliedStyle(value, 'font-weight', 'bold')) {
        value.style.setProperty('font-weight', original.weight, original.weightPriority);
    }
    if (value.getAttribute('title') === original.appliedTitle) {
        if (original.title === null) value.removeAttribute('title');
        else value.setAttribute('title', original.title);
    }
    highlighted.delete(value);
}
function clearHighlights(retain?: ReadonlyMap<HTMLElement, HighlightIdentity>): void {
    for (const [value, original] of highlighted) {
        const current = retain?.get(value);
        if (current?.playerId === original.playerId && current.skill === original.skill) continue;
        restoreHighlight(value);
    }
}

function clearProgressHighlights(root: Document): void {
    clearHighlights();
    root.getElementById('sokkerpp-skill-colors')?.remove();
    // Cloned or restored DOM can retain our styles without a snapshot in this instance.
    root.querySelectorAll<HTMLElement>('[data-sokkerpp-skill-change]').forEach(value => {
        const direction = value.dataset.sokkerppSkillChange;
        value.removeAttribute('data-sokkerpp-skill-change');
        if (direction !== 'up' && direction !== 'down') return;
        if (hasAppliedStyle(value, 'color', changeColors[direction])) {
            value.style.removeProperty('color');
        }
        if (hasAppliedStyle(value, 'font-weight', 'bold')) {
            value.style.removeProperty('font-weight');
        }
        if (/^Previous: \d+(?:\.\d+)?$/.test(value.title)) value.removeAttribute('title');
    });
    root.querySelectorAll('.skill-arrow, [data-sokkerpp-owned="change"]').forEach(node => node.remove());
}
function highlightTargets(target: PlayerAnchors['skills'][number]): HTMLElement[] {
    const { anchor } = target;
    const value = target.getValue ? target.getValue()
        : anchor.dataset.sokkerppValue === 'true' ? anchor : anchor.querySelector<HTMLElement>('.skillNameNumber');
    return [target.getLabel?.(), value, target.getLevelText?.()].filter((node): node is HTMLElement => !!node);
}
function ensureHighlightStyles(): void {
    if (document.getElementById('sokkerpp-skill-colors')) return;
    const style = document.createElement('style');
    style.id = 'sokkerpp-skill-colors';
    style.dataset.sokkerppOwned = 'skill-colors';
    style.textContent = `[data-sokkerpp-skill-change="up"]{color:${changeColors.up}!important;font-weight:bold!important}`
        + `[data-sokkerpp-skill-change="down"]{color:${changeColors.down}!important;font-weight:bold!important}`;
    document.head.append(style);
}
function legacyPlayerLink(link: HTMLAnchorElement): number | null {
    let context: PageContext | null;
    try { context = resolvePageContext(new URL(link.getAttribute('href') ?? '', 'https://sokker.org')); }
    catch { return null; }
    return context?.kind === 'player' && context.layout === 'legacy' ? context.playerId : null;
}

function legacyNames(root: HTMLElement): Array<{ playerId: number; name: HTMLAnchorElement }> {
    return [...root.querySelectorAll<HTMLAnchorElement>('a[href*="/player/"]')]
        .map(name => ({ name, playerId: legacyPlayerLink(name) }))
        .filter((item): item is { playerId: number; name: HTMLAnchorElement } => item.playerId !== null);
}

function legacyLabel(element: HTMLElement): PlayerSkill | null {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-sokkerpp-owned], .skill-arrow').forEach(node => node.remove());
    const key = mapSkillLabelToKey(clone.textContent?.trim() ?? '');
    return key && skills.has(key) ? key as PlayerSkill : null;
}

function markLegacy(players: PlayerAnchors[]): void {
    for (const player of players) {
        for (const name of player.names) name.dataset.sokkerppLayout = 'legacy';
        for (const { anchor } of player.skills) anchor.dataset.sokkerppLayout = 'legacy';
    }
}

function showChange(target: PlayerAnchors['skills'][number], playerId: number, change: SkillChange | undefined): void {
    const { anchor, key: skill } = target;
    anchor.querySelectorAll('[data-sokkerpp-owned="change"], .skill-arrow').forEach(node => node.remove());
    const curr = change?.current;
    const prev = change?.previous;
    const changed = typeof curr === 'number' && typeof prev === 'number' && curr !== prev;
    const values = highlightTargets(target);
    if (changed && values.length) ensureHighlightStyles();
    for (const value of values) {
        if (changed) {
            const original = highlighted.get(value) ?? {
                playerId, skill, color: value.style.color, colorPriority: value.style.getPropertyPriority('color'),
                weight: value.style.fontWeight, weightPriority: value.style.getPropertyPriority('font-weight'),
                title: value.getAttribute('title'), appliedColor: '', appliedTitle: '',
            };
            // Keep the latest native baseline through ordinary rescans before navigation.
            if (!hasAppliedStyle(value, 'color', original.appliedColor)) {
                original.color = value.style.color;
                original.colorPriority = value.style.getPropertyPriority('color');
            }
            if (!hasAppliedStyle(value, 'font-weight', 'bold')) {
                original.weight = value.style.fontWeight;
                original.weightPriority = value.style.getPropertyPriority('font-weight');
            }
            if (value.getAttribute('title') !== original.appliedTitle) original.title = value.getAttribute('title');
            const direction = curr > prev ? 'up' : 'down';
            value.dataset.sokkerppSkillChange = direction;
            value.style.setProperty('color', changeColors[direction]);
            value.style.setProperty('font-weight', 'bold');
            value.title = `Previous: ${prev}`;
            original.appliedColor = value.style.color;
            original.appliedTitle = value.title;
            highlighted.set(value, original);
        } else restoreHighlight(value);
    }
}

async function renderPlayers(players: PlayerAnchors[], pathname: string, root: Document = document): Promise<void> {
    const generation = ++renderGeneration;
    bindPlayerAnchors(players);
    // Progress already has native change colors; keep only our history/chart bindings.
    if (contextFromPath(pathname)?.kind === 'training-progress') {
        clearProgressHighlights(root);
        return;
    }
    // Keep valid colors while reads are pending, restoring reused or removed values immediately.
    const retained = new Map<HTMLElement, HighlightIdentity>();
    for (const player of players) {
        for (const target of player.skills) {
            if (!isPlayerAnchorActive(target.anchor, player.playerId)) continue;
            for (const value of highlightTargets(target)) {
                retained.set(value, { playerId: player.playerId, skill: target.key });
            }
        }
    }
    clearHighlights(retained);
    if (!players.length) return;
    let today: TodayInfo | undefined;
    try { today = await fetchTodayInfo(); }
    catch (error) { console.warn('Could not read current comparison week:', error); }
    if (generation !== renderGeneration || location.pathname !== pathname) return;
    // Share each read across every table/card anchor for this player in the scan.
    const reads = new Map<number, ReturnType<typeof getPlayerHistory>>();
    for (const player of players) if (!reads.has(player.playerId)) reads.set(player.playerId, getPlayerHistory(player.playerId));
    await Promise.all(players.map(async player => {
        const saved = await reads.get(player.playerId)!;
        if (generation !== renderGeneration || location.pathname !== pathname) return;
        const changes = computeSkillChanges(saved?.history ?? [], today);
        for (const target of player.skills) {
            if (isPlayerAnchorActive(target.anchor, player.playerId)) showChange(target, player.playerId, changes[target.key]);
        }
    }));
}

/** Legacy cards use semantic labels and the shared observed-week comparison. */
export async function processSquadTable(container: HTMLElement): Promise<void> {
    const players: PlayerAnchors[] = [];
    for (const box of container.querySelectorAll<HTMLElement>('.player-box, .player-box--sm')) {
        const linked = legacyNames(box);
        const ids = new Set(linked.map(item => item.playerId));
        if (ids.size !== 1) continue;
        const player: PlayerAnchors = { playerId: linked[0].playerId, names: linked.map(item => item.name), skills: [] };
        for (const item of box.querySelectorAll<HTMLElement>('.skill-list__item, .skill-list-item')) {
            const label = item.querySelector<HTMLElement>('.skillLabel, .text-overflow, .headline, .skill-list__desc, .skill-list-desc, .skill-list-desc--t1');
            const key = label ? legacyLabel(label) : null;
            if (!key) continue;
            player.skills.push({ key, anchor: label! });
            const values = [...item.querySelectorAll<HTMLElement>('.skill-list__value, .skill-list__level-desc')];
            const description = [...item.children].find(child => child !== label && !values.includes(child as HTMLElement) && child.textContent?.includes('(') && child.textContent.includes(')')) as HTMLElement | undefined;
            if (description) values.push(description);
            for (const value of values) {
                value.dataset.clickable = 'true';
                value.dataset.sokkerppValue = 'true';
                player.skills.push({ key, anchor: value });
            }
        }
        players.push(player);
    }
    markLegacy(players);
    await renderPlayers(players, location.pathname);
}

/** Classic profile markup can appear on either classic or beta player routes. */
export async function processPlayerPage(container: HTMLElement): Promise<void> {
    const context = contextFromPath(location.pathname);
    if (context?.kind !== 'player') return;
    const player: PlayerAnchors = { playerId: context.playerId, names: [], skills: [] };
    const header = container.querySelector<HTMLElement>('.h5.title-block-1 a[href*="/player/"]');
    if (header) player.names.push(header);
    const navbar = document.querySelector<HTMLElement>('.navbar-brand');
    if (navbar) player.names.push(navbar);
    for (const cell of container.querySelectorAll<HTMLElement>('.table-skills td')) {
        const clone = cell.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('strong, .strong, [data-sokkerpp-owned], .skill-arrow').forEach(node => node.remove());
        const key = legacyLabel(clone);
        if (!key) continue;
        cell.dataset.clickable = 'true';
        player.skills.push({ key, anchor: cell, getLevelText: () => cell.querySelector<HTMLElement>('strong, .strong') });
    }
    markLegacy([player]);
    await renderPlayers([player], context.pathname);
}

export async function processBetaPlayers(context: PageContext, root: Document = document): Promise<void> {
    if (context.pathname !== location.pathname) return;
    const players = scanBetaPlayers(context, root);
    // A SPA can retain nodes and our attributes while switching between layouts.
    for (const player of players) {
        for (const anchor of [...player.names, ...player.skills.map(skill => skill.anchor)]) {
            delete anchor.dataset.sokkerppLayout;
            delete anchor.dataset.clickable;
            delete anchor.dataset.sokkerppValue;
        }
    }
    await renderPlayers(players, context.pathname, root);
}


/** Cancel pending reads; ordinary revisions can retain indicators until fresh data arrives. */
export function invalidatePlayerCache(options: { preserveIndicators?: boolean } = {}): void {
    ++renderGeneration;
    if (options.preserveIndicators) return;
    clearHighlights();
    document.querySelectorAll('[data-sokkerpp-owned="change"]').forEach(node => node.remove());
}
