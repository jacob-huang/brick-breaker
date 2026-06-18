/**
 * MenuScene — Start screen with decorative bricks, title, instructions,
 * and blinking "PRESS SPACE TO START" prompt.
 */
export class MenuScene extends Phaser.Scene {
    constructor() {
        super('Menu');
    }

    create() {
        // ── Decorative brick rows (3 rows × 6 bricks) ──
        const decoColors = ['#ff2266', '#ffdd00', '#44dd44'];
        const brickW = 64;
        const brickH = 24;
        const spacing = 4;
        const rowH = brickH + spacing;

        for (let row = 0; row < 3; row++) {
            const y = 160 + row * rowH;
            const totalW = 6 * brickW + 5 * spacing;
            const startX = (800 - totalW) / 2;

            for (let col = 0; col < 6; col++) {
                const x = startX + col * (brickW + spacing) + brickW / 2;
                const gfx = this.add.graphics();
                gfx.fillStyle(Phaser.Display.Color.HexStringToColor(decoColors[row]).color, 1);
                gfx.fillRoundedRect(
                    x - brickW / 2,
                    y - brickH / 2,
                    brickW,
                    brickH,
                    4
                );
                // Neon glow
                gfx.lineStyle(1, Phaser.Display.Color.HexStringToColor(decoColors[row]).color, 0.6);
                gfx.strokeRoundedRect(
                    x - brickW / 2,
                    y - brickH / 2,
                    brickW,
                    brickH,
                    4
                );
            }
        }

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

        this.blinkTimer = 0;
        this.blinkInterval = 500;
        this.visible = true;

        // ── Input ──
        this.input.keyboard.on('keydown-SPACE', () => this.startGame());
        this.input.on('pointerdown', () => this.startGame());
    }

    update(time, delta) {
        // Blink effect
        this.blinkTimer += delta;
        if (this.blinkTimer >= this.blinkInterval) {
            this.blinkTimer = 0;
            this.visible = !this.visible;
            this.startText.setVisible(this.visible);
        }
    }

    startGame() {
        this.cameras.main.fadeOut(300, 10, 10, 26);
        this.time.delayedCall(300, () => {
            this.scene.start('Game', { level: 1 });
        });
    }
}
