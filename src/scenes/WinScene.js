/**
 * WinScene — Victory screen after completing all 5 levels.
 */
export class WinScene extends Phaser.Scene {
    constructor() {
        super('Win');
    }

    init(data) {
        this.score = data.score || 0;
        this.highScore = data.highScore || 0;
    }

    create() {
        // Semi-transparent overlay
        this.add.graphics().fillStyle(0x000000, 0.7).fillRect(0, 0, 800, 600);

        // Title
        this.add.text(400, 200, 'YOU WIN!', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '28px',
            color: '#44dd44',
        }).setOrigin(0.5);

        // Final score
        this.add.text(400, 280, `FINAL SCORE: ${this.score}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#ffcc00',
        }).setOrigin(0.5);

        // High score
        this.add.text(400, 320, `HIGH SCORE: ${this.highScore}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '11px',
            color: '#ff44aa',
        }).setOrigin(0.5);

        // Blinking restart prompt
        this.restartText = this.add.text(400, 420, 'PRESS SPACE TO RESTART', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '11px',
            color: '#00ccff',
        }).setOrigin(0.5);

        this.blinkTimer = 0;
        this.blinkInterval = 500;
        this.visible = true;

        // Input
        this.input.keyboard.on('keydown-SPACE', () => this.restart());
        this.input.on('pointerdown', () => this.restart());
    }

    update(time, delta) {
        this.blinkTimer += delta;
        if (this.blinkTimer >= this.blinkInterval) {
            this.blinkTimer = 0;
            this.visible = !this.visible;
            this.restartText.setVisible(this.visible);
        }
    }

    restart() {
        this.cameras.main.fadeOut(300, 10, 10, 26);
        this.time.delayedCall(300, () => {
            this.scene.start('Game', { level: 1 });
        });
    }
}
