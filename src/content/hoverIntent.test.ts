import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cancelHover, HOVER_DELAY_MS, scheduleHover } from './hoverIntent';

beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = '<span id="one"></span><span id="two"></span>'; });
afterEach(() => { cancelHover(); vi.useRealTimers(); });

it('waits for pointer intent and cancels a passing hover', () => {
    const anchor = document.querySelector<HTMLElement>('#one')!;
    const open = vi.fn();
    scheduleHover(anchor, open);
    vi.advanceTimersByTime(HOVER_DELAY_MS - 1);
    expect(open).not.toHaveBeenCalled();
    cancelHover(anchor);
    vi.advanceTimersByTime(1);
    expect(open).not.toHaveBeenCalled();
    scheduleHover(anchor, open);
    vi.advanceTimersByTime(HOVER_DELAY_MS);
    expect(open).toHaveBeenCalledOnce();
});

it('only opens the latest candidate across cards and ignores detached anchors', () => {
    const one = document.querySelector<HTMLElement>('#one')!;
    const two = document.querySelector<HTMLElement>('#two')!;
    const old = vi.fn(); const latest = vi.fn();
    scheduleHover(one, old); scheduleHover(two, latest); cancelHover(one);
    vi.advanceTimersByTime(HOVER_DELAY_MS);
    expect(old).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledOnce();
    scheduleHover(one, old); one.remove(); vi.advanceTimersByTime(HOVER_DELAY_MS);
    expect(old).not.toHaveBeenCalled();
});

it('cancels an unopened card with Escape', () => {
    const open = vi.fn();
    scheduleHover(document.querySelector<HTMLElement>('#one')!, open);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.advanceTimersByTime(HOVER_DELAY_MS);
    expect(open).not.toHaveBeenCalled();
});

it('ignores a trigger hidden while waiting', () => {
    const anchor = document.querySelector<HTMLElement>('#one')!;
    const open = vi.fn();
    scheduleHover(anchor, open); anchor.setAttribute('aria-hidden', 'true');
    vi.advanceTimersByTime(HOVER_DELAY_MS);
    expect(open).not.toHaveBeenCalled();
});
