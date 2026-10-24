import { build } from 'vite';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
const root = resolve(source, '../..');
const cache = resolve(root, 'node_modules/.cache/sokker-mv3-check');
await mkdir(cache, { recursive: true });
const output = resolve(cache, `tool-${randomUUID()}`);
await mkdir(output); // Each build is new; no prior artifacts are removed or replaced.
await build({
    configFile: false,
    build: {
        outDir: output,
        emptyOutDir: false,
        minify: false,
        target: 'node20',
        reportCompressedSize: false,
        lib: {
            entry: resolve(source, 'cli.ts'),
            formats: ['es'],
            fileName: () => 'cli.mjs',
        },
        rollupOptions: { external: (id) => id.startsWith('node:') },
    },
});
if (!process.argv.includes('--build-only')) {
    const { main } = await import(
        pathToFileURL(resolve(output, 'cli.mjs')).href
    );
    await main(process.argv.slice(2), root);
}
