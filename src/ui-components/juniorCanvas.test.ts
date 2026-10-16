import { describe, expect, it } from 'vitest';
import type { JuniorPoint } from '../core/juniorTypes';
import { drawJuniorChart } from './juniorCanvas';

interface Stroke { style: string; dash: number[]; path: Array<{ op: 'move' | 'line'; x: number; y: number }> }

function context() {
    const strokes: Stroke[] = [];
    const labels: Array<{ text: string; x: number; y: number }> = [];
    const dots: Array<{ x: number; y: number }> = [];
    const clips: Array<{ x: number; y: number; width: number; height: number }> = [];
    let path: Stroke['path'] = [];
    let dash: number[] = [];
    const ctx = {
        strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic',
        clearRect: () => {}, fillRect: () => {}, fill: () => {}, save: () => {}, restore: () => {},
        fillText: (text: string, x: number, y: number) => { labels.push({ text, x, y }); },
        arc: (x: number, y: number) => { dots.push({ x, y }); },
        rect: (x: number, y: number, width: number, height: number) => { clips.push({ x, y, width, height }); },
        clip: () => {},
        beginPath: () => { path = []; },
        moveTo: (x: number, y: number) => { path.push({ op: 'move', x, y }); },
        lineTo: (x: number, y: number) => { path.push({ op: 'line', x, y }); },
        setLineDash: (value: number[]) => { dash = [...value]; },
        stroke: () => { strokes.push({ style: ctx.strokeStyle, dash: [...dash], path: [...path] }); },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes, labels, dots, clips };
}

const point = (x: number, y: number): JuniorPoint => ({ x, y, source: 'graph' });

describe('drawJuniorChart', () => {
    it('uses the observed starting and final levels as the vertical range', () => {
        const { ctx, labels, dots } = context();
        drawJuniorChart(ctx, [point(1, 2), point(2, 4), point(3, 8)], 240, 120, null, null);

        expect(labels.filter(label => label.x === 27).map(label => label.text)).toEqual(['2', '5', '8']);
        expect(dots[0].y).toBe(98);
        expect(dots[2].y).toBe(12);
    });

    it('keeps an intermediate dip and a flat series visible without clipping', () => {
        const dip = context();
        drawJuniorChart(dip.ctx, [point(1, 8), point(2, 6), point(3, 8)], 240, 120, null, null);
        expect(dip.labels.filter(label => label.x === 27).map(label => label.text)).toEqual(['6', '7', '8']);
        expect(dip.dots[1].y).toBe(98);

        const flat = context();
        drawJuniorChart(flat.ctx, [point(1, 5), point(2, 5)], 240, 120, null, null);
        expect(flat.labels.filter(label => label.x === 27).map(label => label.text)).toEqual(['4', '5', '6']);
        expect(flat.dots[0].y).toBe(55);
    });

    it('counts down observed weeks from the current weeksLeft without extending into future weeks', () => {
        const { ctx, labels } = context();
        drawJuniorChart(ctx, [point(10, 2), point(11, 3), point(13, 4)], 240, 120, null, 5);

        expect(labels.filter(label => label.y === 115).map(label => label.text)).toEqual(['8', '7', '6', '5']);
        expect(labels.some(label => label.text === '0')).toBe(false);
    });

    it('shows departure week 0 when observed and keeps relative labels without weeksLeft', () => {
        const departure = context();
        drawJuniorChart(departure.ctx, [point(10, 2), point(11, 3), point(12, 4)], 240, 120, null, 0);
        expect(departure.labels.filter(label => label.y === 115).map(label => label.text)).toEqual(['2', '1', '0']);

        const unknown = context();
        drawJuniorChart(unknown.ctx, [point(10, 2), point(12, 4)], 240, 120, null, null);
        expect(unknown.labels.filter(label => label.y === 115).map(label => label.text)).toEqual(['0', '1', '2']);
    });

    it('joins only adjacent observed weeks and leaves gaps blank', () => {
        const { ctx, strokes } = context();
        drawJuniorChart(ctx, [point(13, 4), point(10, 2), point(11, 3)], 240, 120, null, null);
        const real = strokes.filter(stroke => stroke.style === '#78d4ff');
        expect(real).toHaveLength(1);
        expect(real[0].path.map(operation => operation.op)).toEqual(['move', 'line']);
    });

    it('draws a differentiated dashed trend only across observed x bounds', () => {
        const { ctx, strokes, clips } = context();
        drawJuniorChart(ctx, [point(10, 2), point(11, 2), point(14, 3), point(16, 4)], 240, 120, 0.3, null);
        const trend = strokes.filter(stroke => stroke.style === '#ffbf69');
        expect(trend).toHaveLength(1);
        expect(trend[0].dash.length).toBeGreaterThan(0);
        expect(trend[0].path.map(operation => operation.op)).toEqual(['move', 'line']);
        const [start, end] = trend[0].path;
        expect(start.x).toBe(32);
        expect(end.x).toBe(228);
        expect(clips).toEqual([{ x: 32, y: 12, width: 196, height: 86 }]);
    });

    it('does not draw a trend from fewer than four observations or invalid slope', () => {
        const { ctx, strokes } = context();
        drawJuniorChart(ctx, [point(1, 2), point(2, 2), point(3, 3)], 240, 120, 0.5, null);
        drawJuniorChart(ctx, [point(1, 2), point(2, 2), point(3, 3), point(4, 3)], 240, 120, Number.NaN, null);
        expect(strokes.some(stroke => stroke.style === '#ffbf69')).toBe(false);
    });

    it('accepts an empty series without drawing a real line or trend', () => {
        const { ctx, strokes } = context();
        expect(() => drawJuniorChart(ctx, [], 240, 120, null, null)).not.toThrow();
        expect(strokes.some(stroke => ['#78d4ff', '#ffbf69'].includes(stroke.style))).toBe(false);
    });
});
