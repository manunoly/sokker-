import { getPlayerHistory } from '../core/storageClient';
import { fetchTodayInfo } from '../core/apiClient';
import type { Skills } from '../types/index';
import { PLAYER_SKILL_COLUMNS, type PlayerSkill } from '../core/playerTimeline';
import { mapSkillLabelToKey } from './i18n';
import { contextFromPath, resolvePageContext, type PageContext } from './pageContext';
import { scanBetaPlayers } from './betaPlayerPage';
import { bindPlayerAnchors, isPlayerAnchorActive, type PlayerAnchors } from './playerBindings';

const skills = new Set<string>(PLAYER_SKILL_COLUMNS.flat());
let renderGeneration = 0;
const highlighted = new Map<HTMLElement, { color: string; weight: string; title: string }>();
function clearHighlights(): void {
    for (const [value, original] of highlighted) {
        value.style.color = original.color;
        value.style.fontWeight = original.weight;
        value.title = original.title;
    }
    highlighted.clear();
}
interface HistoryEntryWithSkills { skills: Skills }

function selectComparisonEntries<T extends HistoryEntryWithSkills>(history: T[], usePreviousWeek: boolean): { targetCurrent: T | null; targetPrevious: T | null } {
    if (!history.length) return { targetCurrent: null, targetPrevious: null };
    if (usePreviousWeek && history.length >= 2) {
        return { targetCurrent: history.at(-2)!, targetPrevious: history.at(-3) ?? null };
    }
    return { targetCurrent: history.at(-1)!, targetPrevious: usePreviousWeek ? null : history.at(-2) ?? null };
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

function showChange(anchor: HTMLElement, skill: PlayerSkill, current?: Skills, previous?: Skills | null): void {
    let arrow = anchor.querySelector<HTMLElement>('[data-sokkerpp-owned="change"]');
    const curr = current?.[skill];
    const prev = previous?.[skill];
    const changed = typeof curr === 'number' && typeof prev === 'number' && curr !== prev;
    const value = anchor.dataset.sokkerppValue === 'true' ? anchor : anchor.querySelector<HTMLElement>('.skillNameNumber');
    if (value && changed) {
        highlighted.set(value, { color: value.style.color, weight: value.style.fontWeight, title: value.title });
        value.style.color = curr > prev ? '#28a745' : '#dc3545';
        value.style.fontWeight = 'bold';
        value.title = `Previous: ${prev}`;
    }
    if (anchor.dataset.sokkerppValue === 'true') { arrow?.remove(); return; }
    if (typeof curr !== 'number' || typeof prev !== 'number' || curr === prev) { arrow?.remove(); return; }
    if (!arrow) {
        arrow = document.createElement('span');
        arrow.dataset.sokkerppOwned = 'change';
        arrow.className = 'skill-arrow';
        arrow.style.cssText = 'display:inline-block;margin-inline-start:4px;font-size:10px;font-weight:bold;vertical-align:middle';
        // The indicator has its own slot, outside the native bar's children.
        anchor.appendChild(arrow);
    }
    const glyph = curr > prev ? '▲' : '▼';
    if (arrow.textContent !== glyph) arrow.textContent = glyph;
    arrow.style.color = curr > prev ? '#28a745' : '#dc3545';
    arrow.title = `Previous: ${prev}`;
}

async function renderPlayers(players: PlayerAnchors[], pathname: string): Promise<void> {
    const generation = ++renderGeneration;
    clearHighlights();
    bindPlayerAnchors(players);
    if (!players.length) return;
    let today;
    try { today = await fetchTodayInfo(); }
    catch (error) { console.warn('Could not read current comparison week:', error); }
    if (generation !== renderGeneration || location.pathname !== pathname) return;
    const usePreviousWeek = !!today && today.day < 5;
    // Share each read across every table/card anchor for this player in the scan.
    const reads = new Map<number, ReturnType<typeof getPlayerHistory>>();
    for (const player of players) if (!reads.has(player.playerId)) reads.set(player.playerId, getPlayerHistory(player.playerId));
    await Promise.all(players.map(async player => {
        const saved = await reads.get(player.playerId)!;
        if (generation !== renderGeneration || location.pathname !== pathname) return;
        const { targetCurrent, targetPrevious } = selectComparisonEntries(saved?.history ?? [], usePreviousWeek);
        for (const { key, anchor } of player.skills) {
            if (isPlayerAnchorActive(anchor, player.playerId)) showChange(anchor, key, targetCurrent?.skills, targetPrevious?.skills);
        }
    }));
}

/** Legacy cards continue to use their semantic labels and existing weekly comparison. */
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

/** Legacy profile identity comes from its full route, including localized /app variants. */
export async function processPlayerPage(container: HTMLElement): Promise<void> {
    const context = contextFromPath(location.pathname);
    if (context?.kind !== 'player' || context.layout !== 'legacy') return;
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
        player.skills.push({ key, anchor: cell });
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
    await renderPlayers(players, context.pathname);
}


/** Invalidate pending saved-history reads after a shared storage change. */
export function invalidatePlayerCache(): void {
    ++renderGeneration;
    clearHighlights();
    document.querySelectorAll('[data-sokkerpp-owned="change"]').forEach(node => node.remove());
}
