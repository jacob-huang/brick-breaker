/**
 * LeaderboardScene — Displays the top 10 scores from the leaderboard API.
 * Accessible from MenuScene via the "LEADERBOARD" button.
 */
const API_URL = '/api/leaderboard';
const TABLE_Y = 70;
const TABLE_WIDTH = 400;
const TABLE_HEIGHT = 400;
const ROW_HEIGHT = 32;
const HEADER_Y = TABLE_Y + 5;
const MAX_VISIBLE_ROWS = 11; // header + 10 entries

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

        // ── Table background ──
        this.tableBg = this.add.graphics();
        this.drawTableBg();

        // ── Header ──
        this.headerTexts = [];
        this.addHeader();

        // ── Data rows ──
        this.rowTexts = [];
        this.addEmptyRows();

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
        this.input.mouse.disableContextMenu();
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            this.scrollSpeed -= deltaY * 0.5;
        });

        // ── Fetch leaderboard ──
        this.fetchLeaderboard();
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
                fontSize: '9px',
                color: '#888888',
            }).setOrigin(0, 0.5);
            this.headerTexts.push(text);
        }
    }

    addEmptyRows() {
        this.rowTexts = [];
        for (let i = 0; i < MAX_VISIBLE_ROWS; i++) {
            this.rowTexts[i] = [
                this.add.text(220, TABLE_Y + 20 + i * ROW_HEIGHT, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '9px',
                    color: '#cccccc',
                }).setOrigin(0, 0.5),
                this.add.text(300, TABLE_Y + 20 + i * ROW_HEIGHT, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '9px',
                    color: '#cccccc',
                }).setOrigin(0, 0.5),
                this.add.text(540, TABLE_Y + 20 + i * ROW_HEIGHT, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '9px',
                    color: '#ffcc00',
                }).setOrigin(0, 0.5),
                this.add.text(620, TABLE_Y + 20 + i * ROW_HEIGHT, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '9px',
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
    }

    renderRows() {
        // Clear all row texts
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

    update(time, delta) {
        // Inertia scroll
        this.scrollSpeed *= 0.92;
        if (Math.abs(this.scrollSpeed) < 0.1) this.scrollSpeed = 0;
        this.scrollY += this.scrollSpeed * delta * 0.05;

        // Clamp scroll
        const maxScroll = Math.max(0, this.leaderboard.length - (MAX_VISIBLE_ROWS - 1)) * ROW_HEIGHT;
        this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, maxScroll);

        // Apply scroll to row texts
        for (let i = 0; i < MAX_VISIBLE_ROWS; i++) {
            const baseY = TABLE_Y + 20 - this.scrollY + i * ROW_HEIGHT;
            for (let j = 0; j < 4; j++) {
                this.rowTexts[i][j].setPosition(
                    this.rowTexts[i][j].x,
                    baseY
                );
            }
        }

        // Hide rows that are scrolled out of view
        for (let i = 0; i < MAX_VISIBLE_ROWS; i++) {
            const baseY = TABLE_Y + 20 - this.scrollY + i * ROW_HEIGHT;
            const visible = baseY >= TABLE_Y - 5 && baseY <= TABLE_Y + TABLE_HEIGHT + 5;
            for (let j = 0; j < 4; j++) {
                this.rowTexts[i][j].setVisible(visible);
            }
        }
    }

    returnToMenu() {
        this.cameras.main.fadeOut(300, 10, 10, 26);
        this.time.delayedCall(300, () => {
            this.scene.start('Menu');
        });
    }
}
