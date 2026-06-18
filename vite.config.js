import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    build: {
        outDir: './dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                // Split Phaser vendor chunk for browser caching
                manualChunks: {
                    phaser: ['phaser'],
                },
            },
        },
    },
    server: {
        port: 3000,
        open: false,
    },
});
