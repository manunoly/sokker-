import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JuniorPoint } from '../core/juniorTypes';
import { drawJuniorChart } from './juniorCanvas';
import { createJuniorExportCanvas } from './juniorExport';

vi.mock('./juniorCanvas', () => ({ drawJuniorChart: vi.fn() }));

const point = (x: number, y: number): JuniorPoint => ({ x, y, source: 'graph' });

afterEach(() => vi.restoreAllMocks());

describe('createJuniorExportCanvas', () => {
    it('draws a sharp graph with only the requested English footer aligned right', () => {
        const labels: Array<{ text: string; align: CanvasTextAlign }> = [];
        const ctx = {
            fillStyle: '', font: '', textAlign: 'start' as CanvasTextAlign,
            fillRect: vi.fn(), scale: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
            fillText(text: string) { labels.push({ text, align: ctx.textAlign }); }
        } as unknown as CanvasRenderingContext2D;
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
        const points = [point(0, 2), point(1, 2), point(2, 2), point(3, 2), point(4, 3)];

        const canvas = createJuniorExportCanvas(points, 12);

        expect([canvas.width, canvas.height]).toEqual([960, 488]);
        expect(ctx.scale).toHaveBeenCalledWith(2, 2);
        expect(drawJuniorChart).toHaveBeenCalledOnce();
        expect(vi.mocked(drawJuniorChart).mock.calls[0][1]).toBe(points);
        expect(vi.mocked(drawJuniorChart).mock.calls[0][5]).toBe(12);
        expect(labels).toEqual([
            { text: '12 weeks left · 5.0 talent', align: 'right' },
            { text: 'by manuel.team', align: 'right' }
        ]);
    });

    it('uses dashes when weeks or an estimated talent are unavailable', () => {
        const labels: string[] = [];
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect: () => {}, scale: () => {}, save: () => {}, restore: () => {}, translate: () => {},
            fillText: (text: string) => labels.push(text)
        } as unknown as CanvasRenderingContext2D);

        createJuniorExportCanvas([point(0, 2), point(1, 2), point(2, 2)], null);

        expect(labels).toEqual(['— weeks left · — talent', 'by manuel.team']);
        expect(vi.mocked(drawJuniorChart).mock.calls.at(-1)?.[5]).toBeNull();
    });

    it('keeps zero weeks as a valid value and does not invent talent from a flat curve', () => {
        const labels: string[] = [];
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect: () => {}, scale: () => {}, save: () => {}, restore: () => {}, translate: () => {},
            fillText: (text: string) => labels.push(text)
        } as unknown as CanvasRenderingContext2D);

        createJuniorExportCanvas([point(0, 4), point(1, 4), point(2, 4), point(3, 4)], 0);

        expect(labels[0]).toBe('0 weeks left · — talent');
    });
});
