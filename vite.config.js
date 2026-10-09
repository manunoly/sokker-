import { defineConfig } from 'vite';
import { resolve } from 'path';
import copy from 'rollup-plugin-copy';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/content/main.ts'),
                popup: resolve(__dirname, 'popup/index.html'),
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]',
            },
            plugins: [
                copy({
                    targets: [
                        { src: 'assets/icons/icon-*.png', dest: 'dist/assets/icons' }
                    ],
                    hook: 'writeBundle' // Copy after bundle is written
                })
            ]
        },
        outDir: 'dist',
        emptyOutDir: true,
    },
});
