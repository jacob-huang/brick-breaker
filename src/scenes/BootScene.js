/**
 * BootScene — Preloads and generates all textures programmatically.
 * Transitions to MenuScene when done.
 */
export class BootScene extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // ── Generate background grid texture (40px spacing, 2% opacity white) ──
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = 800;
        bgCanvas.height = 600;
        const bgCtx = bgCanvas.getContext('2d');

        // Solid deep navy background
        bgCtx.fillStyle = '#0a0a1a';
        bgCtx.fillRect(0, 0, 800, 600);

        // Grid lines at 40px spacing
        bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        bgCtx.lineWidth = 1;
        for (let x = 0; x <= 800; x += 40) {
            bgCtx.beginPath();
            bgCtx.moveTo(x, 0);
            bgCtx.lineTo(x, 600);
            bgCtx.stroke();
        }
        for (let y = 0; y <= 600; y += 40) {
            bgCtx.beginPath();
            bgCtx.moveTo(0, y);
            bgCtx.lineTo(800, y);
            bgCtx.stroke();
        }

        this.textures.addCanvas('bg', bgCanvas);

        // ── Generate brick texture (64×24 with neon glow) ──
        const brickCanvas = document.createElement('canvas');
        brickCanvas.width = 64;
        brickCanvas.height = 24;
        const brickCtx = brickCanvas.getContext('2d');
        brickCtx.fillStyle = '#ffffff';
        brickCtx.fillRect(0, 0, 64, 24);
        this.textures.addCanvas('brick', brickCanvas);

        // ── Generate ball texture (16×16 circle, white with blue tint) ──
        const ballCanvas = document.createElement('canvas');
        ballCanvas.width = 16;
        ballCanvas.height = 16;
        const ballCtx = ballCanvas.getContext('2d');
        ballCtx.beginPath();
        ballCtx.arc(8, 8, 7, 0, Math.PI * 2);
        ballCtx.fillStyle = '#ffffff';
        ballCtx.fill();
        ballCtx.beginPath();
        ballCtx.arc(7, 7, 4, 0, Math.PI * 2);
        ballCtx.fillStyle = '#88aaff';
        ballCtx.fill();
        this.textures.addCanvas('ball', ballCanvas);

        // ── Generate power-up texture (16×16 circle) ──
        const puCanvas = document.createElement('canvas');
        puCanvas.width = 16;
        puCanvas.height = 16;
        const puCtx = puCanvas.getContext('2d');
        puCtx.beginPath();
        puCtx.arc(8, 8, 7, 0, Math.PI * 2);
        puCtx.fillStyle = '#00ccff';
        puCtx.fill();
        puCtx.strokeStyle = '#ffffff';
        puCtx.lineWidth = 2;
        puCtx.stroke();
        this.textures.addCanvas('powerup', puCanvas);

        // ── Generate particle texture (8×8 square) ──
        const partCanvas = document.createElement('canvas');
        partCanvas.width = 8;
        partCanvas.height = 8;
        const partCtx = partCanvas.getContext('2d');
        partCtx.fillStyle = '#ffffff';
        partCtx.fillRect(0, 0, 8, 8);
        this.textures.addCanvas('particle', partCanvas);

        // ── Generate paddle texture (100×12 rectangle, solid color for default skin) ──
        const paddleCanvas = document.createElement('canvas');
        paddleCanvas.width = 100;
        paddleCanvas.height = 12;
        const paddleCtx = paddleCanvas.getContext('2d');
        paddleCtx.fillStyle = '#00ccff';
        paddleCtx.fillRect(0, 0, 100, 12);
        this.textures.addCanvas('paddle', paddleCanvas);

        // ── Generate heart texture for HUD ──
        const heartCanvas = document.createElement('canvas');
        heartCanvas.width = 16;
        heartCanvas.height = 16;
        const heartCtx = heartCanvas.getContext('2d');
        heartCtx.fillStyle = '#ff4488';
        heartCtx.font = '14px "Press Start 2P", monospace';
        heartCtx.textAlign = 'center';
        heartCtx.textBaseline = 'middle';
        heartCtx.fillText('♥', 8, 8);
        this.textures.addCanvas('heart', heartCanvas);
    }

    create() {
        this.scene.start('Menu');
    }
}
