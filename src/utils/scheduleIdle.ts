/**
 * Runs a callback when the browser is idle. Falls back to a zero-delay
 * setTimeout when requestIdleCallback is not available (non-Chromium
 * environments or worker contexts in tests).
 */
export function scheduleIdle(cb: () => void): void {
    const ric = (globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
    }).requestIdleCallback;
    if (typeof ric === 'function') {
        ric(cb);
    } else {
        setTimeout(cb, 0);
    }
}
