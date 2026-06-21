/**
 * EndScreenScene — Shared base for GameOver and Win screens.
 *
 * Config-driven: title, titleColor, showLevelReached, highScoreY
 * are set via init(cfg). Subclasses pass their config in super.init().
 */
import { LeaderboardMixin, LeaderboardMixinUpdate, LeaderboardMixinShutdown } from './LeaderboardMixin.js';

const API_URL = '/api/leaderboard';
const FORM_Y = 545;
const INPUT_WIDTH = 120;
const INPUT_HEIGHT = 24;

export class EndScreenScene extends Phaser.Scene {
    constructor(key) {
        super(key);
    }

    init(data) {
        this.cfg = data.cfg || {};
        this.score = data.score || 0;
        this.level = data.level || 1;
        this.highScore = data.highScore || 0;
    }

    create() {
        // ── Semi-transparent overlay ──
        this.add.graphics().fillStyle(0x000000, 0.7).fillRect(0, 0, 800, 600);

        // ── Title (configurable) ──
        this.add.text(400, 100, this.cfg.title || 'GAME OVER', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '28px',
            color: this.cfg.titleColor || '#ff4444',
        }).setOrigin(0.5);

        // ── Final score ──
        this.add.text(400, 180, `FINAL SCORE: ${this.score}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#ffcc00',
        }).setOrigin(0.5);

        // ── Level reached (conditional) ──
        if (this.cfg.showLevelReached) {
            this.add.text(400, 210, `LEVEL REACHED: ${this.level}`, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '11px',
                color: '#888888',
            }).setOrigin(0.5);
        }

        // ── High score (configurable Y) ──
        this.add.text(400, this.cfg.highScoreY || 240, `HIGH SCORE: ${this.highScore}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '11px',
            color: '#ff44aa',
        }).setOrigin(0.5);

        // ── Leaderboard table (via mixin) ──
        this.leaderboard = [];
        this.scrollY = 0;
        this.scrollSpeed = 0;
        this.tableBg = this.add.graphics();
        Object.assign(this, LeaderboardMixin({
            tableY: 380,
            tableWidth: 385,
            tableX: 208,
            tableHeight: 170,
            rowHeight: 20,
            maxVisibleRows: 8,
            headerOffset: 5,
            fontSize: '8px',
        }));
        this.drawTableBg(this);
        this.addHeader(this);
        this.addEmptyRows(this);
        this.fetchLeaderboard();

        // ── Submit form (shown when score qualifies) ──
        this.submitFormVisible = false;
        this.submitState = 'idle';
        this.nameInputText = '';
        this.cursorBlinkTimer = 0;
        this.maybeShowSubmitForm();

        // ── Blinking restart prompt ──
        this.restartText = this.add.text(400, 570, 'PRESS SPACE TO RESTART', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '11px',
            color: '#00ccff',
        }).setOrigin(0.5);

        this.blinkTimer = 0;
        this.blinkInterval = 500;

        // Input (guard restart when submit form is active)
        this.input.keyboard.on('keydown-SPACE', () => {
            if (!this.submitFormVisible) this.restart();
        });
        this.input.on('pointerdown', (pointer) => {
            if (!this.submitFormVisible && pointer.y < FORM_Y - 40) {
                this.restart();
            }
        });

        // Scroll input
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            this.scrollSpeed -= deltaY * 0.3;
        });
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
        if (this.submitFormVisible) {
            this.maybeShowSubmitForm();
        }
    }

    maybeShowSubmitForm() {
        if (this.score <= 0) {
            this.hideSubmitForm();
            return;
        }

        // If leaderboard has < 10 entries, always show form
        if (this.leaderboard.length < 10) {
            this.showSubmitForm();
            return;
        }

        // If score > lowest entry, show form
        const lowest = this.leaderboard[this.leaderboard.length - 1].score;
        if (this.score > lowest) {
            this.showSubmitForm();
        } else {
            this.hideSubmitForm();
        }
    }

    showSubmitForm() {
        if (this.submitFormVisible) return;
        this.submitFormVisible = true;
        this.submitState = 'idle';
        this.nameInputText = '';

        this.submitLabel = this.add.text(400, FORM_Y - 20, 'YOUR SCORE QUALIFIED!', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#44dd44',
        }).setOrigin(0.5);

        // Input background
        this.submitInputBg = this.add.graphics();
        this.submitInputBg.fillStyle(0x000000, 0.6);
        this.submitInputBg.fillRect(400 - INPUT_WIDTH / 2, FORM_Y - INPUT_HEIGHT / 2, INPUT_WIDTH, INPUT_HEIGHT);
        this.submitInputBg.lineStyle(1, 0x00ccff, 0.8);
        this.submitInputBg.strokeRect(400 - INPUT_WIDTH / 2, FORM_Y - INPUT_HEIGHT / 2, INPUT_WIDTH, INPUT_HEIGHT);

        // Input text
        this.submitInputText = this.add.text(400, FORM_Y, '_', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#ffffff',
        }).setOrigin(0.5);

        // Submit button
        this.submitButton = this.add.text(400, FORM_Y + 30, 'SUBMIT', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#00ccff',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.submitButton.on('pointerdown', () => this.submitScore());
        this.submitButton.on('pointerover', () => { if (this.submitButton) this.submitButton.setColor('#88eeff'); });
        this.submitButton.on('pointerout', () => { if (this.submitButton) this.submitButton.setColor('#00ccff'); });

        // Enable keyboard input for name (guard against duplicate listeners)
        if (!this._submitKeyHandler) {
            this._submitKeyHandler = (event) => this._onSubmitKey(event);
            this.input.keyboard.on('keydown', this._submitKeyHandler);
        }

        this.updateInputDisplay();
    }

    hideSubmitForm() {
        this.submitFormVisible = false;
        this.submitState = 'idle';

        if (this.submitLabel) { this.submitLabel.destroy(); this.submitLabel = null; }
        if (this.submitInputBg) { this.submitInputBg.destroy(); this.submitInputBg = null; }
        if (this.submitInputText) { this.submitInputText.destroy(); this.submitInputText = null; }
        if (this.submitButton) { this.submitButton.destroy(); this.submitButton = null; }
        if (this.submitResult) { this.submitResult.destroy(); this.submitResult = null; }

        if (this._submitKeyHandler) {
            this.input.keyboard.off('keydown', this._submitKeyHandler);
            this._submitKeyHandler = null;
        }
    }

    _onSubmitKey(event) {
        if (!this.submitFormVisible || this.submitState !== 'idle') return;
        if (event.repeat) return;
        if (event.key === 'Backspace') {
            this.nameInputText = this.nameInputText.slice(0, -1);
        } else if (event.key === 'Enter') {
            this.submitScore();
        } else if (event.key.length === 1 && this.nameInputText.length < 12) {
            const char = event.key.toLowerCase();
            if (char.match(/[a-z0-9 _-]/)) {
                this.nameInputText += char;
            }
        }
    }

    updateInputDisplay() {
        if (!this.submitInputText) return;
        const display = (this.nameInputText || '') + (this.submitState === 'idle' ? '_' : '');
        this.submitInputText.setText(display.length > 0 ? display : '_');
    }

    async submitScore() {
        if (!this.submitFormVisible || this.submitState !== 'idle' || this.nameInputText.trim().length === 0) return;
        this.submitState = 'submitting';
        this.updateInputDisplay();

        // Get current settings from localStorage if available
        let settings = {};
        try {
            settings = JSON.parse(localStorage.getItem('brickBreakerSettings') || '{}');
        } catch {}

        try {
            const result = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: this.nameInputText.trim(),
                    score: this.score,
                    level: this.level,
                    pack: settings.soundPack || 'classic',
                    skins: settings.paddleSkin ? {
                        paddle: settings.paddleSkin,
                        ball: settings.ballSkin || 'default',
                    } : { paddle: 'default', ball: 'default' },
                }),
            });

            const data = await result.json();

            if (!result.ok) {
                this.submitState = 'error';
                this.submitResult = this.add.text(400, FORM_Y + 55, data.error || 'Submission failed', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '8px',
                    color: '#ff4444',
                }).setOrigin(0.5);
                return;
            }

            // Success — find new rank
            this.submitState = 'done';
            this.submitRank = data.findIndex(e => e.name === this.nameInputText.trim() && e.score === this.score) + 1;
            this.submitResult = this.add.text(400, FORM_Y + 55, `NEW #${this.submitRank}!`, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '10px',
                color: '#44dd44',
            }).setOrigin(0.5);

            // Refresh leaderboard table
            await this.fetchLeaderboard();

            // Hide form after 2 seconds
            this.time.delayedCall(2000, () => {
                this.hideSubmitForm();
            });
        } catch {
            this.submitState = 'error';
            this.submitResult = this.add.text(400, FORM_Y + 55, 'SERVER OFFLINE', {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '8px',
                color: '#ff4444',
            }).setOrigin(0.5);
        }
    }

    update(time, delta) {
        // Blink effect
        this.blinkTimer += delta;
        if (this.blinkTimer >= this.blinkInterval) {
            this.blinkTimer = 0;
            this.restartText.setVisible(!this.restartText.visible);
        }

        // Leaderboard scroll (via mixin)
        LeaderboardMixinUpdate(this, time, delta);

        // Cursor blink for submit form
        if (this.submitFormVisible && this.submitState === 'idle' && this.submitInputText) {
            this.cursorBlinkTimer += delta;
            if (this.cursorBlinkTimer >= 500) {
                this.cursorBlinkTimer = 0;
                this.updateInputDisplay();
            }
        }
    }

    restart() {
        this.cameras.main.fadeOut(300, 10, 10, 26);
        this.time.delayedCall(300, () => {
            this.scene.start('Game', { level: 1 });
        });
    }

    shutdown() {
        this.input.keyboard.off('keydown-SPACE');
        this.input.off('pointerdown');
        this.input.off('wheel');
        if (this._submitKeyHandler) {
            this.input.keyboard.off('keydown', this._submitKeyHandler);
            this._submitKeyHandler = null;
        }
        // Destroy empty row texts (C-4) to prevent memory leak
        if (this.rowTexts) {
            this.rowTexts.forEach(row => {
                row.forEach(t => { if (t && !t.destroyed) t.destroy(); });
            });
            this.rowTexts = null;
        }
        if (this.headerTexts) {
            this.headerTexts.forEach(t => { if (t && !t.destroyed) t.destroy(); });
            this.headerTexts = null;
        }
    }
}
