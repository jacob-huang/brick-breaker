/**
 * MenuScene — Start screen with decorative bricks, title, instructions,
 * and blinking "PRESS SPACE TO START" prompt.
 */
const DECO_ROWS = [
    { y: 160, color: '#ff2266', count: 6 }, // Row 0: red-pink
    { y: 188, color: '#ffdd00', count: 6 }, // Row 1: yellow
    { y: 216, color: '#44dd44', count: 6 }, // Row 2: green
];
const BRICK_W = 64;
const BRICK_H = 24;
const BRICK_SPACING = 4;

export class MenuScene extends Phaser.Scene {
    constructor() {
        super('Menu');
    }

    create() {
        // ── Decorative brick rows (batched into single Graphics) ──
        this.decoGfx = this.add.graphics();
        this.drawDecoBricks();

        // ── Title ──
        this.add.text(400, 80, 'BRICK BREAKER', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '32px',
            color: '#00ccff',
        }).setOrigin(0.5);

        // ── Instructions ──
        this.add.text(400, 260, 'Mouse, Touch, or Arrow Keys to move paddle', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#888888',
        }).setOrigin(0.5);

        this.add.text(400, 285, 'Click or Space to launch ball', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#888888',
        }).setOrigin(0.5);

        this.add.text(400, 310, 'P or Esc to pause', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#888888',
        }).setOrigin(0.5);

        // ── Blinking "PRESS SPACE TO START" ──
        this.startText = this.add.text(400, 420, 'PRESS SPACE TO START', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#ffcc00',
        }).setOrigin(0.5);

        // ── Tween-based blink (replaces manual delta accumulation) ──
        this.tweens.add({
            targets: this.startText,
            alpha: 0,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Linear',
        });

        // ── LEADERBOARD button ──
        this.leaderboardBtn = this.add.text(400, 460, 'LEADERBOARD', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#00ccff',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        // Touch feedback + navigation
        this.leaderboardBtn.on('pointerdown', () => {
            this.leaderboardBtn.setColor('#88eeff');
            this.showLeaderboard();
        });
        this.leaderboardBtn.on('pointerup', () => this.leaderboardBtn.setColor('#00ccff'));
        this.leaderboardBtn.on('pointerout', () => this.leaderboardBtn.setColor('#00ccff'));
        this.leaderboardBtn.on('pointerover', () => this.leaderboardBtn.setColor('#88eeff'));

        // ── Input ──
        this.input.keyboard.on('keydown-SPACE', () => this.startGame());
        this.input.on('pointerdown', () => this.startGame());

        // Keyboard navigation for Leaderboard (Enter to toggle)
        this.input.keyboard.on('keydown-ENTER', () => this.showLeaderboard());
    }

    drawDecoBricks() {
        const totalW = 6 * BRICK_W + 5 * BRICK_SPACING;
        const startX = (800 - totalW) / 2;

        for (const row of DECO_ROWS) {
            const c = Phaser.Display.Color.HexStringToColor(row.color);
            for (let col = 0; col < row.count; col++) {
                const x = startX + col * (BRICK_W + BRICK_SPACING) + BRICK_W / 2;
                const y = row.y;
                this.decoGfx.fillStyle(c.color, 1);
                this.decoGfx.fillRoundedRect(
                    x - BRICK_W / 2,
                    y - BRICK_H / 2,
                    BRICK_W,
                    BRICK_H,
                    4,
                );
                // Neon glow border
                this.decoGfx.lineStyle(1, c.color, 0.6);
                this.decoGfx.strokeRoundedRect(
                    x - BRICK_W / 2,
                    y - BRICK_H / 2,
                    BRICK_W,
                    BRICK_H,
                    4,
                );
            }
        }
    }

    startGame() {
        this.cameras.main.fadeOut(300, 10, 10, 26);
        this.time.delayedCall(300, () => {
            this.scene.start('Game', { level: 1 });
        });
    }

    showLeaderboard() {
        this.cameras.main.fadeOut(300, 10, 10, 26);
        this.time.delayedCall(300, () => {
            this.scene.start('Leaderboard');
        });
    }

    shutdown() {
        this.input.keyboard.off('keydown-SPACE');
        this.input.off('pointerdown');
        this.input.keyboard.off('keydown-ENTER');
    }
}
