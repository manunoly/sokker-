import { describe, expect, it } from 'vitest';
import type { SkillProgress } from '../core/talent';
import { drawPlayerSkillChart, PLAYER_SKILL_CHART_WIDTH } from './playerSkillCanvas';

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
    let path: Stroke['path'] = [];
    let dash: number[] = [];
    const ctx = {
        strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic',
        clearRect: () => {},
        fillRect: (x: number, y: number, width: number, height: number) => squares.push({ x, y, style: ctx.fillStyle }),
        fill: () => {},
        fillText: (text: string, x: number, y: number) => labels.push({ text, x, y }),
        arc: (x: number, y: number) => dots.push({ x, y, style: ctx.fillStyle }),
        beginPath: () => { path = []; },
        moveTo: (x: number, y: number) => path.push({ op: 'move', x, y }),
        lineTo: (x: number, y: number) => path.push({ op: 'line', x, y }),
        setLineDash: (value: number[]) => { dash = [...value]; },
        stroke: () => strokes.push({ style: ctx.strokeStyle, dash: [...dash], path: [...path] }),
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes, labels, dots, squares };
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
    it('uses the full 0–18 skill range and keeps a flat series visible', () => {
        const rising = context();
        drawPlayerSkillChart(rising.ctx, progress(), 260, 140);
        expect(rising.labels.filter(label => label.x === 27).map(label => label.text)).toEqual(['0', '2', '4', '6', '8', '10', '12', '14', '16', '18']);
        expect(rising.dots[0].y).toBeCloseTo(88 - 6 / 18 * 76);
        expect(rising.dots[2].y).toBeCloseTo(88 - 8 / 18 * 76);

        const flat = context();
        drawPlayerSkillChart(flat.ctx, progress({ points: [point(1205, 5), point(1206, 5)] }), 260, 140);
        expect(flat.labels.filter(label => label.x === 27).map(label => label.text)).toEqual(['0', '2', '4', '6', '8', '10', '12', '14', '16', '18']);
        expect(flat.dots[0].y).toBeCloseTo(88 - 5 / 18 * 76);
    });

    it('labels only the first, last and observed rise weeks', () => {
        const { ctx, labels, dots, strokes } = context();
        const data = progress({ points: [point(1205, 4), point(1206, 5), point(1214, 6)], riseWeeks: [1206] });
        drawPlayerSkillChart(ctx, data, PLAYER_SKILL_CHART_WIDTH, 140);
        const weeks = labels.filter(label => Number(label.text) >= 1000);
        expect(weeks.map(label => label.text)).toEqual(['1205', '1206', '1214']);
        expect(weeks.some(label => label.text === '1215')).toBe(false);
        expect(dots[1].x - dots[0].x).toBeLessThan(dots[2].x - dots[1].x);
        expect(dots[1].style).toBe('#93eab4');
        expect(strokes[0].path.slice(19 * 2)).toHaveLength(3 * 2);
    });

    it('fits a long saved history into one width without losing observations', () => {
        const points = Array.from({ length: 51 }, (_, index) => point(1163 + index, index < 17 ? 8 : index < 37 ? 9 : 10));
        const data = progress({ points, riseWeeks: [1180, 1200] });
        const { ctx, labels, dots } = context();
        drawPlayerSkillChart(ctx, data, PLAYER_SKILL_CHART_WIDTH, 400);
        expect(dots).toHaveLength(51);
        expect(labels.filter(label => Number(label.text) >= 1000).map(label => label.text)).toEqual(['1163', '1180', '1200', '1213']);
    });

    it('connects the full history while dashing gaps and references and marking injured carried points', () => {
        const { ctx, strokes, dots, squares } = context();
        const injuredCarry = { ...point(1207, 5, 'carried-over'), injured: true };
        drawPlayerSkillChart(ctx, progress({ points: [
            point(1205, 4), point(1206, 5), injuredCarry,
            point(1208, 6, 'roster-fallback'), point(1210, 7), point(1212, 8),
        ] }), 260, 140);
        const real = strokes.filter(stroke => stroke.style === '#78d4ff');
        const references = strokes.filter(stroke => stroke.style === '#94a3b8');
        expect(real).toHaveLength(2);
        expect(real[0].dash).toEqual([]);
        expect(real[1].dash).toEqual([4, 3]);
        expect(real[0].path.map(operation => operation.op)).toEqual(['move', 'line']);
        expect(references).toHaveLength(3);
        expect(references.every(stroke => stroke.dash.join(',') === '4,3')).toBe(true);
        expect(dots.some(dot => dot.style === '#fb923c')).toBe(true);
        expect(squares.some(square => square.style === '#a78bfa')).toBe(true);
    });

    it('never draws an average trend over the observed rises', () => {
        const { ctx, strokes } = context();
        drawPlayerSkillChart(ctx, progress({
            points: [point(1201, 8), point(1205, 5), point(1206, 5), point(1207, 6), point(1208, 7)],
            trendStartWeek: 1205,
            trendEndWeek: 1208,
            pace: { state: 'estimated', slope: 0.7, weeksPerLevel: 1 / 0.7 },
        }), 260, 140);
        expect(strokes.some(stroke => stroke.style === '#ffbf69')).toBe(false);
    });

    it('does not label an inferred reference as an observed rise', () => {
        const { ctx, labels, dots } = context();
        drawPlayerSkillChart(ctx, progress({
            points: [point(1205, 4), point(1206, 5, 'carried-over'), point(1207, 5)],
            riseWeeks: [1206],
        }), 260, 140);
        expect(labels.filter(label => Number(label.text) >= 1000).map(label => label.text)).toEqual(['1205', '1207']);
        expect(dots.some(dot => dot.style === '#93eab4')).toBe(false);
    });
});
