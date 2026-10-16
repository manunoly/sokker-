import { describe, expect, it } from 'vitest';
import type { SkillProgress } from '../core/talent';
import { drawPlayerSkillChart } from './playerSkillCanvas';

interface Stroke {
    style: string;
    dash: number[];
    path: Array<{ op: 'move' | 'line'; x: number; y: number }>;
}

function context() {
    const strokes: Stroke[] = [];
    const labels: Array<{ text: string; x: number; y: number }> = [];
    const dots: Array<{ x: number; y: number; style: string }> = [];
    const squares: Array<{ x: number; y: number; style: string }> = [];
    const clips: Array<{ x: number; y: number; width: number; height: number }> = [];
    let path: Stroke['path'] = [];
    let dash: number[] = [];
    const ctx = {
        strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic',
        clearRect: () => {},
        fillRect: (x: number, y: number, width: number, height: number) => squares.push({ x, y, style: ctx.fillStyle }),
        fill: () => {}, save: () => {}, restore: () => {}, clip: () => {}, closePath: () => {},
        fillText: (text: string, x: number, y: number) => labels.push({ text, x, y }),
        arc: (x: number, y: number) => dots.push({ x, y, style: ctx.fillStyle }),
        rect: (x: number, y: number, width: number, height: number) => clips.push({ x, y, width, height }),
        beginPath: () => { path = []; },
        moveTo: (x: number, y: number) => path.push({ op: 'move', x, y }),
        lineTo: (x: number, y: number) => path.push({ op: 'line', x, y }),
        setLineDash: (value: number[]) => { dash = [...value]; },
        stroke: () => strokes.push({ style: ctx.strokeStyle, dash: [...dash], path: [...path] }),
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes, labels, dots, squares, clips };
}

const point = (week: number, level: number, source: 'training' | 'carried-over' | 'roster-fallback' = 'training') =>
    ({ week, reportWeek: week, level, source, injured: false });

function progress(overrides: Partial<SkillProgress> = {}): SkillProgress {
    return {
        skill: 'pace',
        points: [point(1205, 6), point(1206, 7), point(1207, 8)],
        advanced: 0,
        formation: 0,
        exact: true,
        lastRiseReportWeek: null,
        riseWeeks: [],
        trendStartWeek: null,
        trendEndWeek: null,
        pace: { state: 'insufficient', slope: null, weeksPerLevel: null },
        ...overrides,
    };
}

describe('drawPlayerSkillChart', () => {
    it('uses the displayed levels for the vertical range and keeps a flat series visible', () => {
        const rising = context();
        drawPlayerSkillChart(rising.ctx, progress(), 260, 140);
        expect(rising.labels.filter(label => label.x === 27).map(label => label.text)).toEqual(['6', '7', '8']);
        expect(rising.dots[0].y).toBe(118);
        expect(rising.dots[2].y).toBe(12);

        const flat = context();
        drawPlayerSkillChart(flat.ctx, progress({ points: [point(1205, 5), point(1206, 5)] }), 260, 140);
        expect(flat.labels.filter(label => label.x === 27).map(label => label.text)).toEqual(['4', '5', '6']);
        expect(flat.dots[0].y).toBe(65);
    });

    it('labels actual game weeks with proportional x positions and never extends into future weeks', () => {
        const { ctx, labels, dots } = context();
        drawPlayerSkillChart(ctx, progress({ points: [point(1205, 4), point(1206, 5), point(1214, 6)] }), 260, 140);
        const weeks = labels.filter(label => label.y === 135);
        expect(weeks[0].text).toBe('1205');
        expect(weeks.at(-1)?.text).toBe('1214');
        expect(weeks.some(label => label.text === '1215')).toBe(false);
        expect(dots[1].x - dots[0].x).toBeLessThan(dots[2].x - dots[1].x);
    });

    it('joins only adjacent real observations and distinguishes carried and roster points', () => {
        const { ctx, strokes, dots, squares } = context();
        drawPlayerSkillChart(ctx, progress({ points: [
            point(1205, 4), point(1206, 5), point(1207, 5, 'carried-over'),
            point(1208, 6, 'roster-fallback'), point(1210, 7),
        ] }), 260, 140);
        const real = strokes.filter(stroke => stroke.style === '#78d4ff');
        expect(real).toHaveLength(1);
        expect(real[0].path.map(operation => operation.op)).toEqual(['move', 'line']);
        expect(dots.some(dot => dot.style === '#9ca3af')).toBe(true);
        expect(squares.some(square => square.style === '#a78bfa')).toBe(true);
    });

    it('clips a dashed regression to fitted real weeks after a drop', () => {
        const { ctx, strokes, clips } = context();
        drawPlayerSkillChart(ctx, progress({
            points: [point(1201, 8), point(1205, 5), point(1206, 5), point(1207, 6), point(1208, 7)],
            trendStartWeek: 1205,
            trendEndWeek: 1208,
            pace: { state: 'estimated', slope: 0.7, weeksPerLevel: 1 / 0.7 },
        }), 260, 140);
        const trend = strokes.filter(stroke => stroke.style === '#ffbf69');
        expect(trend).toHaveLength(1);
        expect(trend[0].dash).toEqual([5, 4]);
        expect(trend[0].path.map(operation => operation.op)).toEqual(['move', 'line']);
        expect(trend[0].path[0].x).toBeGreaterThan(32);
        expect(trend[0].path[1].x).toBe(248);
        expect(clips).toEqual([{ x: 32, y: 12, width: 216, height: 106 }]);
    });

    it('omits the trend for stamina or an unavailable pace', () => {
        const stamina = context();
        drawPlayerSkillChart(stamina.ctx, progress({ skill: 'stamina', pace: null, trendStartWeek: 1205, trendEndWeek: 1207 }), 260, 140);
        expect(stamina.strokes.some(stroke => stroke.style === '#ffbf69')).toBe(false);

        const flat = context();
        drawPlayerSkillChart(flat.ctx, progress({ pace: { state: 'no-progress', slope: 0, weeksPerLevel: null } }), 260, 140);
        expect(flat.strokes.some(stroke => stroke.style === '#ffbf69')).toBe(false);
    });
});
