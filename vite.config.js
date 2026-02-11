import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/content/main.ts'),
                popup: resolve(__dirname, 'popup/index.html'), // Popup html will point to popup.ts (requires change in HTML or Vite auto-resolving?)
                // Vite html needs slightly different handling usually, but for popup script specifically we can target just the script if index.html just ref's it.
                // Wait, vite + multi-page app handles index.html fine, but inside index.html it must point to popup.ts or popup.js. 
                // Let's check popup/index.html next.
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]',
            },
        },
        outDir: 'dist',
        emptyOutDir: true,
    },
});
