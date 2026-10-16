import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawChart } from './canvas';
import { createChartExportCanvas, downloadChartPng } from './chartExport';

afterEach(() => vi.restoreAllMocks());

describe('shared chart PNG export', () => {
    it('renders an existing first-team chart with caller-provided footer text', () => {
        const textFonts: string[] = [];
        const ctx = {
            fillStyle: '', font: '', textAlign: 'start' as CanvasTextAlign,
            clearRect: vi.fn(), fillRect: vi.fn(), scale: vi.fn(), save: vi.fn(), restore: vi.fn(),
            translate: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
            setLineDash: vi.fn(), arc: vi.fn(), fill: vi.fn(),
            fillText: vi.fn(() => { textFonts.push(ctx.font); })
        } as unknown as CanvasRenderingContext2D;
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
        const points = [{ week: 1212, value: 6 }, { week: 1213, value: 7 }];

        const canvas = createChartExportCanvas({
            draw: (context, width, height) => drawChart(context, points, width, height),
            footer: 'Pace · 2 weeks',
            credit: 'by manuel.team'
        });

        expect([canvas.width, canvas.height]).toEqual([960, 488]);
        expect(ctx.scale).toHaveBeenCalledWith(2, 2);
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 480, 244);
        expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 448, 180);
        expect(textFonts.slice(-2)).toEqual(['600 14px system-ui, sans-serif', '10px system-ui, sans-serif']);
        expect(vi.mocked(ctx.fillText).mock.calls.slice(-2)).toEqual([
            ['Pace · 2 weeks', 464, 218],
            ['by manuel.team', 464, 233]
        ]);
    });

    it('downloads any composed chart and removes the temporary link', () => {
        const canvas = document.createElement('canvas');
        vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            expect(this.download).toBe('player-42-pace.png');
            expect(this.href).toBe('data:image/png;base64,AAAA');
        });

        downloadChartPng(canvas, 'player-42-pace.png');

        expect(click).toHaveBeenCalledOnce();
        expect(document.querySelector('a[download="player-42-pace.png"]')).toBeNull();
    });

    it('rejects an invalid PNG encoding without creating a download', () => {
        const canvas = document.createElement('canvas');
        vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:,');
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

        expect(() => downloadChartPng(canvas, 'player-42-pace.png')).toThrow('PNG encoding failed');
        expect(click).not.toHaveBeenCalled();
        expect(document.querySelector('a[download="player-42-pace.png"]')).toBeNull();
    });
});
