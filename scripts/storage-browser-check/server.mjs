import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
const root = resolve(source, '../..');
const output = resolve(
    root,
    'node_modules/.cache/sokker-storage-browser-check',
);
await build({
    configFile: false,
    root: source,
    base: '/',
    build: { outDir: output, emptyOutDir: true },
});
if (process.argv.includes('--build-only')) process.exit(0);
const port = 4175;
const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
};
const policy =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";
const server = createServer(async (request, response) => {
    if (
        !['127.0.0.1:4175', 'localhost:4175'].includes(
            request.headers.host ?? '',
        )
    ) {
        response.writeHead(403).end('Loopback origin only');
        return;
    }
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
        response.writeHead(405).end();
        return;
    }
    try {
        const pathname = decodeURIComponent(
            new URL(request.url ?? '/', 'http://127.0.0.1').pathname,
        );
        let path = resolve(output, `.${pathname}`);
        if (path !== output && !path.startsWith(output + sep)) {
            response.writeHead(403).end();
            return;
        }
        if (!(await stat(path).catch(() => null))?.isFile())
            path = resolve(output, 'index.html');
        response.writeHead(200, {
            'Content-Type': `${types[extname(path)] ?? 'application/octet-stream'}; charset=utf-8`,
            'Cache-Control': 'no-store',
            'Content-Security-Policy': policy,
            'X-Content-Type-Options': 'nosniff',
        });
        response.end(
            request.method === 'HEAD' ? undefined : await readFile(path),
        );
    } catch {
        response.writeHead(400).end('Invalid harness request');
    }
});
server.listen(port, '127.0.0.1', () =>
    console.log(`Synthetic native IndexedDB check: http://127.0.0.1:${port}/`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.close(() => process.exit(0)));
