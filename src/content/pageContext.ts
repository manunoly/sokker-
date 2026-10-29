export type PageContext = (
    | { kind: 'squad'; teamId: number | null }
    | { kind: 'player'; playerId: number }
    | { kind: 'academy'; teamId: number }
    | { kind: 'training-setup' }
    | { kind: 'training-progress' }
    | { kind: 'training-report'; reportId: number }
) & { pathname: string; layout: 'legacy' | 'beta' };

export function positiveId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}

/** The host grants access; only a complete route selects a layout. */
export function resolvePageContext(url: URL): PageContext | null {
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || (host !== 'sokker.org' && !host.endsWith('.sokker.org'))) return null;
    const pathname = url.pathname;
    const legacyPrefix = '(?:[a-z]{2}(?:-[a-z]{2})?/)?';
    if (new RegExp(`^/${legacyPrefix}app/squad/?$`, 'i').test(pathname)) {
        return { kind: 'squad', teamId: null, pathname, layout: 'legacy' };
    }
    const legacyPlayer = new RegExp(`^/${legacyPrefix}(?:app/)?player/(?:PID|ID_player)/([1-9]\\d*)/?$`, 'i').exec(pathname);
    if (legacyPlayer) {
        const playerId = positiveId(legacyPlayer[1]);
        return playerId === null ? null : { kind: 'player', playerId, pathname, layout: 'legacy' };
    }
    const legacyAcademy = new RegExp(`^/${legacyPrefix}juniors/teamID/([1-9]\\d*)/?$`, 'i').exec(pathname);
    if (legacyAcademy) {
        const teamId = positiveId(legacyAcademy[1]);
        return teamId === null ? null : { kind: 'academy', teamId, pathname, layout: 'legacy' };
    }
    if (new RegExp(`^/${legacyPrefix}app/training/training-setup/?$`, 'i').test(pathname)) {
        return { kind: 'training-setup', pathname, layout: 'legacy' };
    }
    if (new RegExp(`^/${legacyPrefix}app/training/main-team-progress/?$`, 'i').test(pathname)) {
        return { kind: 'training-progress', pathname, layout: 'legacy' };
    }
    const report = new RegExp(`^/${legacyPrefix}app/training/reports/details/([1-9]\\d*)/?$`, 'i').exec(pathname);
    if (report) {
        const reportId = positiveId(report[1]);
        return reportId === null ? null : { kind: 'training-report', reportId, pathname, layout: 'legacy' };
    }
    if (/^\/training\/training-setup\/?$/.test(pathname)) {
        return { kind: 'training-setup', pathname, layout: 'beta' };
    }
    if (/^\/training\/main-team-progress\/?$/.test(pathname)) {
        return { kind: 'training-progress', pathname, layout: 'beta' };
    }
    const betaReport = /^\/training\/reports\/details\/([1-9]\d*)\/?$/.exec(pathname);
    if (betaReport) {
        const reportId = positiveId(betaReport[1]);
        return reportId === null ? null : { kind: 'training-report', reportId, pathname, layout: 'beta' };
    }
    const squad = /^\/squad(?:\/([1-9]\d*))?\/?$/.exec(pathname);
    if (squad) {
        const teamId = squad[1] ? positiveId(squad[1]) : null;
        if (squad[1] && teamId === null) return null;
        return { kind: 'squad', teamId, pathname, layout: 'beta' };
    }
    const beta = /^\/(player|juniors)\/([1-9]\d*)\/?$/.exec(pathname);
    if (!beta) return null;
    const id = positiveId(beta[2]);
    if (id === null) return null;
    return beta[1] === 'player'
        ? { kind: 'player', playerId: id, pathname, layout: 'beta' }
        : { kind: 'academy', teamId: id, pathname, layout: 'beta' };
}

/** Development links identify players on observed training tables, not standalone profile routes. */
export function playerIdFromUrl(url: URL, allowDevelopment = false): number | null {
    const development = allowDevelopment && /^\/player\/([1-9]\d*)\/development\/?$/.exec(url.pathname);
    const context = resolvePageContext(development ? new URL(`/player/${development[1]}`, url) : url);
    return context?.kind === 'player' ? context.playerId : null;
}

/** Path-only compatibility for existing scanners; entry points validate the actual URL. */
export function contextFromPath(pathname: string): PageContext | null {
    return resolvePageContext(new URL(pathname, 'https://sokker.org'));
}
