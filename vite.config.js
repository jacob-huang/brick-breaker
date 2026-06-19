import { defineConfig } from 'vite';
import { leaderboardPlugin } from './leaderboard-plugin.js';

export default defineConfig({
    root: '.',
    plugins: [leaderboardPlugin()],
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
