/**
 * LeaderboardScene — Displays the top 10 scores from the leaderboard API.
 * Accessible from MenuScene via the "LEADERBOARD" button.
 */
import { LeaderboardMixin, LeaderboardMixinUpdate, LeaderboardMixinShutdown } from './LeaderboardMixin.js';

const API_URL = '/api/leaderboard';

export class LeaderboardScene extends Phaser.Scene {
    constructor() {
        super('Leaderboard');
    }

    create() {
        this.leaderboard = [];
        this.scrollY = 0;
        this.scrollSpeed = 0;

        // ── Title ──
        this.add.text(400, 30, 'LEADERBOARD', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '20px',
            color: '#ffcc00',
        }).setOrigin(0.5);

        // ── Leaderboard rendering (via mixin) ──
        this.tableBg = this.add.graphics();
        Object.assign(this, LeaderboardMixin({
            tableY: 70,
            tableWidth: 385,
            tableX: 208,
            tableHeight: 400,
            rowHeight: 32,
            maxVisibleRows: 11,
            headerOffset: 5,
            fontSize: '9px',
        }));
        this.drawTableBg(this);
        this.addHeader(this);
        this.addEmptyRows(this);

        // ── Back button ──
        this.backBtn = this.add.text(400, 540, 'BACK', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#00ccff',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.backBtn.on('pointerdown', () => this.returnToMenu());
        this.backBtn.on('pointerover', () => this.backBtn.setColor('#88eeff'));
        this.backBtn.on('pointerout', () => this.backBtn.setColor('#00ccff'));

        // ── Scroll input ──
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            this.scrollSpeed -= deltaY * 0.5;
        });

        // ── Fetch leaderboard ──
        this.fetchLeaderboard();
    }

    async fetchLeaderboard() {
        try {
            const res = await fetch(API_URL);
            if (!res.ok) throw new Error('Server offline');
            this.leaderboard = await res.json();
        } catch {
            this.leaderboard = [];
        }
        this.renderRows(this);
    }

    update(time, delta) {
        LeaderboardMixinUpdate(this, time, delta);
    }

    shutdown() {
        LeaderboardMixinShutdown(this);
    }

    returnToMenu() {
        this.cameras.main.fadeOut(300, 10, 10, 26);
        this.time.delayedCall(300, () => {
            this.scene.start('Menu');
        });
    }
}
