import { createHistoryButton, updateHistoryButton } from './historyButton';
import { contextFromPath, positiveId, resolvePageContext } from './pageContext';
import type { PlayerSkill } from '../core/playerTimeline';
import { getPlayerStrings } from './playerLocale';
import { hideTooltip, openZoomChart, scheduleHide, showHistoryTooltip, showTooltip } from './tooltip';

export type PlayerSkillKey = PlayerSkill;
export interface PlayerAnchors {
    playerId: number;
    names: HTMLElement[];
    skills: Array<{ key: PlayerSkillKey; anchor: HTMLElement }>;
}
interface Binding { playerId: number; skill: PlayerSkill | null; pathname: string }
let active = new Map<HTMLElement, Binding>();
const bound = new WeakSet<HTMLElement>();
const controls = new Map<HTMLElement, HTMLButtonElement>();
let presentation = 0;

function linkedPlayerId(link: Element): number | null {
    try {
        const context = resolvePageContext(new URL(link.getAttribute('href') ?? '', 'https://sokker.org'));
        return context?.kind === 'player' ? context.playerId : null;
    } catch { return null; }
}

function linksMatch(root: Element, selector: string, playerId: number): boolean {
    const ids = [...root.querySelectorAll(selector)].map(linkedPlayerId).filter(id => id !== null);
    return ids.length > 0 && ids.every(id => id === playerId);
}

function selected(anchor: HTMLElement): Binding | null {
    const binding = active.get(anchor);
    if (!binding || binding.pathname !== location.pathname || !anchor.isConnected) return null;
    const route = contextFromPath(location.pathname);
    if (route?.kind === 'player' && route.playerId !== binding.playerId) return null;
    if (anchor.matches('a[href]') && linkedPlayerId(anchor) !== binding.playerId) return null;
    const row = anchor.closest<HTMLElement>('tr[data-row-id]');
    if (row && positiveId(row.dataset.rowId ?? '') !== binding.playerId) return null;
    const tableName = row?.querySelector('td.table__cell--name');
    if (tableName && !linksMatch(tableName, 'a[href]', binding.playerId)) return null;
    const card = anchor.closest('[class~="@container/player"], .player-box, .player-box--sm');
    // A profile has a route ID and may render only a name span. Squad cards
    // must still agree with their current semantic link before the next scan.
    if (card && route?.kind !== 'player') {
        const selector = card.matches('[class~="@container/player"]')
            ? '[class~="[grid-area:name]"] a[href]' : 'a[href*="/player/"]';
        if (!linksMatch(card, selector, binding.playerId)) return null;
    }
    return binding;
}
export function isPlayerAnchorActive(anchor: HTMLElement, playerId: number): boolean {
    return selected(anchor)?.playerId === playerId;
}

function present(anchor: HTMLElement, binding: Binding, open: () => Promise<void>): void {
    const token = ++presentation;
    void open()?.then(() => {
        const current = selected(anchor);
        if (token === presentation && (!current || current.playerId !== binding.playerId || current.skill !== binding.skill)) hideTooltip();
    }).catch(error => console.warn('Could not show saved player history:', error));
}

function show(anchor: HTMLElement, event?: MouseEvent): void {
    const binding = selected(anchor);
    if (!binding) return;
    const rect = anchor.getBoundingClientRect();
    const x = event?.pageX ?? rect.right;
    const y = event?.pageY ?? rect.top;
    present(anchor, binding, () => binding.skill
        ? showTooltip(x, y, binding.playerId, binding.skill, anchor)
        : showHistoryTooltip(x, y, binding.playerId, anchor));
}
function nativeDescendant(target: EventTarget | null, anchor: HTMLElement): boolean {
    const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
    const control = element?.closest('a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [contenteditable="true"]');
    return !!control && control !== anchor && anchor.contains(control);
}

function bind(anchor: HTMLElement): void {
    if (bound.has(anchor)) return;
    bound.add(anchor);
    if (anchor.tabIndex < 0 && !anchor.hasAttribute('tabindex')) anchor.tabIndex = 0;
    anchor.addEventListener('mouseenter', event => show(anchor, event));
    anchor.addEventListener('focus', () => show(anchor));
    anchor.addEventListener('mouseleave', () => { if (selected(anchor)) scheduleHide(); });
    anchor.addEventListener('blur', () => { if (selected(anchor)) scheduleHide(); });
    const pinLegacy = () => {
        const binding = selected(anchor);
        if (binding?.skill && anchor.dataset.clickable === 'true') {
            present(anchor, binding, () => openZoomChart(binding.playerId, binding.skill!, anchor));
        }
    };
    anchor.addEventListener('click', event => {
        if (anchor.dataset.clickable !== 'true' || !selected(anchor) || nativeDescendant(event.target, anchor)) return;
        event.stopPropagation();
        event.preventDefault();
        pinLegacy();
    });
    anchor.addEventListener('keydown', event => {
        if (anchor.dataset.clickable !== 'true' || !selected(anchor) || nativeDescendant(event.target, anchor) || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        pinLegacy();
    });
}

function pinNameControl(anchor: HTMLElement): void {
    if (controls.get(anchor)?.isConnected) return;
    const button = createHistoryButton(anchor, control => {
        const binding = selected(anchor);
        if (!binding || binding.skill) return;
        const rect = control.getBoundingClientRect();
        present(anchor, binding, () => showHistoryTooltip(rect.right, rect.top, binding.playerId, control, { pinned: true }));
    });
    if (button) controls.set(anchor, button);
}

/** Refresh identities on every render; listeners read this map instead of closing over IDs. */
export function bindPlayerAnchors(players: readonly PlayerAnchors[]): void {
    const next = new Map<HTMLElement, Binding>();
    for (const player of players) {
        for (const name of player.names) next.set(name, { playerId: player.playerId, skill: null, pathname: location.pathname });
        for (const { key, anchor } of player.skills) next.set(anchor, { playerId: player.playerId, skill: key, pathname: location.pathname });
    }
    for (const [anchor, previous] of active) {
        const replacement = next.get(anchor);
        if (!replacement || replacement.playerId !== previous.playerId || replacement.skill !== previous.skill) {
            hideTooltip();
            anchor.querySelectorAll('[data-sokkerpp-owned="change"]').forEach(node => node.remove());
        }
    }
    active = next;
    for (const [anchor, control] of controls) {
        if (active.get(anchor)?.skill !== null || !anchor.isConnected) { control.remove(); controls.delete(anchor); }
    }
    const strings = getPlayerStrings(location.pathname, document.documentElement.lang, navigator.language);
    for (const [anchor, binding] of active) {
        bind(anchor);
        if (binding.skill) continue;
        pinNameControl(anchor);
        const control = controls.get(anchor);
        if (control) updateHistoryButton(control, 'name', `${strings.history}: ${strings.title}`);
    }
}

export function leavePlayerBindings(): void {
    ++presentation;
    active.clear();
    for (const control of controls.values()) control.remove();
    controls.clear();
    document.querySelectorAll('[data-sokkerpp-owned="change"]').forEach(node => node.remove());
    hideTooltip();
}
