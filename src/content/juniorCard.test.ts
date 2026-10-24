import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JuniorRecord } from '../core/juniorTypes';
import { getJuniorRecord } from '../core/storageClient';
import { getJuniorSyncState, subscribeJuniorUpdates } from '../core/juniorSync';
import { drawJuniorChart } from '../ui-components/juniorCanvas';
import { createJuniorExportCanvas } from '../ui-components/juniorExport';
import { hideJuniorCard, scheduleJuniorCardHide, showJuniorCard } from './juniorCard';

vi.mock('../core/storageClient', () => ({ getJuniorRecord: vi.fn() }));
vi.mock('../core/juniorSync', () => ({
    getJuniorSyncState: vi.fn(), subscribeJuniorUpdates: vi.fn(() => () => undefined)
}));
vi.mock('../ui-components/juniorCanvas', async (importOriginal) => ({
    ...await importOriginal<typeof import('../ui-components/juniorCanvas')>(),
    drawJuniorChart: vi.fn()
}));
vi.mock('../ui-components/juniorExport', () => ({ createJuniorExportCanvas: vi.fn() }));

const sample = (overrides: Partial<JuniorRecord> = {}): JuniorRecord => ({
    teamId: 1, juniorId: 2,
    points: [
        { x: 100, y: 2, source: 'graph' }, { x: 101, y: 2, source: 'graph' },
        { x: 102, y: 3, source: 'graph' }, { x: 103, y: 3, source: 'graph' }
    ],
    nativeTalent: 5.5, nativeTalentWeek: 1213, weeksLeft: 12,
    resolvedWeek: 1213, resolution: 'graph',
    ...overrides
});

function anchor(name: string): HTMLElement {
    const node = document.createElement('span');
    node.tabIndex = 0;
    node.textContent = name;
    document.body.appendChild(node);
    return node;
}

const cardText = () => document.querySelector('#sokkerpp-junior-card')?.textContent ?? '';

beforeEach(() => {
    document.documentElement.lang = 'es';
    vi.mocked(getJuniorSyncState).mockReturnValue('idle');
    vi.mocked(getJuniorRecord).mockResolvedValue(sample());
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
});

afterEach(() => {
    hideJuniorCard();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('junior hover card', () => {
    it('renders the academy card in Slovak with localized talent values', async () => {
        document.documentElement.lang = 'sk-SK';
        const trigger = anchor('Synthetic Junior');
        await showJuniorCard(trigger, 1, 2, trigger.textContent!);
        expect(cardText()).toContain('Talent v Sokkeri');
        expect(cardText()).toContain('Talent odhadnutý z krivky');
        expect(cardText()).toContain('5,5');
        expect(cardText()).toContain('Zostávajúce týždne 12: Úroveň 3');
        expect(document.querySelector('#sokkerpp-junior-card button[aria-label="Stiahnuť PNG"]')).not.toBeNull();
    });

    it('renders the academy card in French with localized talent values', async () => {
        document.documentElement.lang = 'fr-FR';
        const trigger = anchor('Synthetic Junior');
        await showJuniorCard(trigger, 1, 2, trigger.textContent!);
        expect(cardText()).toContain('Talent Sokker');
        expect(cardText()).toContain('Talent estimé à partir de la courbe');
        expect(cardText()).toContain('5,5');
        expect(cardText()).toContain('Semaines restantes 12: Niveau 3');
        expect(document.querySelector('#sokkerpp-junior-card button[aria-label="Télécharger le PNG"]')).not.toBeNull();
    });

    it('reads saved points only, distinguishes two talents, and lists remaining weeks', async () => {
        const trigger = anchor('<img src=x onerror=alert(1)>');
        await showJuniorCard(trigger, 1, 2, trigger.textContent!);
        expect(getJuniorRecord).toHaveBeenCalledWith(1, 2);
        expect(cardText()).toContain('Talento de Sokker');
        expect(cardText()).toContain('Talento estimado por curva');
        expect(cardText()).toContain('5,5');
        expect(cardText()).toContain('1213');
        expect(cardText()).toContain('Semanas restantes 15: Nivel 2');
        expect(cardText()).toContain('Semanas restantes 12: Nivel 3');
        expect(cardText()).toContain('0 es la salida');
        const details = document.querySelector<HTMLDetailsElement>('#sokkerpp-junior-card details')!;
        expect(details.open).toBe(false);
        details.querySelector('summary')!.click();
        expect(details.open).toBe(true);
        expect(document.querySelector('#sokkerpp-junior-card img')).toBeNull();
        expect(drawJuniorChart).toHaveBeenCalledOnce();
    });

    it('keeps the academy card close to the name even when its cell is wide', async () => {
        const trigger = anchor('Junior');
        const cell = document.createElement('td');
        cell.append(trigger);
        document.body.append(cell);
        vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
            left: 120, right: 220, top: 100, bottom: 120, width: 100, height: 20
        } as DOMRect);
        vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 300 } as DOMRect);
        await showJuniorCard(trigger, 1, 2, 'Junior');
        const card = document.querySelector<HTMLElement>('#sokkerpp-junior-card')!;
        expect(card.style.width).toBe('500px');
        expect(card.style.left).toBe('228px');
        expect(card.style.top).toBe('100px');

        const nearRightEdge = anchor('Another junior');
        const edgeCell = document.createElement('td');
        edgeCell.append(nearRightEdge);
        document.body.append(edgeCell);
        vi.spyOn(nearRightEdge, 'getBoundingClientRect').mockReturnValue({
            left: 700, right: 800, top: 140, bottom: 160, width: 100, height: 20
        } as DOMRect);
        vi.spyOn(edgeCell, 'getBoundingClientRect').mockReturnValue({ left: 680, right: 800 } as DOMRect);
        await showJuniorCard(nearRightEdge, 1, 3, 'Another junior');
        expect(card.style.width).toBe('208px');
        expect(card.style.left).toBe('808px');
        expect(card.style.top).toBe('140px');
    });

    it('keeps the academy card open while the pointer crosses from name to card', async () => {
        vi.useFakeTimers();
        const trigger = anchor('Junior');
        vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
            left: 120, right: 220, top: 100, bottom: 120
        } as DOMRect);
        await showJuniorCard(trigger, 1, 2, 'Junior');
        const card = document.querySelector<HTMLElement>('#sokkerpp-junior-card')!;
        expect(card.style.left).toBe('228px');

        scheduleJuniorCardHide();
        vi.advanceTimersByTime(200);
        expect(card.isConnected).toBe(true);
        card.dispatchEvent(new MouseEvent('mouseenter'));
        vi.advanceTimersByTime(300);
        expect(card.isConnected).toBe(true);
        card.dispatchEvent(new MouseEvent('mouseleave'));
        vi.advanceTimersByTime(300);
        expect(card.isConnected).toBe(false);
    });

    it('keeps the report card to the left of the whole name cell', async () => {
        const trigger = anchor('Junior');
        const cell = document.createElement('td');
        cell.append(trigger);
        document.body.append(cell);
        vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
            left: 730, right: 820, top: 100, bottom: 120
        } as DOMRect);
        vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({ left: 700, right: 860 } as DOMRect);

        await showJuniorCard(trigger, 1, 2, 'Junior', 'left');
        const card = document.querySelector<HTMLElement>('#sokkerpp-junior-card')!;
        expect(card.style.width).toBe('500px');
        expect(card.style.left).toBe('188px');

        const nearLeftEdge = anchor('Another junior');
        const edgeCell = document.createElement('td');
        edgeCell.append(nearLeftEdge);
        document.body.append(edgeCell);
        vi.spyOn(nearLeftEdge, 'getBoundingClientRect').mockReturnValue({
            left: 280, right: 370, top: 140, bottom: 160
        } as DOMRect);
        vi.spyOn(edgeCell, 'getBoundingClientRect').mockReturnValue({ left: 250, right: 400 } as DOMRect);
        await showJuniorCard(nearLeftEdge, 1, 3, 'Another junior', 'left');
        expect(card.style.width).toBe('230px');
        expect(card.style.left).toBe('8px');
    });

    it('downloads the local graph as PNG without requesting network data', async () => {
        const exportCanvas = document.createElement('canvas');
        vi.spyOn(exportCanvas, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
        vi.mocked(createJuniorExportCanvas).mockReturnValue(exportCanvas);
        const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            expect(this.download).toBe('sokker-junior-2-talent.png');
            expect(this.href).toBe('data:image/png;base64,AAAA');
        });
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);

        await showJuniorCard(anchor('Junior'), 1, 2, 'Junior');
        const button = document.querySelector<HTMLButtonElement>('#sokkerpp-junior-card button')!;
        expect(button.getAttribute('aria-label')).toBe('Descargar PNG');
        button.click();

        expect(createJuniorExportCanvas).toHaveBeenCalledWith(sample().points, 12);
        expect(download).toHaveBeenCalledOnce();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(document.querySelector('#sokkerpp-junior-card')).not.toBeNull();

        hideJuniorCard();
        vi.mocked(getJuniorRecord).mockResolvedValue(sample({ resolution: 'absent' }));
        await showJuniorCard(anchor('Departed junior'), 1, 2, 'Departed junior');
        document.querySelector<HTMLButtonElement>('#sokkerpp-junior-card button')!.click();
        expect(createJuniorExportCanvas).toHaveBeenLastCalledWith(sample().points, null);
        expect(cardText()).toContain('Semana relativa 3: Nivel 3');
    });

    it('keeps the card usable if PNG encoding fails', async () => {
        const exportCanvas = document.createElement('canvas');
        vi.spyOn(exportCanvas, 'toDataURL').mockImplementation(() => { throw new Error('encoding failed'); });
        vi.mocked(createJuniorExportCanvas).mockReturnValue(exportCanvas);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        await showJuniorCard(anchor('Junior'), 1, 2, 'Junior');
        document.querySelector<HTMLButtonElement>('#sokkerpp-junior-card button')!.click();

        expect(cardText()).toContain('No se pudo descargar el PNG.');
        expect(document.querySelector('#sokkerpp-junior-card button')).not.toBeNull();
    });

    it('preserves an opened observation list on refresh and folds it for another junior', async () => {
        const first = anchor('First');
        await showJuniorCard(first, 1, 2, 'First');
        const details = document.querySelector<HTMLDetailsElement>('#sokkerpp-junior-card details')!;
        details.querySelector('summary')!.click();
        const notify = vi.mocked(subscribeJuniorUpdates).mock.calls.at(-1)![0];
        notify(1, 2);
        await vi.waitFor(() => {
            const updated = document.querySelector<HTMLDetailsElement>('#sokkerpp-junior-card details')!;
            expect(updated).not.toBe(details);
            expect(updated.open).toBe(true);
        });

        await showJuniorCard(anchor('Second'), 1, 3, 'Second');
        expect(document.querySelector<HTMLDetailsElement>('#sokkerpp-junior-card details')?.open).toBe(false);
    });

    it('shows a departed junior native value as last recorded and a nonpositive curve without a number', async () => {
        vi.mocked(getJuniorRecord).mockResolvedValue(sample({
            resolution: 'absent', points: [0, 1, 2, 3].map((x) => ({ x, y: 4, source: 'graph' }))
        }));
        await showJuniorCard(anchor('Past junior'), 1, 2, 'Past junior');
        expect(cardText()).toContain('Último valor registrado');
        expect(cardText()).toContain('Sin progreso medible');
    });

    it('shows waiting and error states without a local graph, then updates from a sync notification', async () => {
        vi.mocked(getJuniorSyncState).mockReturnValue('queued');
        vi.mocked(getJuniorRecord).mockResolvedValue(null);
        await showJuniorCard(anchor('Junior'), 1, 2, 'Junior');
        expect(cardText()).toContain('Sincronizando datos');
        vi.mocked(getJuniorSyncState).mockReturnValue('error');
        const notify = vi.mocked(subscribeJuniorUpdates).mock.calls.at(-1)![0];
        notify(1, 2);
        await vi.waitFor(() => expect(cardText()).toContain('No se pudieron cargar'));
        vi.mocked(getJuniorRecord).mockResolvedValue(sample());
        vi.mocked(getJuniorSyncState).mockReturnValue('idle');
        notify(1, 2);
        await vi.waitFor(() => expect(cardText()).toContain('Semanas restantes 12'));
    });

    it('keeps saved curve during update or failure', async () => {
        vi.mocked(getJuniorSyncState).mockReturnValue('loading');
        await showJuniorCard(anchor('Junior'), 1, 2, 'Junior');
        expect(cardText()).toContain('Actualizando');
        expect(document.querySelector('canvas')).not.toBeNull();
        vi.mocked(getJuniorSyncState).mockReturnValue('error');
        const notify = vi.mocked(subscribeJuniorUpdates).mock.calls.at(-1)![0];
        notify(1, 2);
        await vi.waitFor(() => expect(cardText()).toContain('Falló la actualización'));
        expect(document.querySelector('canvas')).not.toBeNull();
    });

    it('does not let an older asynchronous read replace another junior', async () => {
        let resolveFirst!: (value: JuniorRecord | null) => void;
        vi.mocked(getJuniorRecord)
            .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
            .mockResolvedValueOnce(sample({ juniorId: 3, nativeTalent: 9 }));
        const first = showJuniorCard(anchor('First'), 1, 2, 'First');
        await showJuniorCard(anchor('Second'), 1, 3, 'Second');
        resolveFirst(sample());
        await first;
        expect(cardText()).toContain('Second');
        expect(cardText()).toContain('9');
        expect(cardText()).not.toContain('First');
    });

    it('keeps the card when the pointer enters it and closes with Escape', async () => {
        vi.useFakeTimers();
        const trigger = anchor('Junior');
        await showJuniorCard(trigger, 1, 2, 'Junior');
        scheduleJuniorCardHide();
        document.querySelector('#sokkerpp-junior-card')?.dispatchEvent(new MouseEvent('mouseenter'));
        vi.advanceTimersByTime(300);
        expect(document.querySelector('#sokkerpp-junior-card')).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.querySelector('#sokkerpp-junior-card')).toBeNull();
    });

    it('waits for focus to leave the name before scheduled closure', async () => {
        vi.useFakeTimers();
        const trigger = anchor('Junior');
        trigger.focus();
        await showJuniorCard(trigger, 1, 2, 'Junior');
        scheduleJuniorCardHide();
        vi.advanceTimersByTime(300);
        expect(document.querySelector('#sokkerpp-junior-card')).not.toBeNull();
        trigger.blur();
        scheduleJuniorCardHide();
        vi.advanceTimersByTime(300);
        expect(document.querySelector('#sokkerpp-junior-card')).toBeNull();
    });

    it('lets keyboard users enter and read a long observation list without closing the card', async () => {
        vi.useFakeTimers();
        const trigger = anchor('Junior');
        trigger.focus();
        vi.mocked(getJuniorRecord).mockResolvedValue(sample({
            points: Array.from({ length: 30 }, (_, x) => ({ x, y: Math.min(18, x), source: 'graph' }))
        }));

        await showJuniorCard(trigger, 1, 2, 'Junior');
        const list = document.querySelector<HTMLOListElement>('#sokkerpp-junior-card ol')!;
        const details = list.closest('details')!;
        const summary = details.querySelector('summary')!;
        expect(list.children).toHaveLength(30);
        expect(list.tabIndex).toBe(0);
        expect(details.open).toBe(false);
        expect(trigger.getAttribute('aria-controls')).toBe('sokkerpp-junior-card');
        expect(trigger.getAttribute('aria-describedby')).toBe('sokkerpp-junior-card-hint');

        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(summary);
        summary.click();
        expect(details.open).toBe(true);
        list.focus();
        expect(document.activeElement).toBe(list);
        scheduleJuniorCardHide();
        vi.advanceTimersByTime(300);
        expect(document.querySelector('#sokkerpp-junior-card')).not.toBeNull();

        trigger.addEventListener('focus', () => { void showJuniorCard(trigger, 1, 2, 'Junior'); });
        list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.querySelector('#sokkerpp-junior-card')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        expect(trigger.hasAttribute('aria-controls')).toBe(false);
    });
});


it('keeps a pinned junior open on mouseout and closes visibly with focus restored to +', async () => {
    vi.useFakeTimers();
    const trigger = anchor('Junior');
    const control = document.createElement('button'); document.body.appendChild(control);
    await showJuniorCard(trigger, 1, 2, 'Junior', 'right', { pinned: true, returnFocus: control });
    scheduleJuniorCardHide(); vi.advanceTimersByTime(300);
    expect(document.querySelector('#sokkerpp-junior-card')).not.toBeNull();
    const close = document.querySelector<HTMLButtonElement>('[data-junior-close]')!;
    expect(close.getAttribute('aria-label')).toBe('Cerrar');
    close.focus(); close.click();
    expect(document.querySelector('#sokkerpp-junior-card')).toBeNull();
    expect(document.activeElement).toBe(control);
});

it('promotes an existing hover to pinned and ignores later hover until Escape closes it', async () => {
    vi.useFakeTimers();
    const trigger = anchor('Junior');
    await showJuniorCard(trigger, 1, 2, 'Junior');
    await showJuniorCard(trigger, 1, 2, 'Junior', 'right', { pinned: true });
    await showJuniorCard(anchor('Other'), 1, 3, 'Other');
    expect(cardText()).toContain('Junior');
    expect(cardText()).not.toContain('Other');
    scheduleJuniorCardHide(); vi.advanceTimersByTime(300);
    expect(document.querySelector('[data-junior-close]')).not.toBeNull();
    trigger.addEventListener('focus', () => { void showJuniorCard(trigger, 1, 2, 'Junior'); });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('#sokkerpp-junior-card')).toBeNull();
    expect(document.activeElement).toBe(trigger);
});

it('discards a pinned local read after its row identity becomes obsolete', async () => {
    let resolve!: (record: JuniorRecord) => void;
    vi.mocked(getJuniorRecord).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const trigger = anchor('Junior');
    let valid = true;
    const pending = showJuniorCard(trigger, 1, 2, 'Junior', 'right', { pinned: true, isCurrent: () => valid });
    valid = false; resolve(sample()); await pending;
    expect(document.querySelector('#sokkerpp-junior-card')).toBeNull();
});


it('lets the pinned + trigger enter the junior card with ArrowDown and cleans its ARIA on close', async () => {
    const trigger = anchor('Junior');
    trigger.setAttribute('aria-describedby', 'native-hint');
    const control = document.createElement('button');
    control.textContent = '+';
    document.body.appendChild(control);
    control.focus();
    await showJuniorCard(trigger, 1, 2, 'Junior', 'right', { pinned: true, returnFocus: control });
    expect(control.getAttribute('aria-controls')).toBe('sokkerpp-junior-card');
    expect(control.getAttribute('aria-describedby')).toBe('sokkerpp-junior-card-hint');
    expect(control.getAttribute('aria-keyshortcuts')).toBe('ArrowDown');
    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(document.querySelector('#sokkerpp-junior-card summary'));
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.activeElement).toBe(control);
    expect(control.hasAttribute('aria-controls')).toBe(false);
    expect(control.hasAttribute('aria-describedby')).toBe(false);
    expect(control.hasAttribute('aria-keyshortcuts')).toBe(false);
    expect(trigger.getAttribute('aria-describedby')).toBe('native-hint');
});
