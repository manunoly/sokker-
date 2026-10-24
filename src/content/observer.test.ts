// @vitest-environment-options {"url":"https://sokker.org/"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initObserver, refreshObserver, stopObserver } from './observer';

beforeEach(() => { vi.useFakeTimers(); history.replaceState({}, '', '/app/squad/'); document.body.innerHTML = ''; });
afterEach(() => { stopObserver(); vi.useRealTimers(); document.body.innerHTML = ''; });
const advance = async (ms: number) => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(ms); };

describe('SPA discovery lifecycle', () => {
    it('runs the final deferred pass when native DOM arrives inside the cooldown', async () => {
        const squad = vi.fn();
        initObserver(squad);
        await advance(500);
        document.body.innerHTML = '<div class="view-squad"></div>';
        await advance(100);
        expect(squad).not.toHaveBeenCalled();
        await advance(1400);
        expect(squad).toHaveBeenCalledOnce();
        await advance(10000);
        expect(squad).toHaveBeenCalledOnce();
    });
    it('detects push/replace/pop navigation without requiring a DOM mutation', async () => {
        const contexts = vi.fn(); const beta = vi.fn();
        initObserver(vi.fn(), vi.fn(), undefined, undefined, beta, contexts);
        history.pushState({}, '', '/player/12345');
        await advance(100);
        expect(beta).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'player', playerId: 12345, layout: 'beta' }));
        history.replaceState({}, '', '/player/12346/');
        await advance(100);
        expect(contexts).toHaveBeenLastCalledWith(expect.objectContaining({ playerId: 12346 }));
        window.dispatchEvent(new PopStateEvent('popstate'));
        await advance(2000);
        expect(beta).toHaveBeenCalledTimes(3);
        history.pushState({}, '', '/player/12346/transfers');
        await advance(100);
        expect(contexts).toHaveBeenLastCalledWith(null);
    });
    it('ignores extension controls, cards and arrows without scheduling a loop', async () => {
        const squad = vi.fn(container => {
            if (!container.querySelector('.skill-arrow')) {
                const arrow = document.createElement('span'); arrow.className = 'skill-arrow'; container.append(arrow);
            }
        });
        document.body.innerHTML = '<div class="view-squad"></div>';
        initObserver(squad);
        await advance(10000);
        expect(squad).toHaveBeenCalledOnce();
        document.body.insertAdjacentHTML('beforeend', '<div id="sokkerpp-history-tooltip"><span>Saved history</span></div>');
        await advance(10000);
        expect(squad).toHaveBeenCalledOnce();
    });
    it('sees node replacement and refreshes saved-history changes without waiting for cooldown', async () => {
        const squad = vi.fn();
        document.body.innerHTML = '<div class="view-squad"></div>';
        initObserver(squad);
        document.querySelector('.view-squad')!.replaceWith(Object.assign(document.createElement('div'), { className: 'view-squad' }));
        await advance(2000);
        expect(squad).toHaveBeenCalledTimes(2);
        refreshObserver(); await advance(100);
        expect(squad).toHaveBeenCalledTimes(3);
    });
});
