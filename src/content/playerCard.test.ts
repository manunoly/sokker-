import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerData, PlayerHistoryEntry } from '../types/index';
import type { PlayerSkill, PlayerTimelineRow } from '../core/playerTimeline';
import type { SkillProgress } from '../core/talent';
import { createPlayerSkillContent, createPlayerSummaryContent } from './playerCard';
import { getPlayerStrings } from './playerLocale';

vi.mock('../ui-components/playerSkillCanvas', () => ({ drawPlayerSkillChart: vi.fn(), PLAYER_SKILL_CHART_WIDTH: 680, PLAYER_SKILL_CHART_HEIGHT: 400 }));

const skills = { stamina: 7, pace: 10, technique: 8, passing: 9, keeper: 0, defending: 6, playmaking: 11, striker: 5, form: 10, teamwork: 8, tacticalDiscipline: 5, experience: 4 };
const sourceEntry = (week: number, source: PlayerHistoryEntry['source'], training?: PlayerHistoryEntry['training']): PlayerHistoryEntry => ({
    week, date: '2026-10-16', skills, value: 1, source, training
});
const row = (entry: PlayerHistoryEntry): PlayerTimelineRow => ({ entry, reportWeek: entry.week, observedWeek: entry.week, source: entry.source, dateReliable: true });
const player: PlayerData = { id: 7, name: '<img src=x onerror=alert(1)>', latest: sourceEntry(1214, 'training'), history: [] };
const order: PlayerSkill[] = ['stamina', 'pace', 'technique', 'passing', 'keeper', 'defending', 'playmaking', 'striker'];
const progress = order.map((skill): SkillProgress => ({
    skill, points: [{ week: 1214, reportWeek: 1214, level: skills[skill], source: 'training', injured: false }],
    advanced: skill === 'pace' ? 3 : 0, formation: skill === 'pace' ? 1 : 0,
    exact: skill !== 'pace', lastRiseReportWeek: skill === 'pace' ? 1211 : null,
    riseWeeks: [], trendStartWeek: null, trendEndWeek: null,
    pace: skill === 'stamina' ? null : { state: 'insufficient', slope: null, weeksPerLevel: null }
}));

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
});

describe('first-team cards', () => {
    it('shows the approved two-column order and separate accessible counters', () => {
        const t = getPlayerStrings('/es/app/player/7/', 'es', 'es');
        const card = createPlayerSummaryContent(player, [row(sourceEntry(1214, 'training'))], progress, t);
        expect([...card.querySelectorAll('[data-player-skill]')].map(el => el.getAttribute('data-player-skill'))).toEqual(order);
        expect(card.querySelectorAll('[data-player-skill-column]')).toHaveLength(2);
        const pace = card.querySelector('[data-player-skill="pace"]')!;
        expect(pace.textContent).toContain('≥3');
        expect(pace.textContent).toContain('≥1');
        const counts = pace.querySelectorAll<HTMLElement>('[data-training-count]');
        expect(counts).toHaveLength(2);
        expect(counts[0].getAttribute('aria-label')).toContain('Avanzados');
        expect(counts[1].getAttribute('aria-label')).toContain('Formación');
        expect(counts[0].title).toContain('entrenamiento directo');
        expect(counts[1].title).toContain('sin foco directo');
        expect(counts[0].tabIndex).toBe(0);
        expect(counts[0].title).toContain('faltan semanas o informes');
        expect(card.textContent).toContain('Semana observada: 1214');
        expect(card.querySelector('img')).toBeNull();
        const noRise = createPlayerSummaryContent(player, [], [{ ...progress[0], exact: false }], t);
        const noRiseHelp = noRise.querySelector<HTMLElement>('[data-training-count="advanced"]')!.title;
        expect(noRiseHelp).toContain('se desconoce el inicio');
        expect(noRiseHelp).not.toContain('faltan semanas o informes');
    });

    it('keeps the weekly table visible and explains every provenance status', () => {
        const t = getPlayerStrings('/es/app/player/7/', 'es', 'es');
        const rows = [
            row(sourceEntry(1214, 'training', { kind: 'individual', skill: 'pace', position: 'MID', intensity: 85, minutes: 90 })),
            row(sourceEntry(1213, 'training', { kind: 'formation', skill: 'pace', position: null, intensity: 30, minutes: 40 })),
            row(sourceEntry(1212, 'carried-over')),
            row(sourceEntry(1211, 'roster-fallback')),
            row(sourceEntry(1210, 'training')),
            row(sourceEntry(1209, 'training', { kind: 'formation', skill: 'pace', position: null, intensity: 0, minutes: 0 })),
        ];
        rows[2].entry.injured = true;
        rows[4].dateReliable = false;
        rows[5].entry.injured = true;
        const card = createPlayerSummaryContent(player, rows, progress, t);
        const table = card.querySelector('table')!;
        expect(table.hidden).toBe(false);
        expect(table.textContent).toContain('Registro');
        expect(table.textContent).toContain('Pos / Skill');
        expect(table.textContent).toContain('Avanzado');
        expect(table.textContent).toContain('Formación');
        expect(table.textContent).toContain('Sin informe');
        expect(table.textContent).toContain('Solo plantilla');
        expect(table.textContent).toContain('Informe sin detalle');
        expect(table.querySelectorAll('[aria-label="Lesionado en este registro"]')).toHaveLength(2);
        expect(table.textContent).toContain('1210 ?');
        expect([...table.querySelectorAll('th')].filter(th => th.textContent === 'Registro')).toHaveLength(1);
        expect([...table.querySelectorAll('th')].map(th => th.textContent)).toEqual([
            'Registro', 'Pos / Skill', 'Efect.', 'Semana', 'Sta', 'Pc', 'Tec', 'Pas', 'Kp', 'Def', 'Plm', 'Str', 'Form',
        ]);
        expect(table.querySelectorAll('tbody tr')).toHaveLength(rows.length);
        expect(table.querySelector('tbody tr')?.children).toHaveLength(13);
        expect(table.style.width).toBe('max-content');
        expect(table.parentElement?.style.width).toBe('max-content');
        expect(table.parentElement?.style.flex).toBe('1 1 0%');
        expect(table.parentElement?.parentElement?.style.flex).toBe('1 1 0%');
        expect([...table.querySelectorAll('col')].map(col => col.style.width).slice(0, 4)).toEqual(['100px', '144px', '52px', '56px']);
        expect((table.querySelector('th:nth-child(5)') as HTMLElement).style.padding).toBe('5px 3px');
        expect(table.querySelector('th:nth-child(2)')?.getAttribute('style')).toContain('text-align: left');
        expect([...table.querySelectorAll('tbody tr')].every(tr => (tr.children[1] as HTMLElement).style.textAlign === 'left')).toBe(true);
        const longRecord = [...table.querySelectorAll('tbody tr')].find(tr => tr.textContent?.includes('1210'))!;
        expect(longRecord.querySelector<HTMLElement>('td:first-child > span')?.title).toBe('Informe sin detalle');
        const injuredWithoutTraining = [...table.querySelectorAll('tbody tr')].find(tr => tr.textContent?.includes('1209'))!;
        expect(injuredWithoutTraining.children[0].textContent).toBe('🩹');
        expect(injuredWithoutTraining.children[0].textContent).not.toContain('Formación');
        expect(injuredWithoutTraining.children[2].textContent).toBe('—');
        expect(card.querySelector('[data-export-csv]')).not.toBeNull();
    });

    it.each(['individual', 'formation'] as const)('highlights only effectiveness strictly between 49 and 80 for %s reports', (kind) => {
        const t = getPlayerStrings('/en/app/player/7/', 'en', 'en');
        const cases = [
            [0, false], [49, false], [49.5, true], [50, true],
            [70, true], [79, true], [79.5, true], [80, false], [100, false],
        ] as const;
        const rows = cases.map(([intensity], index) => row(sourceEntry(1214 - index, 'training', {
            kind, skill: 'pace', position: 'MID', intensity, minutes: 90,
        })));
        const card = createPlayerSummaryContent(player, rows, progress, t);
        const renderedRows = [...card.querySelectorAll<HTMLTableRowElement>('tbody tr')];
        cases.forEach(([intensity, highlighted], index) => {
            const cell = renderedRows[index].cells[2];
            expect(cell.textContent).toBe(`${intensity}%`);
            expect(cell.style.background).toBe(highlighted ? 'rgb(250, 204, 21)' : '');
            expect(cell.style.color).toBe(highlighted ? 'rgb(31, 41, 55)' : '');
            expect(renderedRows[index].cells[1].style.background).toBe('');
        });
    });

    it.each(['individual', 'formation'] as const)('keeps injured %s reports unhighlighted and hides only zero effectiveness', (kind) => {
        const t = getPlayerStrings('/en/app/player/7/', 'en', 'en');
        const rows = [0, 70, 100].map((intensity, index) => {
            const entry = sourceEntry(1214 - index, 'training', {
                kind, skill: 'pace', position: 'MID', intensity, minutes: 90,
            });
            entry.injured = true;
            return row(entry);
        });
        const card = createPlayerSummaryContent(player, rows, progress, t);
        const cells = [...card.querySelectorAll<HTMLTableCellElement>('tbody tr td:nth-child(3)')];
        expect(cells.map(cell => cell.textContent)).toEqual(['—', '70%', '100%']);
        expect(cells.every(cell => cell.style.background === '')).toBe(true);
    });

    it('leaves unknown effectiveness and reference or missing reports unhighlighted', () => {
        const t = getPlayerStrings('/en/app/player/7/', 'en', 'en');
        const training = { kind: 'formation', skill: 'pace', position: 'MID', intensity: 70, minutes: 90 } as const;
        const rows = [
            row(sourceEntry(1214, 'training')),
            row(sourceEntry(1213, 'training', { ...training, intensity: Number.NaN })),
            row(sourceEntry(1212, 'carried-over', training)),
            row(sourceEntry(1211, 'roster-fallback', training)),
            row(sourceEntry(1210, 'training', { ...training, kind: 'missing' })),
        ];
        const card = createPlayerSummaryContent(player, rows, progress, t);
        const cells = [...card.querySelectorAll<HTMLTableCellElement>('tbody tr td:nth-child(3)')];
        expect(cells.slice(0, 2).map(cell => cell.textContent)).toEqual(['—', '—']);
        expect(cells.every(cell => cell.style.background === '')).toBe(true);
    });

    it('shows saved levels without a fitted pace or trend', () => {
        const t = getPlayerStrings('/en/app/player/7/', 'en', 'en');
        const card = createPlayerSkillContent(player, progress[0], t);
        expect(card.textContent).toContain('Stamina 7');
        expect(card.textContent).not.toContain('weeks per level');
        expect(card.querySelector('canvas')).not.toBeNull();
        const pace = createPlayerSkillContent(player, { ...progress[1], pace: { state: 'estimated', slope: 0.2, weeksPerLevel: 5 } }, t);
        expect(pace.textContent).toContain('Pace 10');
        expect(pace.textContent).not.toContain('Observed pace');
        expect(pace.textContent).not.toContain('5 weeks per level');
        const referenced = createPlayerSkillContent(player, {
            ...progress[1], points: [
                { week: 1213, reportWeek: 1213, level: 9, source: 'carried-over', injured: false },
                { week: 1214, reportWeek: 1214, level: 10, source: 'training', injured: false, dateReliable: false },
            ]
        }, t);
        expect(referenced.textContent).toContain('stored report week used');
        expect(referenced.querySelector('details')?.textContent).toContain('No report · reference');
    });

    it('fits the full skill history into the card without horizontal scrolling', () => {
        const t = getPlayerStrings('/en/app/player/7/', 'en', 'en');
        const card = createPlayerSkillContent(player, progress[1], t);
        const canvas = card.querySelector('canvas')!;
        expect(canvas.width).toBe(680);
        expect(canvas.height).toBe(400);
        expect(canvas.style.width).toBe('100%');
        expect(card.querySelector('[role="region"]')).toBeNull();
    });
});
