/**
 * GameScene — Core gameplay loop.
 * Manual physics (no Phaser physics engine): AABB collision, sub-stepped ball movement.
 * Entities are plain objects + Graphics rendering (no physics sprites).
 */
import { AudioManager } from '../audio/AudioManager.js';

// ── Constants ──────────────────────────────────────────────────────────
const W = 800;
const H = 600;
const PADDLE_W = 100;
const PADDLE_H = 12;
const PADDLE_Y = H - 40;
const BALL_R = 7;
const BRICK_ROWS = 7;
const BRICK_COLS = 10;
const BRICK_W = 64;
const BRICK_H = 24;
const BRICK_PAD = 4;
const BRICK_TOP = 60;
const BASE_SPEED = 4; // px per sub-step (frame)
const SPEED_INCREMENT = 0.5;
const MAX_SPEED = 6;
const MAX_LIVES = 9;
const START_LIVES = 3;
const TOTAL_LEVELS = 5;
const POWERUP_CHANCE = 0.22;
const POWERUP_SPEED = 80; // px/s
const POWERUP_DURATION_WIDE = 10000; // ms
const POWERUP_DURATION_MULTIBALL = 15000; // ms
const COMBO_WINDOW = 2000; // ms
const COMBO_FADE = 500; // ms before fade
const PADDLE_COOLDOWN = 80; // ms
const SUB_STEP_MAX = 4; // max sub-step to prevent tunneling

// Brick colors and points (top row = row 0)
const BRICK_DEFS = [
    { color: '#ff2266', points: 70 }, // row 0 (top)
    { color: '#ff8800', points: 60 },
    { color: '#ffdd00', points: 50 },
    { color: '#44dd44', points: 40 },
    { color: '#00ccdd', points: 30 },
    { color: '#aa44ff', points: 20 },
    { color: '#ff44aa', points: 10 }, // row 6 (bottom)
];

// Power-up types
const PU_WIDE = 'wide';
const PU_MULTIBALL = 'multiball';
const PU_LIFE = 'life';
const PU_COLORS = { [PU_WIDE]: '#00ccff', [PU_MULTIBALL]: '#ff44aa', [PU_LIFE]: '#ffcc00' };

export class GameScene extends Phaser.Scene {
    constructor() {
        super('Game');
    }

    init(data) {
        this.level = data.level || 1;
        this.score = 0;
        this.lives = START_LIVES;
        this.combo = 0;
        this.comboTimer = 0;
        this.comboActive = false;
        this.paddleCooldown = 0;
        this.audio = AudioManager.instance;
        this.ballSpeed = Math.min(BASE_SPEED + (this.level - 1) * SPEED_INCREMENT, MAX_SPEED);
        this.highScore = this.getHighScore();
    }

    create() {
        // ── Background ──
        this.add.image(400, 300, 'bg');

        // ── Paddle ──
        this.paddleWidth = PADDLE_W;
        this.paddleX = W / 2;
        this.paddleGfx = this.add.graphics();
        this.drawPaddle();

        // ── Balls ──
        this.balls = [];
        this.attachBall();

        // ── Ball glow (single persistent Graphics, reused each frame) ──
        this.ballGlow = this.add.graphics();

        // ── Bricks ──
        this.bricks = [];
        this.createBricks();

        // ── Power-ups ──
        this.powerups = [];
        this.puGfx = this.add.graphics();

        // ── Particles (managed via particle pool) ──
        this.particles = [];

        // ── HUD ──
        this.createHUD();

        // ── Pause overlay ──
        this.pauseBg = this.add.graphics();
        this.pauseText = this.add.text(W / 2, H / 2, 'PAUSED', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '28px',
            color: '#00ccff',
        }).setOrigin(0.5).setVisible(false);
        this.pauseSub = this.add.text(W / 2, H / 2 + 40, 'Press P to Resume', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '11px',
            color: '#888888',
        }).setOrigin(0.5).setVisible(false);

        // ── Input ──
        this.cursors = this.input.keyboard.createCursorKeys();
        this.adKeys = this.input.keyboard.addKeys({
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        });
        this.input.keyboard.on('keydown-SPACE', () => this.launchAll());
        this.input.keyboard.on('keydown-P', () => this.togglePause());
        this.input.keyboard.on('keydown-ESC', () => this.togglePause());
        this.input.keyboard.on('keydown-M', () => this.toggleMute());
        this.input.on('pointermove', (pointer) => {
            if (this.isActive) {
                this.paddleX = Phaser.Math.Clamp(pointer.x, this.paddleWidth / 2, W - this.paddleWidth / 2);
            }
        });

        // ── Wide paddle timer ──
        this.wideTimer = null;

        this.isActive = true;
    }

    // ── HUD ──────────────────────────────────────────────────────────
    createHUD() {
        this.scoreText = this.add.text(10, 10, 'SCORE: 0', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#00ffcc',
        });
        this.levelText = this.add.text(W / 2, 10, `LEVEL ${this.level}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#ffcc00',
        }).setOrigin(0.5);
        this.livesText = this.add.text(W - 10, 10, `♥ ${this.lives}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#ff4488',
        }).setOrigin(1, 0);
        this.comboText = this.add.text(W / 2, 35, '', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#ff8800',
        }).setOrigin(0.5).setVisible(false);
        this.highScoreText = this.add.text(10, 30, `BEST: ${this.highScore}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '8px',
            color: '#888888',
        });

        // ── Sound toggle button ──
        this.muteText = this.add.text(W - 10, 30, '🔊', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#888888',
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        this.muteText.on('pointerdown', () => this.toggleMute());
        this.muteText.on('pointerover', () => this.muteText.setAlpha(0.8));
        this.muteText.on('pointerout', () => this.muteText.setAlpha(1));
        this.muted = false;
    }

    // ── High Score ───────────────────────────────────────────────────
    getHighScore() {
        try { return parseInt(localStorage.getItem('brickBreakerHighScore') || '0', 10); }
        catch { return 0; }
    }

    saveHighScore(score) {
        try {
            const current = this.getHighScore();
            if (score > current) {
                localStorage.setItem('brickBreakerHighScore', String(score));
                this.highScore = score;
                return true;
            }
        } catch { /* ignore */ }
        return false;
    }

    updateHUD() {
        this.scoreText.setText(`SCORE: ${this.score}`);
        this.livesText.setText(`♥ ${this.lives}`);
        this.levelText.setText(`LEVEL ${this.level}`);
        this.highScoreText.setText(`BEST: ${this.highScore}`);

        if (this.comboActive && this.combo > 1) {
            const remaining = COMBO_WINDOW - this.comboTimer;
            const fading = remaining <= COMBO_FADE;
            const alpha = fading ? remaining / COMBO_FADE : 1;
            this.comboText.setText(`${this.combo}x COMBO!`).setAlpha(alpha).setVisible(true);
        } else {
            this.comboText.setVisible(false);
        }
    }

    // ── Ball management ──────────────────────────────────────────────
    attachBall() {
        this.balls.push({
            x: this.paddleX,
            y: PADDLE_Y - BALL_R,
            vx: 0,
            vy: 0,
            attached: true,
            launched: false,
            brickHitThisFrame: false,
            trailX: this.paddleX, // previous position for trail
            trailY: PADDLE_Y - BALL_R,
        });
    }

    launchAll() {
        this.audio.resume();
        this.balls.forEach(b => {
            if (b.attached) {
                b.attached = false;
                b.launched = true;
                b.trailX = b.x;
                b.trailY = b.y;
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
                b.vx = Math.cos(angle) * this.ballSpeed;
                b.vy = Math.sin(angle) * this.ballSpeed;
            }
        });
    }

    // ── Bricks ───────────────────────────────────────────────────────
    createBricks() {
        this.brickGfx = this.add.graphics();
        const totalW = BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_PAD;
        const startX = (W - totalW) / 2 + BRICK_W / 2;

        // Level-specific patterns
        const patterns = [
            this.patterns.solid,      // Level 1
            this.patterns.checker,    // Level 2
            this.patterns.fortress,   // Level 3
            this.patterns.diamond,    // Level 4
            this.patterns.pyramid,    // Level 5
        ];
        const pattern = patterns[this.level - 1] || patterns[0];

        for (let row = 0; row < BRICK_ROWS; row++) {
            for (let col = 0; col < BRICK_COLS; col++) {
                if (!pattern(row, col)) continue;
                const x = startX + col * (BRICK_W + BRICK_PAD);
                const y = BRICK_TOP + row * (BRICK_H + BRICK_PAD) + BRICK_H / 2;
                this.bricks.push({
                    x, y,
                    w: BRICK_W,
                    h: BRICK_H,
                    row,
                    col,
                    active: true,
                    color: BRICK_DEFS[row].color,
                    points: BRICK_DEFS[row].points,
                });
            }
        }
    }

    // ── Brick Patterns ───────────────────────────────────────────────
    patterns = {
        // All cells filled
        solid: () => true,

        // Alternating bricks (checkerboard)
        checker: (row, col) => (row + col) % 2 === 0,

        // Fortress: thick bottom rows, gaps at top
        fortress: (row, col) => {
            if (row >= 4) return true;          // Bottom 3 rows solid
            if (row === 3) return col % 2 === 0; // Row 4: every other
            if (row === 2) return col >= 3 && col <= 6; // Row 3: center 4
            if (row === 1) return col >= 4 && col <= 5; // Row 2: center 2
            return col >= 4 && col <= 5;         // Row 1: center 2
        },

        // Diamond shape
        diamond: (row, col) => {
            const midRow = 3;
            const midCol = 4.5;
            const dr = Math.abs(row - midRow);
            const dc = Math.abs(col - midCol);
            return dr + dc <= 3.5;
        },

        // Pyramid: wide base narrowing to top
        pyramid: (row, col) => {
            const widths = [2, 4, 6, 8, 10, 10, 10]; // cols per row (0-indexed)
            const w = widths[row] || 0;
            const offset = Math.floor((BRICK_COLS - w) / 2);
            return col >= offset && col < offset + w;
        },
    };

    drawBricks() {
        this.brickGfx.clear();
        this.bricks.forEach(b => {
            if (!b.active) return;
            const c = Phaser.Display.Color.HexStringToColor(b.color);
            this.brickGfx.fillStyle(c.color, 1);
            this.brickGfx.fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 4);
            // Neon glow border
            this.brickGfx.lineStyle(1, c.color, 0.5);
            this.brickGfx.strokeRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 4);
        });
    }

    // ── Paddle rendering ─────────────────────────────────────────────
    drawPaddle() {
        this.paddleGfx.clear();
        const color = this.paddleWidth > PADDLE_W ? '#00ffcc' : '#00ccff';
        const c = Phaser.Display.Color.HexStringToColor(color);
        this.paddleGfx.fillStyle(c.color, 1);
        this.paddleGfx.fillRoundedRect(
            this.paddleX - this.paddleWidth / 2,
            PADDLE_Y - PADDLE_H / 2,
            this.paddleWidth,
            PADDLE_H,
            4
        );
        // Glow
        this.paddleGfx.lineStyle(2, c.color, 0.4);
        this.paddleGfx.strokeRoundedRect(
            this.paddleX - this.paddleWidth / 2,
            PADDLE_Y - PADDLE_H / 2,
            this.paddleWidth,
            PADDLE_H,
            4
        );
    }

    // ── Power-ups ────────────────────────────────────────────────────
    spawnPowerup(x, y) {
        if (Math.random() > POWERUP_CHANCE) return;
        const types = [PU_WIDE, PU_MULTIBALL, PU_LIFE];
        const type = types[Math.floor(Math.random() * types.length)];
        this.powerups.push({ x, y, vy: POWERUP_SPEED / 60, type, active: true });
    }

    drawPowerups() {
        this.puGfx.clear();
        this.powerups.forEach(pu => {
            if (!pu.active) return;
            const c = Phaser.Display.Color.HexStringToColor(PU_COLORS[pu.type]);
            this.puGfx.fillStyle(c.color, 1);
            this.puGfx.fillCircle(pu.x, pu.y, 8);
            this.puGfx.lineStyle(2, 0xffffff, 0.6);
            this.puGfx.strokeCircle(pu.x, pu.y, 8);
        });
    }

    applyPowerup(type) {
        this.audio.play('powerup');
        switch (type) {
            case PU_WIDE:
                this.paddleWidth = 160;
                this.drawPaddle();
                if (this.wideTimer) this.wideTimer.remove();
                this.wideTimer = this.time.delayedCall(POWERUP_DURATION_WIDE, () => {
                    this.paddleWidth = PADDLE_W;
                    this.drawPaddle();
                });
                break;
            case PU_MULTIBALL:
                // Ensure at least one launched ball exists
                const hasLaunched = this.balls.some(b => !b.attached);
                if (!hasLaunched) {
                    this.balls.forEach(b => {
                        b.attached = false;
                        b.launched = true;
                        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
                        b.vx = Math.cos(angle) * this.ballSpeed;
                        b.vy = Math.sin(angle) * this.ballSpeed;
                    });
                }
                this.addMultiBall();
                break;
            case PU_LIFE:
                this.lives = Math.min(this.lives + 1, MAX_LIVES);
                this.updateHUD();
                break;
        }
    }

    addMultiBall() {
        const existing = this.balls.filter(b => !b.attached);
        const toAdd = Math.min(8 - this.balls.length, existing.length);
        for (let i = 0; i < toAdd; i++) {
            const src = existing[i];
            if (!src) continue;
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
            this.balls.push({
                x: src.x,
                y: src.y,
                vx: Math.cos(angle) * this.ballSpeed,
                vy: Math.sin(angle) * this.ballSpeed,
                attached: false,
                launched: true,
                brickHitThisFrame: false,
                trailX: src.x,
                trailY: src.y,
            });
        }
    }

    // ── Particles ────────────────────────────────────────────────────
    spawnParticles(x, y, color, count = 12) {
        const c = Phaser.Display.Color.HexStringToColor(color).color;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            const px = this.add.graphics();
            px.fillStyle(c, 1);
            px.fillCircle(0, 0, 3);
            px.setPosition(x, y);
            this.tweens.add({
                targets: px,
                x: x + Math.cos(angle) * speed * 40,
                y: y + Math.sin(angle) * speed * 40 + 30, // gravity
                alpha: 0,
                duration: 400 + Math.random() * 300,
                ease: 'Power1',
                onComplete: () => px.destroy(),
            });
            this.particles.push(px);
        }
    }

    // ── Combo ────────────────────────────────────────────────────────
    onBrickHit() {
        this.combo++;
        this.comboTimer = 0;
        this.comboActive = true;
    }

    // ── Pause ────────────────────────────────────────────────────────
    togglePause() {
        if (!this.isActive) return;
        this.paused = !this.paused;
        if (this.paused) {
            // Show overlay
            this.pauseBg.fillStyle(0x000000, 0.6);
            this.pauseBg.fillRect(0, 0, W, H);
            this.pauseText.setVisible(true);
            this.pauseSub.setVisible(true);
        } else {
            // Hide overlay
            this.pauseBg.clear();
            this.pauseText.setVisible(false);
            this.pauseSub.setVisible(false);
        }
    }

    // ── Sound Toggle ─────────────────────────────────────────────────
    toggleMute() {
        this.muted = !this.audio.toggle();
        this.muteText.setText(this.muted ? '🔇' : '🔊');
    }

    // ── Collision detection ──────────────────────────────────────────
    subStepBall(ball, dt) {
        if (ball.attached) {
            ball.x = this.paddleX;
            ball.y = PADDLE_Y - BALL_R;
            return;
        }

        const steps = Math.ceil(Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) / SUB_STEP_MAX);
        const svx = ball.vx / steps;
        const svy = ball.vy / steps;

        // One brick hit per frame — reset once before sub-steps
        ball.brickHitThisFrame = false;

        for (let s = 0; s < steps; s++) {
            ball.x += svx;
            ball.y += svy;

            // ── Wall bounces ──
            if (ball.x - BALL_R <= 0) {
                ball.x = BALL_R;
                ball.vx = Math.abs(ball.vx);
                this.audio.play('bounce');
            }
            if (ball.x + BALL_R >= W) {
                ball.x = W - BALL_R;
                ball.vx = -Math.abs(ball.vx);
                this.audio.play('bounce');
            }
            if (ball.y - BALL_R <= 0) {
                ball.y = BALL_R;
                ball.vy = Math.abs(ball.vy);
                this.audio.play('bounce');
            }

            // ── Ball-paddle bounce ──
            if (this.paddleCooldown <= 0) {
                const px = this.paddleX;
                const py = PADDLE_Y;
                const pw = this.paddleWidth / 2;
                const ph = PADDLE_H / 2;
                if (
                    ball.x >= px - pw && ball.x <= px + pw &&
                    ball.y + BALL_R >= py - ph && ball.y - BALL_R <= py + ph &&
                    ball.vy > 0
                ) {
                    const hitPos = (ball.x - px) / pw; // -1 to +1
                    const angle = Phaser.Math.Linear(-150, -30, (hitPos + 1) / 2) * (Math.PI / 180);
                    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                    ball.vx = Math.cos(angle) * speed;
                    ball.vy = Math.sin(angle) * speed;
                    ball.y = py - ph - BALL_R;
                    this.paddleCooldown = PADDLE_COOLDOWN;
                    this.audio.play('bounce');
                }
            }

            // ── Ball-brick collision ──
            if (!ball.brickHitThisFrame) {
                for (const brick of this.bricks) {
                    if (!brick.active) continue;
                    if (this.aabbBallBrick(ball, brick)) {
                        brick.active = false;
                        this.reflectBallOffBrick(ball, brick);
                        this.onBrickHit();
                        this.score += brick.points * this.combo;
                        this.spawnParticles(brick.x, brick.y, brick.color);
                        this.spawnPowerup(brick.x, brick.y);
                        this.audio.play('brick');
                        // Screen shake on brick destruction
                        this.cameras.main.shake(80, 0.003);
                        ball.brickHitThisFrame = true;
                        this.updateHUD();
                        break;
                    }
                }
            }
        }

        // ── Ball below paddle — lose life ──
        if (ball.y - BALL_R > H) {
            return 'dead';
        }
        return null;
    }

    aabbBallBrick(ball, brick) {
        // Find closest point on brick rectangle to ball center
        const closestX = Phaser.Math.Clamp(ball.x, brick.x - brick.w / 2, brick.x + brick.w / 2);
        const closestY = Phaser.Math.Clamp(ball.y, brick.y - brick.h / 2, brick.y + brick.h / 2);
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        return (dx * dx + dy * dy) < (BALL_R * BALL_R);
    }

    reflectBallOffBrick(ball, brick) {
        // Calculate overlap on each axis to determine bounce direction
        const closestX = Phaser.Math.Clamp(ball.x, brick.x - brick.w / 2, brick.x + brick.w / 2);
        const closestY = Phaser.Math.Clamp(ball.y, brick.y - brick.h / 2, brick.y + brick.h / 2);
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;

        if (Math.abs(dx) > Math.abs(dy)) {
            // Hit left or right side — reflect horizontal
            ball.vx = -ball.vx;
            ball.x += dx > 0 ? 1 : -1;
        } else {
            // Hit top or bottom — reflect vertical
            ball.vy = -ball.vy;
            ball.y += dy > 0 ? 1 : -1;
        }
    }

    // ── Update ───────────────────────────────────────────────────────
    update(time, delta) {
        if (!this.isActive || this.paused) return;

        // ── Paddle keyboard movement ──
        const paddleSpeed = 7;
        if (this.cursors.left.isDown || this.adKeys.left.isDown) {
            this.paddleX = Phaser.Math.Clamp(this.paddleX - paddleSpeed, this.paddleWidth / 2, W - this.paddleWidth / 2);
        }
        if (this.cursors.right.isDown || this.adKeys.right.isDown) {
            this.paddleX = Phaser.Math.Clamp(this.paddleX + paddleSpeed, this.paddleWidth / 2, W - this.paddleWidth / 2);
        }
        this.drawPaddle();

        // ── Paddle cooldown ──
        if (this.paddleCooldown > 0) this.paddleCooldown -= delta;

        // ── Combo timer ──
        if (this.comboActive) {
            this.comboTimer += delta;
            if (this.comboTimer >= COMBO_WINDOW) {
                this.comboActive = false;
                this.combo = 0;
            }
        }

        // ── Auto-launch attached ball on pointer click ──
        if (this.balls.some(b => b.attached) && this.input.activePointer.isDown) {
            this.launchAll();
        }

        // ── Update balls ──
        const toRemove = [];
        this.balls.forEach((ball, i) => {
            const result = this.subStepBall(ball, delta);
            if (result === 'dead') {
                toRemove.push(i);
            }
        });

        // Remove dead balls (in reverse order)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.balls.splice(toRemove[i], 1);
        }

        // ── All balls dead — lose life (fires once per death event) ──
        if (this.balls.length === 0 && !this.waitingForBall) {
            this.waitingForBall = true;
            this.lives--;
            this.audio.play('lifeLost');
            this.updateHUD();
            if (this.lives <= 0) {
                this.gameOver();
                return;
            }
            this.time.delayedCall(800, () => {
                this.balls = [];
                this.attachBall();
            });
        }
        // Reset flag when a ball exists (attached or launched)
        if (this.balls.length > 0) {
            this.waitingForBall = false;
        }

        // ── Draw ball trail + glow (single persistent Graphics) ──
        this.ballGlow.clear();
        this.balls.forEach(b => {
            if (b.attached) return;
            // Draw trail (single ghost circle at previous position)
            const dx = b.x - b.trailX;
            const dy = b.y - b.trailY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.5) {
                const trailAlpha = Math.min(0.2, dist * 0.02);
                const trailRadius = Math.min(BALL_R, 3 + dist * 0.3);
                this.ballGlow.fillStyle(0x88aaff, trailAlpha);
                this.ballGlow.fillCircle(b.trailX, b.trailY, trailRadius);
            }
            // Update trail position
            b.trailX = b.x;
            b.trailY = b.y;
            // Draw ball glow
            this.ballGlow.fillStyle(0xffffff, 0.3);
            this.ballGlow.fillCircle(b.x, b.y, BALL_R + 3);
            this.ballGlow.fillStyle(0x88aaff, 0.5);
            this.ballGlow.fillCircle(b.x, b.y, BALL_R);
        });

        // ── Update power-ups ──
        this.powerups.forEach(pu => {
            if (!pu.active) return;
            pu.y += pu.vy;
            // Check paddle overlap
            if (
                pu.x >= this.paddleX - this.paddleWidth / 2 &&
                pu.x <= this.paddleX + this.paddleWidth / 2 &&
                pu.y >= PADDLE_Y - PADDLE_H / 2 &&
                pu.y <= PADDLE_Y + PADDLE_H / 2 + 10
            ) {
                pu.active = false;
                this.applyPowerup(pu.type);
            }
            // Remove if off screen
            if (pu.y > H + 20) pu.active = false;
        });
        this.powerups = this.powerups.filter(p => p.active);
        this.drawPowerups();

        // ── Draw bricks ──
        this.drawBricks();

        // ── Update HUD ──
        this.updateHUD();

        // ── Check level complete ──
        if (this.bricks.every(b => !b.active)) {
            this.levelComplete();
        }
    }

    // ── Level complete / Game over ───────────────────────────────────
    levelComplete() {
        this.isActive = false;
        this.saveHighScore(this.score);
        this.audio.play('levelComplete');
        if (this.level >= TOTAL_LEVELS) {
            this.time.delayedCall(500, () => {
                this.scene.start('Win', { score: this.score, highScore: this.highScore });
            });
        } else {
            this.level++;
            this.ballSpeed = Math.min(BASE_SPEED + (this.level - 1) * SPEED_INCREMENT, MAX_SPEED);
            this.cameras.main.fadeOut(500, 10, 10, 26);
            this.time.delayedCall(500, () => {
                // Reset state for next level
                this.bricks = [];
                this.powerups = [];
                this.particles = [];
                this.balls = [];
                this.combo = 0;
                this.comboActive = false;
                this.comboTimer = 0;
                this.paddleWidth = PADDLE_W;
                if (this.wideTimer) this.wideTimer.remove();
                this.createBricks();
                this.attachBall();
                this.drawPaddle();
                this.drawBricks();
                this.drawPowerups();
                this.updateHUD();
                this.cameras.main.fadeIn(500, 10, 10, 26);
                this.isActive = true;
            });
        }
    }

    gameOver() {
        this.isActive = false;
        this.saveHighScore(this.score);
        this.audio.play('gameOver');
        this.cameras.main.fadeOut(500, 10, 10, 26);
        this.time.delayedCall(500, () => {
            this.scene.start('GameOver', { score: this.score, level: this.level, highScore: this.highScore });
        });
    }
}
