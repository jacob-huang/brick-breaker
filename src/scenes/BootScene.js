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

        // ── Generate gradient paddle textures (fire, ice, rainbow) at two widths ──
        const PADDLE_GRADIENTS = [
            { name: 'paddle_fire',    colors: ['#ff4400', '#ff8800'], w: 100 },
            { name: 'paddle_fire_w',  colors: ['#ff4400', '#ff8800'], w: 160 },
            { name: 'paddle_ice',     colors: ['#00ccff', '#88eeff'], w: 100 },
            { name: 'paddle_ice_w',   colors: ['#00ccff', '#88eeff'], w: 160 },
            { name: 'paddle_rainbow', colors: ['#ff0000', '#00ff00'], w: 100 },
            { name: 'paddle_rainbow_w', colors: ['#ff0000', '#00ff00'], w: 160 },
        ];
        PADDLE_GRADIENTS.forEach(p => {
            const c = document.createElement('canvas');
            c.width = p.w;
            c.height = 12;
            const ctx = c.getContext('2d');
            const grad = ctx.createLinearGradient(0, 0, p.w, 0);
            grad.addColorStop(0, p.colors[0]);
            grad.addColorStop(1, p.colors[1]);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, p.w, 12);
            this.textures.addCanvas(p.name, c);
        });

        // ── Generate rainbow ball gradient texture (16×16 circle) ──
        const rainbowBallCanvas = document.createElement('canvas');
        rainbowBallCanvas.width = 16;
        rainbowBallCanvas.height = 16;
        const rbCtx = rainbowBallCanvas.getContext('2d');
        const rbGrad = rbCtx.createLinearGradient(8, 0, 8, 16);
        rbGrad.addColorStop(0, '#ff0000');
        rbGrad.addColorStop(0.2, '#ff8800');
        rbGrad.addColorStop(0.4, '#ffff00');
        rbGrad.addColorStop(0.6, '#00ff00');
        rbGrad.addColorStop(0.8, '#0088ff');
        rbGrad.addColorStop(1, '#8800ff');
        rbCtx.beginPath();
        rbCtx.arc(8, 8, 7, 0, Math.PI * 2);
        rbCtx.fillStyle = rbGrad;
        rbCtx.fill();
        this.textures.addCanvas('ball_rainbow', rainbowBallCanvas);

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
