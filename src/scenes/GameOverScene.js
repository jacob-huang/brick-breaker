/**
 * GameOverScene — Game over screen with final score, leaderboard, and submit form.
 */
const API_URL = '/api/leaderboard';
const TABLE_Y = 380;
const TABLE_WIDTH = 400;
const TABLE_HEIGHT = 150;
const ROW_HEIGHT = 20;
const HEADER_Y = TABLE_Y + 5;
const MAX_VISIBLE_ROWS = 8; // header + 7 visible, scrollable
const FORM_Y = 545;
const INPUT_WIDTH = 120;
const INPUT_HEIGHT = 24;

export class GameOverScene extends Phaser.Scene {
    constructor() {
        super('GameOver');
    }

    init(data) {
        this.score = data.score || 0;
        this.level = data.level || 1;
        this.highScore = data.highScore || 0;
    }

    create() {
        // Semi-transparent overlay
        this.add.graphics().fillStyle(0x000000, 0.7).fillRect(0, 0, 800, 600);

        // Title
        this.add.text(400, 100, 'GAME OVER', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '28px',
            color: '#ff4444',
        }).setOrigin(0.5);

        // Final score
        this.add.text(400, 180, `FINAL SCORE: ${this.score}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#ffcc00',
        }).setOrigin(0.5);

        // Level reached
        this.add.text(400, 210, `LEVEL REACHED: ${this.level}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '11px',
            color: '#888888',
        }).setOrigin(0.5);

        // High score
        this.add.text(400, 240, `HIGH SCORE: ${this.highScore}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '11px',
            color: '#ff44aa',
        }).setOrigin(0.5);

        // ── Leaderboard table ──
        this.leaderboard = [];
        this.scrollY = 0;
        this.scrollSpeed = 0;
        this.tableBg = this.add.graphics();
        this.drawTableBg();
        this.headerTexts = [];
        this.addHeader();
        this.rowTexts = [];
        this.addEmptyRows();
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
        this.visible = true;

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

    drawTableBg() {
        this.tableBg.clear();
        this.tableBg.fillStyle(0x000000, 0.5);
        this.tableBg.fillRect(200, TABLE_Y - 10, TABLE_WIDTH, TABLE_HEIGHT + 20);
        this.tableBg.lineStyle(2, 0x00ccff, 0.6);
        this.tableBg.strokeRect(200, TABLE_Y - 10, TABLE_WIDTH, TABLE_HEIGHT + 20);
    }

    addHeader() {
        this.headerTexts = [];
        const headers = ['#', 'USER', 'SCORE', 'DATE & TIME'];
        const colX = [220, 300, 540, 620];
        for (let i = 0; i < headers.length; i++) {
            const text = this.add.text(colX[i], HEADER_Y, headers[i], {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '8px',
                color: '#888888',
            }).setOrigin(0, 0.5);
            this.headerTexts.push(text);
        }
    }

    addEmptyRows() {
        this.rowTexts = [];
        for (let i = 0; i < MAX_VISIBLE_ROWS; i++) {
            this.rowTexts[i] = [
                this.add.text(220, TABLE_Y + 15 + i * ROW_HEIGHT, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '8px',
                    color: '#cccccc',
                }).setOrigin(0, 0.5),
                this.add.text(300, TABLE_Y + 15 + i * ROW_HEIGHT, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '8px',
                    color: '#cccccc',
                }).setOrigin(0, 0.5),
                this.add.text(540, TABLE_Y + 15 + i * ROW_HEIGHT, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '8px',
                    color: '#ffcc00',
                }).setOrigin(0, 0.5),
                this.add.text(620, TABLE_Y + 15 + i * ROW_HEIGHT, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '8px',
                    color: '#888888',
                }).setOrigin(0, 0.5),
            ];
        }
    }

    async fetchLeaderboard() {
        try {
            const res = await fetch(API_URL);
            if (!res.ok) throw new Error('Server offline');
            this.leaderboard = await res.json();
        } catch {
            this.leaderboard = [];
        }
        this.renderRows();
        if (this.submitFormVisible) {
            this.maybeShowSubmitForm();
        }
    }

    renderRows() {
        for (let i = 0; i < MAX_VISIBLE_ROWS; i++) {
            this.rowTexts[i][0].setText('');
            this.rowTexts[i][1].setText('');
            this.rowTexts[i][2].setText('');
            this.rowTexts[i][3].setText('');
        }

        if (this.leaderboard.length === 0) {
            this.rowTexts[0][1].setText('NO SCORES YET');
            this.rowTexts[0][1].setColor('#666666');
            return;
        }

        const visibleCount = Math.min(this.leaderboard.length, MAX_VISIBLE_ROWS - 1);
        for (let i = 0; i < visibleCount; i++) {
            const entry = this.leaderboard[i];
            this.rowTexts[i][0].setText(`#${i + 1}`);
            this.rowTexts[i][1].setText(entry.name);
            this.rowTexts[i][2].setText(entry.score.toString());
            this.rowTexts[i][3].setText(this.formatDate(entry.timestamp));
        }
    }

    formatDate(isoString) {
        const d = new Date(isoString);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm} ${hh}:${mi}`;
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
        this.submitButton.on('pointerover', () => this.submitButton.setColor('#88eeff'));
        this.submitButton.on('pointerout', () => this.submitButton.setColor('#00ccff'));

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

        this.input.keyboard.off('keydown', this._submitKeyHandler);
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
        if (this.submitState !== 'idle' || this.nameInputText.trim().length === 0) return;
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

        // Inertia scroll
        this.scrollSpeed *= 0.92;
        if (Math.abs(this.scrollSpeed) < 0.1) this.scrollSpeed = 0;
        this.scrollY += this.scrollSpeed * delta * 0.05;

        // Clamp scroll
        const maxScroll = Math.max(0, this.leaderboard.length - (MAX_VISIBLE_ROWS - 1)) * ROW_HEIGHT;
        this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, maxScroll);

        // Apply scroll to row texts
        for (let i = 0; i < MAX_VISIBLE_ROWS; i++) {
            const baseY = TABLE_Y + 15 - this.scrollY + i * ROW_HEIGHT;
            for (let j = 0; j < 4; j++) {
                this.rowTexts[i][j].setPosition(
                    this.rowTexts[i][j].x,
                    baseY
                );
            }
        }

        // Hide rows scrolled out of view
        for (let i = 0; i < MAX_VISIBLE_ROWS; i++) {
            const baseY = TABLE_Y + 15 - this.scrollY + i * ROW_HEIGHT;
            const visible = baseY >= TABLE_Y - 5 && baseY <= TABLE_Y + TABLE_HEIGHT + 5;
            for (let j = 0; j < 4; j++) {
                this.rowTexts[i][j].setVisible(visible);
            }
        }

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
}
