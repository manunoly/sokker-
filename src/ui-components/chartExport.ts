/** Shared PNG layout for any chart drawn with the extension's native Canvas renderers. */
export interface ChartExportOptions {
    draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
    footer: string;
    credit?: string;
}

export function createChartExportCanvas({ draw, footer, credit }: ChartExportOptions): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 488;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');

    ctx.scale(2, 2);
    ctx.fillStyle = '#202b3a';
    ctx.fillRect(0, 0, 480, 244);

    ctx.save();
    ctx.translate(16, 12);
    try { draw(ctx, 448, 180); } finally { ctx.restore(); }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(footer, 464, 218);
    if (credit) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillText(credit, 464, 233);
    }
    return canvas;
}

/** Keep encoding and the download click synchronous with the user's action. */
export function downloadChartPng(canvas: HTMLCanvasElement, filename: string): void {
    const png = canvas.toDataURL('image/png');
    if (!png.startsWith('data:image/png')) throw new Error('PNG encoding failed');
    const link = document.createElement('a');
    link.href = png;
    link.download = filename;
    document.body.appendChild(link);
    try { link.click(); } finally { link.remove(); }
}
