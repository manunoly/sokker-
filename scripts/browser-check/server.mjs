import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
const root = resolve(source, '../..');
const output = resolve(root, 'node_modules/.cache/sokker-browser-check');
await build({ configFile: false, root: source, base: '/', build: { outDir: output, emptyOutDir: true } });
if (process.argv.includes('--build-only')) process.exit(0);
const port = Number(process.env.SOKKER_CHECK_PORT ?? 4174);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid SOKKER_CHECK_PORT');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
        let path = resolve(output, `.${pathname}`);
        if (path !== output && !path.startsWith(output + sep)) { response.writeHead(403).end(); return; }
        if (!(await stat(path).catch(() => null))?.isFile()) path = resolve(output, 'index.html');
        response.writeHead(200, { 'Content-Type': `${types[extname(path)] ?? 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
        response.end(await readFile(path));
    } catch { response.writeHead(400).end('Invalid harness request'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Synthetic browser check: http://127.0.0.1:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
