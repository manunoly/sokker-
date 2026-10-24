import { build } from 'vite';
import { mkdir, rm, cp, copyFile, readFile } from 'node:fs/promises';
const watch = process.argv.includes('--watch');
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await copyFile('manifest.json', 'dist/manifest.json');
await cp('_locales', 'dist/_locales', { recursive: true });
await cp('assets/icons', 'dist/assets/icons', { recursive: true });
await build({
    configFile: 'vite.config.js',
    build: { watch: watch ? {} : null },
});
await build({
    configFile: 'vite.content.config.js',
    build: { watch: watch ? {} : null },
});
if (!watch) {
    const content = await readFile('dist/content.js', 'utf8');
    if (
        /\bimport\s*(?:\(|["'{*])|\bexport\s+(?:default|const|let|var|function|class|\{)/.test(
            content,
        )
    )
        throw new Error('content.js must be a self-contained classic script');
    const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
    await readFile(`dist/${manifest.background.service_worker}`);
}
