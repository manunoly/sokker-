import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
    build: {
        lib: {
            entry: resolve(import.meta.dirname, 'src/content/main.ts'),
            name: 'SokkerPlusPlus',
            formats: ['iife'],
            fileName: () => 'content.js',
        },
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: { output: { inlineDynamicImports: true } },
    },
});
