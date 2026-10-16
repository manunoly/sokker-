import { getPlayerHistory } from '../core/repository';
import { computeSkillProgress } from '../core/talent';
import { PLAYER_SKILL_COLUMNS, preparePlayerTimeline, type PlayerSkill } from '../core/playerTimeline';
import { createPlayerSkillContent, createPlayerSummaryContent } from './playerCard';
import { getPlayerStrings } from './playerLocale';

interface Selection {
    playerId: number;
    skill: PlayerSkill | null;
    anchor: HTMLElement | null;
    x: number;
    y: number;
}

const cardId = 'sokkerpp-history-tooltip';
const skills = new Set<string>(PLAYER_SKILL_COLUMNS.flat());
let card: HTMLDivElement | null = null;
let content: HTMLDivElement | null = null;
let selection: Selection | null = null;
let loadId = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let pinned = false;
let outsideClickHandler: ((event: MouseEvent) => void) | null = null;
let keyHandlerBound = false;
let suppressFocusAnchor: HTMLElement | null = null;
const keyboardAnchors = new WeakSet<HTMLElement>();

function currentStrings() {
    return getPlayerStrings(location.pathname, document.documentElement.lang, navigator.language);
}

function clearAnchor(): void {
    if (!selection?.anchor) return;
    selection.anchor.removeAttribute('aria-expanded');
    selection.anchor.removeAttribute('aria-controls');
    selection.anchor.removeAttribute('aria-keyshortcuts');
}

function bindAnchorKeyboard(anchor: HTMLElement): void {
    if (keyboardAnchors.has(anchor)) return;
    keyboardAnchors.add(anchor);
    anchor.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowDown' || selection?.anchor !== anchor || card?.style.display !== 'block') return;
        event.preventDefault();
        card.focus();
    });
}

function detachOutsideClick(): void {
    if (outsideClickHandler) document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
}

function createCard(): void {
    if (card && document.body.contains(card)) return;
    card = document.createElement('div');
    card.id = cardId;
    card.setAttribute('role', 'dialog');
    card.tabIndex = -1;
    card.style.cssText = [
        'position:fixed', 'z-index:10000', 'box-sizing:border-box', 'display:none',
        'max-width:calc(100vw - 16px)', 'max-height:85vh', 'overflow:auto',
        'padding:14px', 'border:1px solid #64748b', 'border-radius:10px',
        'background:#202b3a', 'color:#f8fafc', 'box-shadow:0 12px 28px #0008',
        'pointer-events:auto'
    ].join(';');
    card.style.position = 'fixed';
    card.addEventListener('mouseenter', cancelHide);
    card.addEventListener('mouseleave', scheduleHide);
    card.addEventListener('focusin', cancelHide);
    card.addEventListener('focusout', scheduleHide);

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', currentStrings().close);
    close.dataset.closePlayerCard = 'true';
    close.style.cssText = 'display:none;position:absolute;top:4px;right:5px;z-index:2;border:0;background:transparent;color:#f8fafc;font-size:21px;cursor:pointer';
    close.addEventListener('click', (event) => { event.stopPropagation(); hideTooltip(); });
    content = document.createElement('div');
    card.append(content, close);
    document.body.appendChild(card);

    if (!keyHandlerBound) {
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape' || card?.style.display !== 'block') return;
            const anchor = selection?.anchor;
            hideTooltip();
            if (anchor) {
                // The focus listener on the source must not reopen the card we just closed.
                suppressFocusAnchor = anchor;
                anchor.focus();
                queueMicrotask(() => {
                    if (suppressFocusAnchor === anchor) suppressFocusAnchor = null;
                });
            }
        });
        keyHandlerBound = true;
    }
}

function placeCard(): void {
    if (!card || !selection) return;
    const edge = 8;
    const gap = 8;
    const targetWidth = selection.skill ? 500 : Math.min(1100, window.innerWidth - 2 * edge, Math.max(760, Math.floor(window.innerWidth * 0.8)));
    const minimumSideWidth = Math.min(targetWidth, selection.skill ? 320 : 760);
    const rect = selection.anchor?.getBoundingClientRect();
    card.style.width = `${targetWidth}px`;
    let left: number;
    let top: number;
    if (rect && (rect.width > 0 || rect.height > 0)) {
        const rightSpace = window.innerWidth - rect.right - gap - edge;
        const leftSpace = rect.left - gap - edge;
        if (rightSpace >= minimumSideWidth && (rightSpace >= leftSpace || leftSpace < minimumSideWidth)) {
            const width = Math.max(1, Math.min(targetWidth, rightSpace));
            card.style.width = `${width}px`;
            left = rect.right + gap;
            top = rect.top;
        } else if (leftSpace >= minimumSideWidth) {
            const width = Math.min(targetWidth, leftSpace);
            card.style.width = `${width}px`;
            left = rect.left - gap - width;
            top = rect.top;
        } else if (rightSpace >= minimumSideWidth) {
            const width = Math.min(targetWidth, rightSpace);
            card.style.width = `${width}px`;
            left = rect.right + gap;
            top = rect.top;
        } else {
            // Narrow screens cannot hold a side card; keep the trigger unobscured.
            card.style.width = `${Math.max(1, Math.min(targetWidth, window.innerWidth - 2 * edge))}px`;
            left = edge;
            top = rect.bottom + gap;
        }
    } else {
        const width = Math.min(targetWidth, window.innerWidth - 2 * edge);
        card.style.width = `${Math.max(1, width)}px`;
        left = Math.max(edge, Math.min(selection.x + gap, window.innerWidth - width - edge));
        top = selection.y + gap;
    }
    const height = card.getBoundingClientRect().height || 320;
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.max(edge, Math.min(Math.round(top), window.innerHeight - height - edge))}px`;
}

function setPinned(value: boolean): void {
    pinned = value;
    detachOutsideClick();
    const close = card?.querySelector<HTMLElement>('[data-close-player-card]');
    if (close) close.style.display = value ? 'block' : 'none';
    if (!value) return;
    outsideClickHandler = (event) => {
        if (card?.contains(event.target as Node) || selection?.anchor?.contains(event.target as Node)) return;
        hideTooltip();
    };
    // The opening click must finish before an outside click can close the card.
    setTimeout(() => {
        if (pinned && outsideClickHandler) document.addEventListener('click', outsideClickHandler);
    }, 0);
}

async function showCard(next: Selection, pin = false): Promise<void> {
    if (next.anchor && suppressFocusAnchor === next.anchor) return;
    const currentLoad = ++loadId;
    createCard();
    cancelHide();
    clearAnchor();
    selection = next;
    next.anchor?.setAttribute('aria-expanded', 'true');
    next.anchor?.setAttribute('aria-controls', cardId);
    next.anchor?.setAttribute('aria-keyshortcuts', 'ArrowDown');
    if (next.anchor) bindAnchorKeyboard(next.anchor);
    setPinned(pin);
    if (!card || !content) return;
    card.style.display = 'block';
    card.setAttribute('aria-label', next.skill ? currentStrings().skills[next.skill] : currentStrings().title);
    card.querySelector<HTMLElement>('[data-close-player-card]')?.setAttribute('aria-label', currentStrings().close);
    content.textContent = '…';
    placeCard();

    let player;
    try {
        player = await getPlayerHistory(next.playerId);
    } catch (cause) {
        if (currentLoad === loadId) {
            console.warn('Could not read saved player history:', cause);
            content.textContent = currentStrings().noData;
        }
        return;
    }
    if (currentLoad !== loadId || card.style.display !== 'block') return;
    if (!player?.history?.length) {
        content.textContent = currentStrings().noData;
        return;
    }
    const rows = preparePlayerTimeline(player.history);
    const t = currentStrings();
    const view = next.skill
        ? createPlayerSkillContent(player, computeSkillProgress(rows, next.skill), t)
        : createPlayerSummaryContent(player, rows, PLAYER_SKILL_COLUMNS.flat().map(skill => computeSkillProgress(rows, skill)), t);
    content.replaceChildren(view);
    placeCard();
}

/** Open a saved per-skill curve next to its source value. */
export async function showTooltip(x: number, y: number, playerId: number, skillName: string, anchor?: HTMLElement): Promise<void> {
    if (!skills.has(skillName)) return;
    await showCard({ playerId, skill: skillName as PlayerSkill, anchor: anchor ?? null, x, y });
}

/** Open the two-column summary and the always-visible weekly table. */
export async function showHistoryTooltip(
    x: number, y: number, playerId: number, targetEl: HTMLElement, opts?: { pinned?: boolean }
): Promise<void> {
    document.querySelectorAll<HTMLElement>('#sokker-plus-tooltip').forEach(node => {
        node.style.setProperty('display', 'none', 'important');
    });
    await showCard({ playerId, skill: null, anchor: targetEl, x, y }, !!opts?.pinned);
}

/** A skill click pins the same native chart card instead of opening a separate modal. */
export async function openZoomChart(playerId: number, skillName: string, anchor?: HTMLElement): Promise<void> {
    if (!skills.has(skillName)) return;
    const rect = anchor?.getBoundingClientRect();
    await showCard({ playerId, skill: skillName as PlayerSkill, anchor: anchor ?? null, x: rect?.right ?? 0, y: rect?.top ?? 0 }, true);
}

export function updatePosition(x: number, y: number): void {
    if (!selection) return;
    selection.x = x;
    selection.y = y;
    placeCard();
}

export function hideTooltip(): void {
    ++loadId;
    cancelHide();
    clearAnchor();
    selection = null;
    pinned = false;
    detachOutsideClick();
    if (card) card.style.display = 'none';
}

export function scheduleHide(): void {
    if (pinned) return;
    cancelHide();
    hideTimer = setTimeout(() => {
        if (card?.contains(document.activeElement) || selection?.anchor === document.activeElement) return;
        hideTooltip();
    }, 600);
}

export function cancelHide(): void {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
}
