import { getPlayerStrings } from './playerLocale';
import { cancelHover } from './hoverIntent';
import { getJuniorRecord } from '../core/storageClient';
import { getJuniorSyncState, subscribeJuniorUpdates } from '../core/juniorSync';
import type { JuniorPoint, JuniorRecord } from '../core/juniorTypes';
import { estimateJuniorTalent } from '../core/juniorTalent';
import { downloadChartPng } from '../ui-components/chartExport';
import { drawJuniorChart, juniorAxisWeek } from '../ui-components/juniorCanvas';
import { createJuniorExportCanvas } from '../ui-components/juniorExport';
import { formatJuniorNumber, getJuniorLanguage, getJuniorStrings, type JuniorStrings } from './juniorLocale';

type CardSide = 'left' | 'right';
interface CardOptions { pinned?: boolean; returnFocus?: HTMLElement; isCurrent?: () => boolean }
interface Selection extends CardOptions { anchor: HTMLElement; teamId: number; juniorId: number; name: string; side: CardSide }

let card: HTMLDivElement | null = null;
let selected: Selection | null = null;
let unsubscribe: (() => void) | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let pointerInCard = false;
let renderToken = 0;
let restoringFocus = false;
const cardId = 'sokkerpp-junior-card';
const hintId = 'sokkerpp-junior-card-hint';

function setAnchorReference(anchor: HTMLElement, attribute: string, id: string, add: boolean): void {
    const ids = (anchor.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean);
    const next = add ? [...new Set([...ids, id])] : ids.filter((value) => value !== id);
    if (next.length) anchor.setAttribute(attribute, next.join(' '));
    else anchor.removeAttribute(attribute);
}

function setSelectionReferences(selection: Selection, add: boolean): void {
    for (const anchor of new Set([selection.anchor, selection.returnFocus].filter((node): node is HTMLElement => !!node))) {
        setAnchorReference(anchor, 'aria-controls', cardId, add);
        setAnchorReference(anchor, 'aria-describedby', hintId, add);
    }
    if (selection.returnFocus) setAnchorReference(selection.returnFocus, 'aria-keyshortcuts', 'ArrowDown', add);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
}

function cancelScheduledHide(): void {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
}

function createCard(): HTMLDivElement {
    const node = element('div');
    node.id = cardId;
    node.setAttribute('role', 'dialog');
    node.tabIndex = -1;
    node.style.cssText = [
        'position:fixed', 'z-index:10000', 'box-sizing:border-box', 'width:500px',
        'max-width:calc(100vw - 16px)', 'max-height:min(85vh, 620px)', 'overflow:auto',
        'padding:16px', 'border:1px solid #64748b', 'border-radius:10px',
        'background:#202b3a', 'color:#f8fafc', 'box-shadow:0 12px 28px #0008',
        'font:13px/1.4 system-ui, sans-serif', 'pointer-events:auto'
    ].join(';');
    node.addEventListener('mouseenter', () => { pointerInCard = true; cancelScheduledHide(); });
    node.addEventListener('mouseleave', () => { pointerInCard = false; scheduleJuniorCardHide(); });
    node.addEventListener('focusin', cancelScheduledHide);
    node.addEventListener('focusout', scheduleJuniorCardHide);
    document.body.appendChild(node);
    return node;
}

function positionCard(anchor: HTMLElement): void {
    if (!card || !selected) return;
    const rect = anchor.getBoundingClientRect();
    const boundary = selected.side === 'left'
        ? anchor.closest('td')?.getBoundingClientRect().left ?? rect.left
        : rect.right;
    const gap = selected.side === 'left' ? 12 : 8;
    const edge = 8;
    const available = selected.side === 'left'
        ? boundary - gap - edge : window.innerWidth - boundary - gap - edge;
    const width = Math.max(1, Math.min(500, available));
    card.style.width = `${width}px`;
    const height = card.getBoundingClientRect().height || 300;
    const left = selected.side === 'left' ? boundary - gap - width : boundary + gap;
    const top = Math.max(edge, Math.min(rect.top, window.innerHeight - height - edge));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
}

function talentBlock(label: string, value: string, detail: string | null): HTMLDivElement {
    const block = element('div');
    block.style.cssText = 'flex:1;min-width:140px;padding:10px;border-radius:7px;background:#314156';
    const title = element('div', label);
    title.style.cssText = 'color:#cbd5e1;font-size:11px';
    const result = element('div', value);
    result.style.cssText = 'font-size:19px;font-weight:700;line-height:1.25;margin:4px 0;overflow-wrap:anywhere';
    block.append(title, result);
    if (detail) {
        const note = element('div', detail);
        note.style.cssText = 'font-size:11px;color:#cbd5e1';
        block.appendChild(note);
    }
    return block;
}

function observedPoints(record: JuniorRecord | null): JuniorPoint[] {
    const byWeek = new Map<number, JuniorPoint>();
    for (const point of record?.points ?? []) {
        if (Number.isInteger(point.x) && Number.isFinite(point.y) && point.y >= 0 && point.y <= 18) {
            byWeek.set(point.x, point);
        }
    }
    return [...byWeek.values()].sort((a, b) => a.x - b.x);
}

function render(record: JuniorRecord | null, syncState: ReturnType<typeof getJuniorSyncState>, readError = false): void {
    if (!selected || !card) return;
    const { anchor, juniorId, name } = selected;
    const language = getJuniorLanguage(location.pathname, document.documentElement.lang, navigator.language);
    const t: JuniorStrings = getJuniorStrings(location.pathname, document.documentElement.lang, navigator.language);
    const number = (value: number) => formatJuniorNumber(value, language);
    const points = observedPoints(record);
    const estimate = estimateJuniorTalent(points);
    const storedWeeks = record?.weeksLeft;
    const weeksLeft = record?.resolution === 'graph' && record.nativeTalentWeek === record.resolvedWeek &&
        typeof storedWeeks === 'number' && Number.isSafeInteger(storedWeeks) && storedWeeks >= 0
        ? storedWeeks : null;

    const header = element('div');
    header.style.cssText = 'display:flex;justify-content:space-between;gap:12px;align-items:baseline';
    const heading = element('strong', name);
    heading.style.cssText = 'font-size:16px;overflow-wrap:anywhere';
    const count = element('span', `${t.observations}: ${number(points.length)}`);
    count.style.cssText = 'color:#cbd5e1;white-space:nowrap;font-size:11px';
    const headerActions = element('div');
    headerActions.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap';
    headerActions.appendChild(count);
    if (points.length) {
        const button = element('button', 'PNG');
        button.type = 'button';
        button.setAttribute('aria-label', t.downloadPng);
        button.title = t.downloadPng;
        button.style.cssText = 'padding:3px 7px;border:1px solid #64748b;border-radius:5px;background:#314156;color:#f8fafc;font:600 11px system-ui,sans-serif;cursor:pointer';
        const error = element('span');
        error.setAttribute('role', 'status');
        error.style.cssText = 'color:#fbd38d;font-size:11px';
        button.addEventListener('click', () => {
            error.textContent = '';
            try {
                const png = createJuniorExportCanvas(points, weeksLeft);
                downloadChartPng(png, `sokker-junior-${juniorId}-talent.png`);
            } catch (cause) {
                console.warn('Could not download junior graph:', cause);
                error.textContent = t.downloadFailed;
            }
        });
        headerActions.append(button, error);
    }
    if (selected.pinned) {
        const closeLabel = getPlayerStrings(location.pathname, document.documentElement.lang, navigator.language).close;
        const close = element('button', '×');
        close.type = 'button';
        close.dataset.juniorClose = 'true';
        close.title = closeLabel;
        close.setAttribute('aria-label', closeLabel);
        close.style.cssText = 'padding:2px 7px;border:1px solid #64748b;border-radius:4px;background:transparent;color:#f8fafc;font:700 18px system-ui;cursor:pointer';
        close.addEventListener('click', dismissCard);
        headerActions.appendChild(close);
    }
    header.append(heading, headerActions);
    card.setAttribute('aria-label', name);

    const talents = element('div');
    talents.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:12px 0';
    const nativeValue = record?.nativeTalent;
    const nativeDetail = nativeValue !== null && nativeValue !== undefined
        ? [record?.resolution === 'absent' ? t.lastRecorded : null,
            record?.nativeTalentWeek != null ? `${t.capturedWeek} ${number(record.nativeTalentWeek)}` : null]
            .filter(Boolean).join(' · ')
        : null;
    talents.appendChild(talentBlock(t.sokkerTalent,
        nativeValue !== null && nativeValue !== undefined ? number(nativeValue) : t.unavailable,
        nativeDetail));

    let curveValue = t.insufficient;
    let curveDetail: string | null = null;
    if (estimate.state === 'no-progress') curveValue = t.noProgress;
    if (estimate.state === 'estimated' && estimate.weeksPerLevel !== null) {
        curveValue = estimate.weeksPerLevel < 3 ? t.lessThanThree
            : estimate.weeksPerLevel > 12 ? t.moreThanTwelve : number(estimate.weeksPerLevel);
        curveDetail = t.weeksPerLevel;
    }
    talents.appendChild(talentBlock(t.curveTalent, curveValue, curveDetail));

    const hint = element('span', t.keyboardHint);
    hint.id = hintId;
    hint.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0';
    const children: Node[] = [header, talents, hint];
    let message: string | null = null;
    if (readError) message = t.loadFailed;
    else if (syncState === 'error') message = points.length ? t.updateFailed : t.loadFailed;
    else if (syncState === 'queued' || syncState === 'loading') message = points.length ? t.updating : t.syncing;
    else if (points.length === 0) message = t.noData;
    if (message) {
        const status = element('div', message);
        status.setAttribute('role', 'status');
        status.style.cssText = 'margin:0 0 10px;color:#fbd38d';
        children.push(status);
    }

    if (points.length) {
        const canvas = element('canvas');
        canvas.width = 466;
        canvas.height = 190;
        canvas.style.cssText = 'display:block;width:100%;height:auto;border-radius:5px;background:#222';
        canvas.setAttribute('aria-hidden', 'true');
        children.push(canvas);

        const legend = element('div');
        legend.style.cssText = 'display:flex;gap:16px;margin-top:6px;font-size:11px;color:#cbd5e1';
        const real = element('span', `● ${t.observed}`);
        real.style.color = '#78d4ff';
        const trend = element('span', `┄ ${t.trend}`);
        trend.style.color = '#ffbf69';
        legend.append(real, trend);
        children.push(legend);
        const explanation = element('p', weeksLeft === null ? t.relativeExplanation : t.countdownExplanation);
        explanation.style.cssText = 'margin:8px 0;font-size:11px;color:#cbd5e1';
        children.push(explanation);

        const previousDetails = card.querySelector('details');
        const wasOpen = previousDetails?.open ?? false;
        const focusedElement = document.activeElement;
        const focusInside = card.contains(focusedElement);
        const focusList = focusedElement?.tagName === 'OL';
        const focusSummary = focusedElement?.tagName === 'SUMMARY';
        const focusClose = (focusedElement as HTMLElement | null)?.dataset?.juniorClose === 'true';
        const details = element('details');
        details.open = wasOpen;
        details.style.cssText = 'margin-top:8px';
        details.addEventListener('toggle', () => {
            if (selected?.anchor === anchor) positionCard(anchor);
        });
        const summary = element('summary', t.pointsHeading);
        summary.style.cssText = 'font-size:11px;font-weight:700;cursor:pointer';
        const list = element('ol');
        list.tabIndex = 0;
        list.setAttribute('aria-label', t.pointsHeading);
        list.style.cssText = 'margin:3px 0 0;padding-left:22px;font-size:11px;max-height:100px;overflow:auto';
        const firstWeek = points[0].x;
        const lastWeek = points[points.length - 1].x;
        const weekLabel = weeksLeft === null ? t.relativeWeek : t.remainingWeek;
        for (const point of points) {
            list.appendChild(element('li', `${weekLabel} ${number(juniorAxisWeek(point.x, firstWeek, lastWeek, weeksLeft))}: ${t.level} ${number(point.y)}`));
        }
        details.append(summary, list);
        children.push(details);
        card.replaceChildren(...children);
        if (focusInside) {
            if (focusList && wasOpen) list.focus();
            else if (focusSummary) summary.focus();
            else if (focusClose) card.querySelector<HTMLElement>('[data-junior-close]')?.focus();
            else card.focus();
        }
        const ctx = canvas.getContext('2d');
        if (ctx) drawJuniorChart(ctx, points, canvas.width, canvas.height, estimate.slope, weeksLeft);
    } else {
        const focusInside = card.contains(document.activeElement);
        const focusClose = (document.activeElement as HTMLElement | null)?.dataset?.juniorClose === 'true';
        card.replaceChildren(...children);
        if (focusInside) (focusClose ? card.querySelector<HTMLElement>('[data-junior-close]') ?? card : card).focus();
    }
    positionCard(anchor);
}

async function refresh(): Promise<void> {
    if (!selected || !card) return;
    const token = ++renderToken;
    const { teamId, juniorId } = selected;
    try {
        const record = await getJuniorRecord(teamId, juniorId);
        if (token !== renderToken || selected?.teamId !== teamId || selected?.juniorId !== juniorId) return;
        if (selected?.isCurrent && !selected.isCurrent()) { hideJuniorCard(); return; }
        render(record, getJuniorSyncState(teamId, juniorId));
    } catch {
        if (token !== renderToken || selected?.teamId !== teamId || selected?.juniorId !== juniorId) return;
        if (selected?.isCurrent && !selected.isCurrent()) { hideJuniorCard(); return; }
        render(null, getJuniorSyncState(teamId, juniorId), true);
    }
}

function dismissCard(): void {
    if (!selected) return;
    const restore = selected.returnFocus ?? selected.anchor;
    hideJuniorCard();
    if (restore.isConnected) {
        restoringFocus = true;
        try { restore.focus(); } finally { restoringFocus = false; }
    }
}

function onKeydown(event: KeyboardEvent): void {
    if (!selected) return;
    if (event.key === 'ArrowDown' && (document.activeElement === selected.anchor || document.activeElement === selected.returnFocus)) {
        (card?.querySelector<HTMLElement>('summary') ?? card)?.focus();
        event.preventDefault();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        dismissCard();
    }
}

/** Reads only the local junior store. Page entry handles all synchronization. */
export async function showJuniorCard(anchor: HTMLElement, teamId: number, juniorId: number, name: string, side: CardSide = 'right', options: CardOptions = {}): Promise<void> {
    cancelHover();
    if (restoringFocus || (selected?.pinned && !options.pinned)) return;
    cancelScheduledHide();
    if (selected?.anchor === anchor && selected.teamId === teamId && selected.juniorId === juniorId &&
        selected.side === side && card) {
        if (options.pinned) {
            setSelectionReferences(selected, false);
            Object.assign(selected, options);
            setSelectionReferences(selected, true);
            render(null, getJuniorSyncState(teamId, juniorId));
            await refresh();
        }
        return;
    }
    if (selected) {
        setSelectionReferences(selected, false);
    }
    if (!card) card = createCard();
    selected = { anchor, teamId, juniorId, name, side, ...options };
    setSelectionReferences(selected, true);
    pointerInCard = false;
    unsubscribe?.();
    unsubscribe = subscribeJuniorUpdates((updatedTeam, updatedJunior) => {
        if (selected?.teamId === updatedTeam && selected.juniorId === updatedJunior) void refresh();
    });
    document.removeEventListener('keydown', onKeydown);
    document.addEventListener('keydown', onKeydown);
    render(null, getJuniorSyncState(teamId, juniorId));
    await refresh();
}

/** Use on name mouseout/focusout; entering the card or keeping name focus cancels closure. */
export function scheduleJuniorCardHide(): void {
    cancelScheduledHide();
    if (selected?.pinned) return;
    hideTimer = setTimeout(() => {
        hideTimer = null;
        if (!selected || pointerInCard || selected.anchor === document.activeElement ||
            card?.contains(document.activeElement)) return;
        hideJuniorCard();
    }, 260);
}

/** Immediately closes the card, including when the eligible page is left. */
export function hideJuniorCard(): void {
    cancelScheduledHide();
    ++renderToken;
    if (selected) {
        setSelectionReferences(selected, false);
    }
    unsubscribe?.();
    unsubscribe = null;
    selected = null;
    pointerInCard = false;
    document.removeEventListener('keydown', onKeydown);
    card?.remove();
    card = null;
}
