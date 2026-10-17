import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SkillProgress } from '../core/talent';
import { drawPlayerSkillChart } from './playerSkillCanvas';
import { createPlayerSkillExportCanvas } from './playerSkillExport';

vi.mock('./playerSkillCanvas', () => ({ drawPlayerSkillChart: vi.fn(), PLAYER_SKILL_CHART_WIDTH: 680, PLAYER_SKILL_CHART_HEIGHT: 400 }));

function progress(pace: SkillProgress['pace'], skill: SkillProgress['skill'] = 'pace'): SkillProgress {
    return {
        skill,
        points: [],
        advanced: 0,
        formation: 0,
        exact: true,
        lastRiseReportWeek: null,
        riseWeeks: [],
        trendStartWeek: null,
        trendEndWeek: null,
        pace,
    };
}

afterEach(() => vi.restoreAllMocks());

describe('createPlayerSkillExportCanvas', () => {
    it('reuses the sharp shared PNG compositor and a short English footer', () => {
        const labels: Array<{ text: string; align: CanvasTextAlign }> = [];
        const ctx = {
            fillStyle: '', font: '', textAlign: 'start' as CanvasTextAlign,
            fillRect: vi.fn(), scale: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
            fillText(text: string) { labels.push({ text, align: ctx.textAlign }); },
        } as unknown as CanvasRenderingContext2D;
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
        const data = progress({ state: 'estimated', slope: 2 / 15, weeksPerLevel: 7.5 });

        const canvas = createPlayerSkillExportCanvas(data, 'Pace');

        expect([canvas.width, canvas.height]).toEqual([1424, 928]);
        expect(ctx.scale).toHaveBeenCalledWith(2, 2);
        expect(drawPlayerSkillChart).toHaveBeenCalledWith(ctx, data, 680, 400);
        expect(labels).toEqual([
            { text: 'Pace · level history', align: 'right' },
            { text: 'by manuel.team', align: 'right' },
        ]);
    });

    it('exports a long week span at the same compact width', () => {
        const ctx = {
            fillStyle: '', font: '', textAlign: 'start' as CanvasTextAlign,
            fillRect: vi.fn(), scale: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillText: vi.fn(),
        } as unknown as CanvasRenderingContext2D;
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
        const data = progress({ state: 'insufficient', slope: null, weeksPerLevel: null });
        data.points = [
            { week: 1163, reportWeek: 1163, level: 8, source: 'training', injured: false },
            { week: 1213, reportWeek: 1213, level: 10, source: 'training', injured: false },
        ];

        const canvas = createPlayerSkillExportCanvas(data, 'Pace');

        expect([canvas.width, canvas.height]).toEqual([1424, 928]);
        expect(drawPlayerSkillChart).toHaveBeenCalledWith(ctx, data, 680, 400);
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 712, 464);
        expect(vi.mocked(ctx.fillText).mock.calls[0][0]).toBe('Pace · weeks 1163–1213');
    });

    it('never prints an average pace for any skill', () => {
        const labels: string[] = [];
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect: () => {}, scale: () => {}, save: () => {}, restore: () => {}, translate: () => {},
            fillText: (text: string) => labels.push(text),
        } as unknown as CanvasRenderingContext2D);

        createPlayerSkillExportCanvas(progress({ state: 'insufficient', slope: null, weeksPerLevel: null }), 'Pace');
        createPlayerSkillExportCanvas(progress({ state: 'no-progress', slope: 0, weeksPerLevel: null }), 'Keeper');
        createPlayerSkillExportCanvas(progress(null, 'stamina'), 'Stamina');

        expect(labels).toEqual([
            'Pace · level history', 'by manuel.team',
            'Keeper · level history', 'by manuel.team',
            'Stamina · level history', 'by manuel.team',
        ]);
    });

    it('marks an uncertain game week in the exported footer', () => {
        const labels: string[] = [];
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect: () => {}, scale: () => {}, save: () => {}, restore: () => {}, translate: () => {},
            fillText: (text: string) => labels.push(text),
        } as unknown as CanvasRenderingContext2D);
        const data = progress({ state: 'estimated', slope: 0.2, weeksPerLevel: 5 });
        data.points = [{ week: 1214, reportWeek: 1214, level: 10, source: 'training', injured: false, dateReliable: false }];
        createPlayerSkillExportCanvas(data, 'Pace');
        expect(labels[0]).toBe('Pace · week 1214 · week?');
    });
});
