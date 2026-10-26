import { processBetaPlayers, invalidatePlayerCache } from '../../src/content/ui';
import { scanBetaPlayers } from '../../src/content/betaPlayerPage';
import { leavePlayerBindings } from '../../src/content/playerBindings';
import { resolvePageContext, type PageContext } from '../../src/content/pageContext';
import { handleJuniorPage, leaveJuniorPage, scanJuniorPage } from '../../src/content/juniorPage';
import { handleTrainingPlayerPage, leaveTrainingPlayerPage, scanTrainingPlayerPage } from '../../src/content/trainingPlayerPage';
import { hideTooltip } from '../../src/content/tooltip';
import { hideJuniorCard } from '../../src/content/juniorCard';
import { initHistoryButtonPreferences, setHistoryButtonsVisible } from '../../src/core/historyButtonPreferences';
import type { PlayerData, PlayerHistoryEntry, Skills } from '../../src/types';
import type { JuniorRecord } from '../../src/core/juniorTypes';
import squad from '../../src/content/fixtures/betaSquad.html?raw';
import profile from '../../src/content/fixtures/betaPlayer.html?raw';
import colors from '../../src/content/fixtures/betaPlayerColors.html?raw';
import skillValues from '../../src/content/fixtures/betaSkillValues.html?raw';
import academy from '../../src/content/fixtures/betaAcademy.html?raw';
import setup from '../../src/content/fixtures/betaTrainingSetup.html?raw';
import report from '../../src/content/fixtures/betaTrainingReport.html?raw';

const fixture = document.querySelector<HTMLElement>('#fixture')!;
const sourceHost = document.querySelector<HTMLSelectElement>('#source-host')!;
const scenario = document.querySelector<HTMLSelectElement>('#scenario')!;
const status = document.querySelector<HTMLElement>('#status')!;
const checks = document.querySelector<HTMLOListElement>('#checks')!;
const downloads = document.querySelector<HTMLElement>('#downloads')!;
const operations: string[] = [];
let blockedNetwork = 0;
let blockedWrites = 0;
const recordedDownloads: Array<{ filename: string; type: string; bytes: number; text?: string }> = [];
const currentWeek = 1007;
const baseSkills: Skills = { stamina: 8, pace: 10, technique: 9, passing: 8, keeper: 1, defending: 7, playmaking: 9, striker: 6, tacticalDiscipline: 9, form: 10, teamwork: 8, experience: 5 };
function player(id: number): PlayerData {
    if (scenario.value.startsWith('comparison')) {
        const history: PlayerHistoryEntry[] = [
            { week: 1000, date: '2030-01-03', skills: { ...baseSkills, passing: 8, defending: 6 }, value: 100, source: 'training' },
            { week: 1001, date: '2030-01-10', skills: { ...baseSkills, passing: 8, defending: 7 }, value: 100, source: 'training' },
            { week: 1002, date: '2030-01-17', skills: { ...baseSkills, passing: 9, defending: 7 }, value: 100, source: 'training' },
        ];
        return { id, name: 'Synthetic Player', history, latest: history.at(-1)! };
    }
    const history: PlayerHistoryEntry[] = Array.from({ length: 8 }, (_, index) => ({
        week: 1000 + index, date: new Date(Date.UTC(2026, 7, 7 + index * 7)).toISOString().slice(0, 10),
        skills: { ...baseSkills, pace: 9 + Math.floor(index / 3), passing: 8 + Math.floor(index / 4) },
        value: 100, source: 'training',
        training: { kind: index % 3 ? 'individual' : 'formation', skill: 'pace', position: 'MID', intensity: 95, minutes: 90 },
    }));
    return { id, name: id === 12345 ? 'Player One' : 'Player Two', history, latest: history.at(-1)! };
}
function junior(id: number): JuniorRecord {
    return { teamId: 42, juniorId: id, points: Array.from({ length: 10 }, (_, index) => ({ x: index, y: 5 + Math.floor(index / 3), source: 'graph' })), nativeTalent: 3, nativeTalentWeek: currentWeek, weeksLeft: 10, graphWeek: currentWeek, resolvedWeek: currentWeek, resolution: 'graph' };
}
function reply(message: any): unknown {
    operations.push(message.operation);
    const input = message.input ?? {};
    switch (message.operation) {
        case 'api.today': return scenario.value.startsWith('comparison')
            ? { season: 80, week: 1003, seasonWeek: 3, day: 2, date: { value: '2030-01-22', timestamp: Date.UTC(2030, 0, 22) }, teamId: 42 }
            : { season: 80, week: currentWeek, seasonWeek: 7, day: 6, date: { value: '2026-09-25', timestamp: Date.UTC(2026, 8, 25) }, teamId: 42 };
        case 'getPlayerHistory': return [12345, 12346].includes(input.id) ? player(input.id) : null;
        case 'getJuniorRecord': return junior(input.id);
        case 'getJuniorRecords': return input.ids.map((id: number) => [id, junior(id)]);
        case 'getWriteContext': return { teamId: input.teamId, epoch: 'synthetic-only' };
        case 'getJuniorRosterSnapshot': return { teamId: 42, week: currentWeek, ids: [12345, 12346], complete: true, weeksLeftCaptured: true };
        default: blockedWrites++; throw new Error(`Harness blocks unsupported operation: ${message.operation}`);
    }
}
function eventSet<T extends (...args: any[]) => void>() {
    const listeners = new Set<T>();
    return { addListener: (listener: T) => listeners.add(listener), removeListener: (listener: T) => listeners.delete(listener), fire: (...args: Parameters<T>) => { for (const listener of listeners) listener(...args); } };
}
// Stub exists only in this harness bundle. No production entry point imports it.
const preferenceChanges = eventSet<(changes: Record<string, { newValue: unknown }>, area: string) => void>();
const preferences: Record<string, unknown> = {};
(globalThis as any).chrome = { storage: {
    onChanged: preferenceChanges,
    local: {
        get: async (key: string) => ({ [key]: preferences[key] }),
        set: async (values: Record<string, unknown>) => {
            Object.assign(preferences, values);
            preferenceChanges.fire(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])), 'local');
        },
    },
}, runtime: {
    onMessage: eventSet(),
    connect: () => {
        const onMessage = eventSet<(message: unknown) => void>();
        const onDisconnect = eventSet<() => void>();
        let disconnected = false;
        return { onMessage, onDisconnect, disconnect: () => { disconnected = true; }, postMessage: (message: unknown) => {
            queueMicrotask(() => {
                if (disconnected) return;
                try { onMessage.fire({ ok: true, value: reply(message) }); }
                catch (error) { onMessage.fire({ ok: false, code: 'INVALID_REQUEST', message: String(error), error: { name: 'HarnessBlocked', message: String(error) } }); }
            });
        } };
    },
} };
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    if (url.origin !== location.origin) { blockedNetwork++; return Promise.reject(new Error('External network is blocked by the synthetic harness')); }
    return originalFetch(input, init);
};
const blobs = new Map<string, Blob>();
const originalObjectUrl = URL.createObjectURL.bind(URL);
URL.createObjectURL = blob => { const url = originalObjectUrl(blob); if (blob instanceof Blob) blobs.set(url, blob); return url; };
const originalClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
    if (!this.download) { originalClick.call(this); return; }
    const href = this.href;
    const blob = blobs.get(href);
    const filename = this.download;
    void (async () => {
        const text = blob ? await blob.text() : undefined;
        recordedDownloads.push({ filename, type: blob?.type ?? 'image/png', bytes: blob?.size ?? Math.floor((href.length - href.indexOf(',') - 1) * 3 / 4), ...(text === undefined ? {} : { text }) });
        const label = document.createElement('span'); label.textContent = `${filename} (${recordedDownloads.at(-1)!.bytes} bytes) `; downloads.append(label);
    })();
};
fixture.addEventListener('click', event => {
    if ((event.target as Element).closest('a[href]')) event.preventDefault();
});
const scenarios: Record<string, { path: string; html: string }> = {
    comparison: { path: '/squad', html: '<table><thead><tr><th>Player</th><th>Pace</th><th>Passing</th><th>Defending</th></tr></thead><tbody><tr class="table-row" data-row-id="12345">'
        + '<td class="table__cell--name"><a href="https://sokker.org/player/12345">Synthetic Player</a></td>'
        + '<td class="table__cell--pace">10</td><td class="table__cell--passing">9</td>'
        + '<td class="table__cell--defending">7</td></tr></tbody></table>' },
    'comparison-profile': { path: '/player/12345', html: skillValues },
    squad: { path: '/squad', html: squad }, 'other-squad': { path: '/squad/99', html: squad },
    profile: { path: '/player/12345', html: profile }, colors: { path: '/player/12345', html: colors },
    academy: { path: '/juniors/42', html: academy }, setup: { path: '/training/training-setup', html: setup },
    report: { path: '/training/reports/details/1000', html: report },
};
let current: PageContext;
function check(condition: unknown, label: string): void {
    const item = document.createElement('li'); item.textContent = `${condition ? 'PASS' : 'FAIL'} · ${label}`; item.className = condition ? 'pass' : 'fail'; checks.append(item);
    if (!condition) throw new Error(label);
}
async function until<T>(read: () => T | null | undefined | false): Promise<T> {
    const start = performance.now();
    while (performance.now() - start < 4000) { const value = read(); if (value) return value; await new Promise(requestAnimationFrame); }
    throw new Error('Timed out waiting for the real card to render');
}
async function load(): Promise<void> {
    leavePlayerBindings(); leaveJuniorPage(); leaveTrainingPlayerPage(); hideTooltip(); hideJuniorCard(); invalidatePlayerCache();
    const selected = scenarios[scenario.value];
    history.replaceState({}, '', selected.path);
    const source = new URL(`https://${sourceHost.value}${selected.path}`);
    current = resolvePageContext(source)!;
    document.querySelector('#source-url')!.textContent = `Validated source: ${source.href}`;
    fixture.innerHTML = selected.html;
    if (current.kind === 'squad' || current.kind === 'player') await processBetaPlayers(current);
    if (scenario.value === 'comparison-profile') await verifyProfileColors();
    const juniors = scanJuniorPage(current, document); if (juniors) await handleJuniorPage(juniors);
    const training = scanTrainingPlayerPage(current, document); if (training) handleTrainingPlayerPage(training);
    status.textContent = 'Synthetic view ready. Hover or focus skills for charts; + beside a name pins its summary.';
}
async function verifyProfileColors(): Promise<void> {
    const value = fixture.querySelector<HTMLElement>('#passing-value')!;
    const label = fixture.querySelector<HTMLElement>('#passing span span')!;
    const green = 'rgb(40, 167, 69)';
    const bars = [...fixture.querySelectorAll('.native-bar')].map(bar => bar.outerHTML);
    check(getComputedStyle(value).color === green, 'profile: visible numeric level is green');
    value.style.color = 'var(--c-fg)';
    await new Promise(requestAnimationFrame);
    check(getComputedStyle(value).color === green, 'profile: green survives a native inline color update');
    check(getComputedStyle(label).color === green, 'profile: skill name is green too');
    check(!fixture.querySelector('.skill-arrow'), 'profile: no change arrows are shown');
    check([...fixture.querySelectorAll('.native-bar')].every((bar, index) => bar.outerHTML === bars[index]), 'profile: native bars are unchanged');
    invalidatePlayerCache();
    check(getComputedStyle(value).color !== green && getComputedStyle(label).color !== green, 'profile: invalidation restores native colors');
    await processBetaPlayers(current);
    check(getComputedStyle(value).color === green && getComputedStyle(label).color === green, 'profile: fresh render restores both highlights');
}

async function verifyCurrent(): Promise<void> {
    const apiBefore = operations.filter(operation => operation.startsWith('api.')).length;
    check(['sokker.org', 'app.sokker.org', 'future.sokker.org'].every(host => resolvePageContext(new URL(`https://${host}${current.pathname}`))?.layout === 'beta'), `${scenario.value}: same route layout on root and subdomains`);
    const buttons = [...fixture.querySelectorAll<HTMLButtonElement>('[data-sokkerpp-owned="pin"]')];
    check(buttons.length > 0, `${scenario.value}: history controls are present`);
    check(buttons.every(button => button.dataset.historyVariant === 'name'), `${scenario.value}: only names have + controls`);
    await setHistoryButtonsVisible(false);
    check(buttons.every(button => button.hidden && button.getClientRects().length === 0), `${scenario.value}: preference hides every control without a rescan`);
    // The following focus/Canvas checks run while the + controls are hidden.
    if (current.kind === 'squad' || current.kind === 'player') {
        const players = scanBetaPlayers(current, document);
        if (scenario.value === 'comparison') {
            const passing = players[0].skills.find(item => item.key === 'passing')!.anchor;
            const defending = players[0].skills.find(item => item.key === 'defending')!.anchor;
            check(passing.querySelector('.skill-arrow')?.textContent === '▲' && !defending.querySelector('.skill-arrow'), 'comparison: last completed passing rise is shown, old defending rise is not');
        }
        const skill = players[0].skills.find(item => item.key === 'pace')!.anchor;
        let nativeClicks = 0;
        const onClick = () => { nativeClicks++; }; skill.addEventListener('click', onClick);
        const event = new MouseEvent('click', { bubbles: true, cancelable: true }); skill.dispatchEvent(event);
        check(nativeClicks === 1 && !event.defaultPrevented, `${scenario.value}: native skill click remains available`);
        skill.focus();
        const canvas = await until(() => document.querySelector<HTMLCanvasElement>('#sokkerpp-history-tooltip canvas'));
        const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        check(pixels.some((value, index) => index % 4 === 3 && value > 0), `${scenario.value}: native Canvas produced painted pixels`);
        const pngBefore = recordedDownloads.length;
        [...document.querySelectorAll<HTMLButtonElement>('#sokkerpp-history-tooltip button')].find(button => button.textContent === 'PNG')!.click();
        await until(() => recordedDownloads.length > pngBefore);
        check(recordedDownloads.at(-1)!.type === 'image/png' && recordedDownloads.at(-1)!.bytes > 1000, `${scenario.value}: PNG export encoded real Canvas`);
        const name = players[0].names[0];
        const control = [...fixture.querySelectorAll<HTMLButtonElement>('[data-sokkerpp-owned="pin"]')].find(button => button.previousElementSibling === name || button.previousElementSibling === name.closest('a'));
        await setHistoryButtonsVisible(true);
        check(!!control && control.tabIndex === 0, `${scenario.value}: name pin control is keyboard accessible`);
        control!.click();
        await until(() => document.querySelector<HTMLButtonElement>('[data-close-player-card]')?.style.display === 'block');
        check(nativeClicks === 1, `${scenario.value}: own pin does not invoke the native skill action`);
        skill.removeEventListener('click', onClick);
        hideTooltip();
        players[0].names[0].focus();
        const csv = await until(() => document.querySelector<HTMLButtonElement>('#sokkerpp-history-tooltip [data-export-csv]'));
        check(!!document.querySelector('#sokkerpp-history-tooltip table'), `${scenario.value}: name focus opens saved weekly summary`);
        const csvBefore = recordedDownloads.length; csv.click(); await until(() => recordedDownloads.length > csvBefore);
        check(recordedDownloads.at(-1)!.type.includes('text/csv') && recordedDownloads.at(-1)!.text!.includes(String(player(players[0].playerId).latest.week)), `${scenario.value}: CSV export contains synthetic saved history`);
    } else {
        const training = scanTrainingPlayerPage(current, document);
        if (training?.names.size) {
            training.names.values().next().value!.focus();
            await until(() => document.querySelector('#sokkerpp-history-tooltip [data-export-csv]'));
            check(true, `${scenario.value}: first-team name focus opens the local summary`);
            hideTooltip();
        }
        const juniors = scanJuniorPage(current, document);
        if (juniors?.names.size) {
            juniors.names.values().next().value!.focus();
            const canvas = await until(() => document.querySelector<HTMLCanvasElement>('#sokkerpp-junior-card canvas'));
            check(canvas.toDataURL('image/png').length > 1000, `${scenario.value}: junior focus renders a real Canvas graph`);
            await setHistoryButtonsVisible(true);
            const name = juniors.names.values().next().value!;
            const pin = name.nextElementSibling as HTMLButtonElement;
            pin.click();
            await until(() => document.querySelector('[data-junior-close]'));
            fixture.tabIndex = -1;
            fixture.focus();
            name.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: fixture }));
            await new Promise(resolve => setTimeout(resolve, 300));
            check(!!document.querySelector('#sokkerpp-junior-card'), `${scenario.value}: pinned junior card survives pointer/focus leaving`);
            document.querySelector<HTMLButtonElement>('[data-junior-close]')!.click();
            check(!document.querySelector('#sokkerpp-junior-card'), `${scenario.value}: visible close dismisses the pinned junior card`);
        }
        if (current.kind === 'training-report') check(training?.names.has(12345) && juniors?.names.has(12346) && !training.names.has(12346), 'report: first-team and junior identities stay separate');
    }
    await setHistoryButtonsVisible(true);
    check(buttons.every(button => !button.hidden), `${scenario.value}: preference restores the existing controls`);
    check(operations.filter(operation => operation.startsWith('api.')).length === apiBefore, `${scenario.value}: hover, focus and pin add no API operation`);
    check(blockedNetwork === 0 && blockedWrites === 0, `${scenario.value}: no external network or storage mutation was attempted`);
    status.textContent = `Checks passed for ${scenario.value}. ${operations.length} synthetic message operations; ${recordedDownloads.length} captured exports.`;
}
async function run(all: boolean): Promise<void> {
    document.documentElement.dataset.checkResult = 'running';
    checks.replaceChildren(); downloads.replaceChildren(); recordedDownloads.length = 0;
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('header button')]; buttons.forEach(button => button.disabled = true);
    try {
        await initHistoryButtonPreferences();
        if (all) for (const key of Object.keys(scenarios)) { scenario.value = key; await load(); await verifyCurrent(); }
        else { await load(); await verifyCurrent(); }
        document.documentElement.dataset.checkResult = 'passed';
    } catch (error) {
        document.documentElement.dataset.checkResult = 'failed'; status.textContent = `Check failed: ${error instanceof Error ? error.message : String(error)}`;
        const item = document.createElement('li'); item.className = 'fail'; item.textContent = String(error); checks.append(item); console.error(error);
    } finally { buttons.forEach(button => button.disabled = false); }
}
document.querySelector('#render')!.addEventListener('click', () => { void load().catch(error => { status.textContent = String(error); }); });
document.querySelector('#run')!.addEventListener('click', () => { void run(false); });
document.querySelector('#run-all')!.addEventListener('click', () => { void run(true); });
void run(false);
