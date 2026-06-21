/**
 * LeaderboardMixin — Shared leaderboard rendering logic.
 *
 * Extracted from EndScreenScene and LeaderboardScene to eliminate duplication.
 * Mixin adds: drawTableBg, addHeader, addEmptyRows, renderRows, formatDate,
 * and row cleanup on shutdown.
 *
 * Usage:
 *   import { LeaderboardMixin } from './LeaderboardMixin.js';
 *   class MyScene extends Phaser.Scene {
 *       create() {
 *           Object.assign(this, LeaderboardMixin.create({ ...config }));
 *           // ... scene setup ...
 *           this.fetchLeaderboard();
 *       }
 *       update(time, delta) {
 *           LeaderboardMixin.update(this, time, delta);
 *       }
 *       shutdown() {
 *           LeaderboardMixin.shutdown(this);
 *           // ... other cleanup ...
 *       }
 *   }
 */

/**
 * Column left edges: rank=238, name=273, score=383, level=438, date=473
 */
export const COL_X = [238, 273, 383, 438, 473];

/**
 * Create leaderboard state and render helpers.
 * @param {{ tableY: number, tableWidth: number, tableX: number, tableHeight: number, rowHeight: number, maxVisibleRows: number, headerOffset: number, fontSize?: number }} config
 * @returns {{ drawTableBg: Function, addHeader: Function, addEmptyRows: Function, renderRows: Function, formatDate: Function }}
 */
export function LeaderboardMixin(config) {
    const {
        tableY,
        tableWidth,
        tableX,
        tableHeight,
        rowHeight,
        maxVisibleRows,
        headerOffset = 5,
        fontSize = '9px',
    } = config;

    const headerY = tableY + headerOffset;

    /** Draw semi-transparent table background. */
    function drawTableBg(target) {
        target.tableBg.clear();
        target.tableBg.fillStyle(0x000000, 0.5);
        target.tableBg.fillRect(tableX, tableY - 10, tableWidth, tableHeight + 20);
        target.tableBg.lineStyle(2, 0x00ccff, 0.6);
        target.tableBg.strokeRect(tableX, tableY - 10, tableWidth, tableHeight + 20);
    }

    /** Render header text labels. */
    function addHeader(target) {
        target.headerTexts = [];
        const headers = ['#', 'USER', 'SCORE', 'LVL', 'DATE & TIME'];
        for (let i = 0; i < headers.length; i++) {
            const text = target.add.text(COL_X[i], headerY, headers[i], {
                fontFamily: '"Press Start 2P", monospace',
                fontSize,
                color: '#888888',
            }).setOrigin(0, 0.5);
            target.headerTexts.push(text);
        }
    }

    /** Create empty placeholder rows. */
    function addEmptyRows(target) {
        target.rowTexts = [];
        for (let i = 0; i < maxVisibleRows; i++) {
            target.rowTexts[i] = [
                target.add.text(COL_X[0], tableY + 15 + i * rowHeight, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize,
                    color: '#cccccc',
                }).setOrigin(0, 0.5),
                target.add.text(COL_X[1], tableY + 15 + i * rowHeight, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize,
                    color: '#cccccc',
                }).setOrigin(0, 0.5),
                target.add.text(COL_X[2], tableY + 15 + i * rowHeight, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize,
                    color: '#ffcc00',
                }).setOrigin(0, 0.5),
                target.add.text(COL_X[3], tableY + 15 + i * rowHeight, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize,
                    color: '#cccccc',
                }).setOrigin(0, 0.5),
                target.add.text(COL_X[4], tableY + 15 + i * rowHeight, '', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize,
                    color: '#888888',
                }).setOrigin(0, 0.5),
            ];
        }
    }

    /** Render leaderboard data into row texts. */
    function renderRows(target) {
        for (let i = 0; i < maxVisibleRows; i++) {
            target.rowTexts[i][0].setText('');
            target.rowTexts[i][1].setText('');
            target.rowTexts[i][2].setText('');
            target.rowTexts[i][3].setText('');
            target.rowTexts[i][4].setText('');
        }

        if (target.leaderboard.length === 0) {
            target.rowTexts[0][1].setText('NO SCORES YET');
            target.rowTexts[0][1].setColor('#666666');
            return;
        }

        const visibleCount = Math.min(target.leaderboard.length, maxVisibleRows - 1);
        for (let i = 0; i < visibleCount; i++) {
            const entry = target.leaderboard[i];
            target.rowTexts[i][0].setText(`#${i + 1}`);
            target.rowTexts[i][1].setText(entry.name);
            target.rowTexts[i][2].setText(entry.score.toString());
            target.rowTexts[i][3].setText(String(entry.level || '-'));
            target.rowTexts[i][4].setText(formatDate(entry.timestamp));
        }
    }

    /** Format ISO timestamp to DD/MM HH:MM. */
    function formatDate(isoString) {
        const d = new Date(isoString);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm} ${hh}:${mi}`;
    }

    return { drawTableBg, addHeader, addEmptyRows, renderRows, formatDate };
}

/**
 * Update scroll state and apply to row texts.
 * Call from scene's update() method.
 * @param {Phaser.Scene} target
 * @param {number} time
 * @param {number} delta
 */
export function LeaderboardMixinUpdate(target, time, delta) {
    // Inertia scroll
    target.scrollSpeed *= 0.92;
    if (Math.abs(target.scrollSpeed) < 0.1) target.scrollSpeed = 0;
    target.scrollY += target.scrollSpeed * delta * 0.05;

    // Clamp scroll
    const maxScroll = Math.max(0, target.leaderboard.length - (target.maxVisibleRows - 1)) * target.rowHeight;
    target.scrollY = Phaser.Math.Clamp(target.scrollY, 0, maxScroll);

    // Apply scroll to row texts
    for (let i = 0; i < target.maxVisibleRows; i++) {
        const baseY = target.tableY + 15 - target.scrollY + i * target.rowHeight;
        for (let j = 0; j < 5; j++) {
            target.rowTexts[i][j].setPosition(
                target.rowTexts[i][j].x,
                baseY
            );
        }
    }

    // Hide rows scrolled out of view
    for (let i = 0; i < target.maxVisibleRows; i++) {
        const baseY = target.tableY + 15 - target.scrollY + i * target.rowHeight;
        const visible = baseY >= target.tableY - 5 && baseY <= target.tableY + target.tableHeight + 5;
        for (let j = 0; j < 5; j++) {
            target.rowTexts[i][j].setVisible(visible);
        }
    }
}

/**
 * Destroy row and header texts to prevent memory leaks.
 * Call from scene's shutdown() method.
 * @param {Phaser.Scene} target
 */
export function LeaderboardMixinShutdown(target) {
    if (target.rowTexts) {
        target.rowTexts.forEach(row => {
            row.forEach(t => { if (t && !t.destroyed) t.destroy(); });
        });
        target.rowTexts = null;
    }
    if (target.headerTexts) {
        target.headerTexts.forEach(t => { if (t && !t.destroyed) t.destroy(); });
        target.headerTexts = null;
    }
}
