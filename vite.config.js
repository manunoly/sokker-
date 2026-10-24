import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                background: resolve(
                    import.meta.dirname,
                    'src/background/main.ts',
                ),
                popup: resolve(import.meta.dirname, 'popup/index.html'),
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                assetFileNames: '[name].[ext]',
            },
        },
        outDir: 'dist',
        emptyOutDir: false,
    },
});
