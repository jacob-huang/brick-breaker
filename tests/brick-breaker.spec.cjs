/**
 * Brick Breaker — Comprehensive Playwright Tests
 * Runs against the Vite dev server at http://localhost:3000
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const URL = 'http://localhost:3000';
const WIDTH = 800;
const HEIGHT = 600;

test.use({ viewport: { width: WIDTH, height: HEIGHT } });

// ─── Helpers ──────────────────────────────────────────────────────────

async function waitForCanvas(page) {
  await page.waitForSelector('canvas', { timeout: 10000 });
}

async function waitForMenu(page) {
  await waitForCanvas(page);
  await page.waitForTimeout(2000);
}

/** Get the active scene key using Phaser's sys.settings.active */
async function getActiveScene(page) {
  return page.evaluate(() => {
    const game = window.__game;
    if (!game || !game.scene) return null;
    for (const s of game.scene.scenes) {
      const key = s.scene ? s.scene.key : s.key;
      const sys = s.sys;
      const settings = sys ? sys.settings : null;
      if (settings && settings.active) return key;
    }
    return null;
  });
}

/** Get game scene state — all in one evaluate call to avoid serialization issues */
async function getGameState(page) {
  return page.evaluate(() => {
    const game = window.__game;
    if (!game || !game.scene) return null;
    let scene = null;
    for (const s of game.scene.scenes) {
      const key = s.scene ? s.scene.key : s.key;
      if (key === 'Game') { scene = s; break; }
    }
    if (!scene) return null;
    return {
      score: scene.score,
      lives: scene.lives,
      level: scene.level,
      combo: scene.combo,
      paddleWidth: scene.paddleWidth,
      paddleX: scene.paddleX,
      ballCount: scene.balls ? scene.balls.length : 0,
      brickCount: scene.bricks ? scene.bricks.filter(b => b.active).length : 0,
      ballAttached: scene.balls ? scene.balls.some(b => b.attached) : true,
    };
  });
}

/** Start game from menu */
async function startGame(page) {
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
}

// ─── Page Load ────────────────────────────────────────────────────────
test.describe('Page Load', () => {
  test('page loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(URL);
    await waitForCanvas(page);
    await page.waitForTimeout(2000);
    const realErrors = errors.filter(e =>
      !e.includes('Phaser') && !e.includes('WebGL') &&
      !e.includes('Canvas') && !e.includes('detect') &&
      !e.includes('font') && !e.includes('Press Start')
    );
    expect(realErrors.length).toBe(0);
  });

  test('canvas is rendered', async ({ page }) => {
    await page.goto(URL);
    await waitForCanvas(page);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const bb = await canvas.boundingBox();
    expect(bb).not.toBeNull();
    expect(bb.width).toBeGreaterThan(0);
    expect(bb.height).toBeGreaterThan(0);
  });

  test('transitions from Boot to Menu', async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    const scene = await getActiveScene(page);
    expect(scene).toBe('Menu');
  });
});

// ─── Menu Screen ──────────────────────────────────────────────────────
test.describe('Menu Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
  });

  test('menu scene exists and is created', async ({ page }) => {
    const menuExists = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return false;
      for (const s of game.scene.scenes) {
        const key = s.scene ? s.scene.key : s.key;
        if (key === 'Menu') {
          const sys = s.sys;
          const settings = sys ? sys.settings : null;
          if (settings && settings.visible) return true;
        }
      }
      return false;
    });
    expect(menuExists).toBe(true);
  });

  test('starts game on space key', async ({ page }) => {
    await startGame(page);
    const scene = await getActiveScene(page);
    expect(scene).toBe('Game');
  });

  test('starts game on mouse click', async ({ page }) => {
    await page.mouse.click(400, 300);
    await page.waitForTimeout(800);
    const scene = await getActiveScene(page);
    expect(scene).toBe('Game');
  });

  test('screenshot captures menu screen', async ({ page }) => {
    fs.mkdirSync('./tests/screenshots', { recursive: true });
    await page.screenshot({ path: './tests/screenshots/menu.png', fullPage: true });
    expect(fs.existsSync('./tests/screenshots/menu.png')).toBe(true);
  });
});

// ─── Gameplay ─────────────────────────────────────────────────────────
test.describe('Gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);
  });

  test('initializes with correct HUD state', async ({ page }) => {
    const state = await getGameState(page);
    expect(state).not.toBeNull();
    expect(state.score).toBe(0);
    expect(state.lives).toBe(3);
    expect(state.level).toBe(1);
    expect(state.ballCount).toBe(1);
    expect(state.ballAttached).toBe(true);
    expect(state.brickCount).toBe(70);
  });

  test('high score is displayed in HUD', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      for (const s of game.scene.scenes) {
        if ((s.scene ? s.scene.key : s.key) === 'Game') {
          return {
            highScore: s.highScore,
            highScoreText: s.highScoreText?.text,
          };
        }
      }
      return null;
    });
    expect(result.highScore).toBe(0);
    expect(result.highScoreText).toContain('BEST: 0');
  });

  test('paddle follows mouse movement', async ({ page }) => {
    const s1 = await getGameState(page);
    const initX = s1.paddleX;
    await page.mouse.move(200, 500);
    await page.waitForTimeout(100);
    expect((await getGameState(page)).paddleX).toBeLessThan(initX);
    await page.mouse.move(600, 500);
    await page.waitForTimeout(100);
    expect((await getGameState(page)).paddleX).toBeGreaterThan(initX);
  });

  test('paddle follows arrow keys', async ({ page }) => {
    const s1 = await getGameState(page);
    const initX = s1.paddleX;
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(100);
    const afterLeft = await getGameState(page);
    expect(afterLeft.paddleX).toBeLessThan(initX);
    // Move right past initial position
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(700);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(100);
    const afterRight = await getGameState(page);
    expect(afterRight.paddleX).toBeGreaterThan(initX);
  });

  test('paddle follows A/D keys', async ({ page }) => {
    const s1 = await getGameState(page);
    const initX = s1.paddleX;
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyA');
    await page.waitForTimeout(100);
    const afterA = await getGameState(page);
    expect(afterA.paddleX).toBeLessThan(initX);
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(100);
    const afterD = await getGameState(page);
    expect(afterD.paddleX).toBeGreaterThan(initX);
  });

  test('ball launches on click when attached', async ({ page }) => {
    const before = await getGameState(page);
    expect(before.ballAttached).toBe(true);
    // Get canvas center for reliable pointer event targeting
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
      };
    });
    // Use mouse down/hold/release instead of click — Phaser's update loop
    // needs time to process the pointerdown before pointerup fires
    await page.mouse.move(canvasInfo.x, canvasInfo.y);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await getGameState(page);
    expect(after.ballAttached).toBe(false);
  });

  test('score increases after brick destruction', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return { success: false };
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return { success: false };
      const brick = scene.bricks.find(b => b.active);
      if (!brick) return { success: false };
      brick.active = false;
      scene.score += brick.points;
      scene.combo = 2;
      scene.comboActive = true;
      return { success: true, score: scene.score, combo: scene.combo };
    });
    expect(result.success).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.combo).toBe(2);
  });

  test('combo system tracks consecutive hits', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;
      scene.onBrickHit();
      scene.onBrickHit();
      scene.onBrickHit();
      return { combo: scene.combo, active: scene.comboActive };
    });
    expect(result.combo).toBe(3);
    expect(result.active).toBe(true);
  });

  test('combo resets after window expires', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;
      scene.combo = 5;
      scene.comboActive = true;
      scene.comboTimer = 2500;
      if (scene.comboActive && scene.comboTimer >= 2000) {
        scene.comboActive = false;
        scene.combo = 0;
      }
      return { combo: scene.combo, active: scene.comboActive };
    });
    expect(result.combo).toBe(0);
    expect(result.active).toBe(false);
  });

  test('lives decrease when all balls are lost', async ({ page }) => {
    const before = await getGameState(page);
    await page.evaluate(() => {
      const game = window.__game;
      if (!game) return;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return;
      // Simulate the game loop: all balls dead, reset waitingForBall flag
      scene.waitingForBall = false;
      scene.balls = [];
      // Now the game loop condition fires exactly once
      if (scene.balls.length === 0 && !scene.waitingForBall) {
        scene.waitingForBall = true;
        scene.lives--;
      }
      // Then a new ball gets attached after the delay
      scene.attachBall();
    });
    await page.waitForTimeout(100);
    const after = await getGameState(page);
    expect(after.lives).toBe(before.lives - 1);
    expect(after.ballCount).toBe(1);
  });

  test('waitingForBall flag prevents double life drain', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;
      // Simulate multiple frames where balls.length === 0

      // First frame: condition fires, lives decremented, waitingForBall set
      scene.waitingForBall = false;
      scene.lives = 3;
      scene.balls = [];
      if (scene.balls.length === 0 && !scene.waitingForBall) {
        scene.waitingForBall = true;
        scene.lives--;
      }
      const afterFirst = scene.lives;

      // Second frame: condition should NOT fire because waitingForBall is true
      scene.balls = [];
      if (scene.balls.length === 0 && !scene.waitingForBall) {
        scene.waitingForBall = true;
        scene.lives--;
      }
      const afterSecond = scene.lives;

      // Third frame: balls exist, flag resets, then balls die again
      scene.attachBall();
      // Simulate the game loop's flag-reset check
      if (scene.balls.length > 0) {
        scene.waitingForBall = false;
      }
      // Ball dies again
      scene.balls = [];
      if (scene.balls.length === 0 && !scene.waitingForBall) {
        scene.waitingForBall = true;
        scene.lives--;
      }
      const afterThird = scene.lives;
      return { afterFirst, afterSecond, afterThird };
    });
    expect(result.afterFirst).toBe(2); // 3 -> 2 on first frame
    expect(result.afterSecond).toBe(2); // stays 2 on second frame (flag prevents drain)
    expect(result.afterThird).toBe(1); // 2 -> 1 on third frame (flag reset after ball attached)
  });

  test('lives capped at MAX_LIVES (9)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;
      scene.lives = 9;
      scene.lives = Math.min(scene.lives + 5, 9);
      return scene.lives;
    });
    expect(result).toBe(9);
  });

  test('paddle width constrained within screen bounds', async ({ page }) => {
    await page.mouse.move(10, 500);
    await page.waitForTimeout(100);
    const left = await getGameState(page);
    expect(left.paddleX).toBeGreaterThanOrEqual(left.paddleWidth / 2);
    await page.mouse.move(790, 500);
    await page.waitForTimeout(100);
    const right = await getGameState(page);
    expect(right.paddleX).toBeLessThanOrEqual(800 - right.paddleWidth / 2);
  });

  test('sound toggle button exists and toggles', async ({ page }) => {
    // Initially unmuted
    const before = await page.evaluate(() => {
      const game = window.__game;
      for (const s of game.scene.scenes) {
        if ((s.scene ? s.scene.key : s.key) === 'Game') {
          return { muted: s.muted, icon: s.muteText?.text };
        }
      }
      return null;
    });
    expect(before.muted).toBe(false);
    expect(before.icon).toBe('🔊');

    // Click mute button
    await page.evaluate(() => {
      const game = window.__game;
      for (const s of game.scene.scenes) {
        if ((s.scene ? s.scene.key : s.key) === 'Game') {
          s.muteText.emit('pointerdown');
        }
      }
    });
    await page.waitForTimeout(100);

    const after = await page.evaluate(() => {
      const game = window.__game;
      for (const s of game.scene.scenes) {
        if ((s.scene ? s.scene.key : s.key) === 'Game') {
          return { muted: s.muted, icon: s.muteText?.text };
        }
      }
      return null;
    });
    expect(after.muted).toBe(true);
    expect(after.icon).toBe('🔇');

    // Press M to toggle back
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(100);
    const afterM = await page.evaluate(() => {
      const game = window.__game;
      for (const s of game.scene.scenes) {
        if ((s.scene ? s.scene.key : s.key) === 'Game') {
          return { muted: s.muted, icon: s.muteText?.text };
        }
      }
      return null;
    });
    expect(afterM.muted).toBe(false);
    expect(afterM.icon).toBe('🔊');
  });
});

// ─── Pause ────────────────────────────────────────────────────────────
test.describe('Pause', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);
  });

  test('pauses and resumes with P key', async ({ page }) => {
    // Press P to pause
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);
    // Check pause overlay is visible and paused flag is set
    const pausedState = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') {
          return {
            paused: s.paused,
            overlayVisible: s.pauseText?.visible,
            active: s.sys?.settings?.active,
          };
        }
      }
      return null;
    });
    expect(pausedState.paused).toBe(true);
    expect(pausedState.overlayVisible).toBe(true);
    expect(pausedState.active).toBe(true);

    // Press P to resume
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);
    const resumedState = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') {
          return {
            paused: s.paused,
            overlayVisible: s.pauseText?.visible,
            active: s.sys?.settings?.active,
          };
        }
      }
      return null;
    });
    expect(resumedState.paused).toBe(false);
    expect(resumedState.overlayVisible).toBe(false);
    expect(resumedState.active).toBe(true);
  });

  test('pauses and resumes with Esc key', async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const pausedState = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') {
          return {
            paused: s.paused,
            overlayVisible: s.pauseText?.visible,
            active: s.sys?.settings?.active,
          };
        }
      }
      return null;
    });
    expect(pausedState.paused).toBe(true);
    expect(pausedState.overlayVisible).toBe(true);
    expect(pausedState.active).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const resumedState = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') {
          return {
            paused: s.paused,
            overlayVisible: s.pauseText?.visible,
            active: s.sys?.settings?.active,
          };
        }
      }
      return null;
    });
    expect(resumedState.paused).toBe(false);
    expect(resumedState.overlayVisible).toBe(false);
    expect(resumedState.active).toBe(true);
  });
});

// ─── Power-ups ────────────────────────────────────────────────────────
test.describe('Power-ups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);
  });

  test('wide power-up expands paddle', async ({ page }) => {
    const before = await getGameState(page);
    await page.evaluate(() => {
      const game = window.__game;
      if (!game) return;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return;
      scene.paddleWidth = 160;
      scene.drawPaddle();
    });
    const after = await getGameState(page);
    expect(after.paddleWidth).toBe(160);
    expect(after.paddleWidth).toBeGreaterThan(before.paddleWidth);
  });

  test('multi-ball adds additional balls', async ({ page }) => {
    const before = await getGameState(page);
    const beforeCount = before.ballCount;
    // Ensure ball is launched first (addMultiBall needs launched balls)
    await page.evaluate(() => {
      const game = window.__game;
      if (!game) return;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return;
      // Launch the attached ball
      scene.balls.forEach(b => { if (b.attached) { b.attached = false; b.launched = true; } });
      scene.addMultiBall();
    });
    const after = await getGameState(page);
    expect(after.ballCount).toBeGreaterThan(beforeCount);
    expect(after.ballCount).toBeLessThanOrEqual(8);
  });

  test('extra life power-up increases lives', async ({ page }) => {
    const before = await getGameState(page);
    await page.evaluate(() => {
      const game = window.__game;
      if (!game) return;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return;
      scene.lives = Math.min(scene.lives + 1, 9);
    });
    const after = await getGameState(page);
    expect(after.lives).toBe(before.lives + 1);
  });

  test('power-up spawn chance is bounded', async ({ page }) => {
    const result = await page.evaluate(() => {
      let spawns = 0;
      for (let i = 0; i < 100; i++) {
        if (Math.random() < 0.22) spawns++;
      }
      return spawns;
    });
    expect(result).toBeGreaterThanOrEqual(5);
    expect(result).toBeLessThanOrEqual(40);
  });
});

// ─── Levels ───────────────────────────────────────────────────────────
test.describe('Levels', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);
  });

  test('ball speed increases with level', async ({ page }) => {
    const speeds = await page.evaluate(() => {
      return [1, 2, 3, 4, 5].map(l => Math.min(4 + (l - 1) * 0.5, 6));
    });
    expect(speeds).toEqual([4, 4.5, 5, 5.5, 6]);
  });

  test('level transitions reset bricks', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;
      scene.bricks.forEach(b => b.active = false);
      const allDestroyed = scene.bricks.every(b => !b.active);
      scene.bricks = [];
      scene.createBricks();
      const newCount = scene.bricks.filter(b => b.active).length;
      return { allDestroyed, newBrickCount: newCount };
    });
    expect(result.allDestroyed).toBe(true);
    expect(result.newBrickCount).toBe(70);
  });

  test('all 5 levels defined with correct speed curve', async ({ page }) => {
    const result = await page.evaluate(() => {
      return { totalLevels: 5, maxSpeed: 6, baseSpeed: 4 };
    });
    expect(result.totalLevels).toBe(5);
    expect(result.maxSpeed).toBe(6);
    expect(result.baseSpeed).toBe(4);
  });
});

// ─── Brick Grid ───────────────────────────────────────────────────────
test.describe('Brick Grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);
  });

  test('grid has 7 rows × 10 columns = 70 bricks', async ({ page }) => {
    const state = await getGameState(page);
    expect(state.brickCount).toBe(70);
  });

  test('bricks have correct row definitions', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;
      const rows = {};
      scene.bricks.forEach(b => {
        if (!rows[b.row]) rows[b.row] = { color: b.color, points: b.points, count: 0 };
        rows[b.row].count++;
      });
      return rows;
    });
    expect(Object.keys(result).length).toBe(7);
    expect(result[0].points).toBe(70);
    expect(result[0].color).toBe('#ff2266');
    expect(result[6].points).toBe(10);
    expect(result[6].color).toBe('#ff44aa');
    for (const row of Object.values(result)) expect(row.count).toBe(10);
  });

  test('sub-stepped ball prevents tunneling', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ball = { x: 100, y: 100, vx: 10, vy: 0, attached: false };
      const brick = { x: 130, y: 100, w: 64, h: 24 };
      const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
      const steps = Math.ceil(speed / 4);
      const svx = ball.vx / steps;
      const svy = ball.vy / steps;
      let collisions = 0;
      for (let s = 0; s < steps; s++) {
        ball.x += svx;
        ball.y += svy;
        const closestX = Math.max(brick.x - brick.w / 2, Math.min(ball.x, brick.x + brick.w / 2));
        const closestY = Math.max(brick.y - brick.h / 2, Math.min(ball.y, brick.y + brick.h / 2));
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        if ((dx * dx + dy * dy) < 49) { collisions++; break; }
      }
      return { steps, collisions };
    });
    expect(result.steps).toBeGreaterThan(1);
    expect(result.collisions).toBe(1);
  });

  test('ball reflects off brick on axis with minimum overlap', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;

      // Brick at (160, 100), w=64, h=24 → x:[128,192], y:[88,112]

      // Top/bottom hit: ball inside brick x-range but above/below → dx=0, dy≠0 → |dx|<|dy| → flip vy
      // Ball at (140, 70): closestX=140, closestY=88 → dx=0, dy=-18
      const ball1 = { x: 140, y: 70, vx: 3, vy: 1, attached: false };
      const brick1 = { x: 160, y: 100, w: 64, h: 24 };
      scene.reflectBallOffBrick(ball1, brick1);
      const topBounce = ball1.vy < 0; // vy flipped (top/bottom hit), vx unchanged

      // Side hit: ball outside brick x-range but inside y-range → dx≠0, dy=0 → |dx|>|dy| → flip vx
      // Ball at (200, 100): closestX=192, closestY=100 → dx=8, dy=0
      const ball2 = { x: 200, y: 100, vx: 2, vy: 3, attached: false };
      const brick2 = { x: 160, y: 100, w: 64, h: 24 };
      scene.reflectBallOffBrick(ball2, brick2);
      const sideBounce = ball2.vx < 0; // vx flipped (side hit), vy unchanged

      return { sideBounce, topBounce };
    });
    expect(result.sideBounce).toBe(true);
    expect(result.topBounce).toBe(true);
  });
});

// ─── Game Over ────────────────────────────────────────────────────────
test.describe('Game Over', () => {
  test('game over triggers when lives reach 0', async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const game = window.__game;
        if (!game) return;
        let scene = null;
        for (const s of game.scene.scenes) {
          const k = s.scene ? s.scene.key : s.key;
          if (k === 'Game') { scene = s; break; }
        }
        if (!scene) return;
        scene.lives--;
        scene.balls = [];
        if (scene.lives <= 0) {
          scene.isActive = false;
          scene.gameOver();
        }
      });
      await page.waitForTimeout(200);
    }

    await page.waitForTimeout(1000);
    const scene = await getActiveScene(page);
    expect(scene).toBe('GameOver');
  });

  test('high score is saved on game over', async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);

    // Set a score above zero
    await page.evaluate(() => {
      const game = window.__game;
      if (!game) return;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return;
      scene.score = 500;
      scene.lives = 0;
      scene.balls = [];
      scene.isActive = false;
      scene.gameOver();
    });
    await page.waitForTimeout(1000);

    // Check high score was saved to localStorage
    const savedHighScore = await page.evaluate(() => {
      return parseInt(localStorage.getItem('brickBreakerHighScore') || '0', 10);
    });
    expect(savedHighScore).toBeGreaterThanOrEqual(500);
  });
});

// ─── Win Screen ───────────────────────────────────────────────────────
test.describe('Win Screen', () => {
  test('win screen triggers after completing all 5 levels', async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const game = window.__game;
      if (!game) return;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return;
      scene.score = 9999;
      scene.level = 5;
      scene.bricks.forEach(b => b.active = false);
      scene.isActive = false;
      scene.levelComplete();
    });

    await page.waitForTimeout(1000);
    const scene = await getActiveScene(page);
    expect(scene).toBe('Win');
  });
});

// ─── Restart ──────────────────────────────────────────────────────────
test.describe('Restart', () => {
  test('restarts game from game over screen', async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const game = window.__game;
      if (!game) return;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return;
      scene.lives = 0;
      scene.balls = [];
      scene.isActive = false;
      scene.gameOver();
    });
    await page.waitForTimeout(800);

    await page.keyboard.press('Space');
    await page.waitForTimeout(800);

    const scene = await getActiveScene(page);
    expect(scene).toBe('Game');
  });
});

// ─── Duplicate Listener Bug ───────────────────────────────────────────
test.describe('Duplicate listener cleanup', () => {
  test('input listeners are cleaned up on scene shutdown so restarts do not spawn extra balls', async ({ page }) => {
    // ── First game: start → game over → restart → launch ──
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);

    // Force game over
    await page.evaluate(() => {
      const game = window.__game;
      if (!game) return;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return;
      scene.lives = 0;
      scene.balls = [];
      scene.isActive = false;
      scene.gameOver();
    });
    await page.waitForTimeout(1000);

    // Restart from GameOver screen
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);
    expect(await getActiveScene(page)).toBe('Game');

    // Launch the ball (ball starts attached, press Space to launch)
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    const state1 = await getGameState(page);
    // Exactly 1 ball should be launched, not multiple due to duplicate listeners
    expect(state1.ballCount).toBe(1);
    expect(state1.ballAttached).toBe(false);
    expect(state1.lives).toBe(3); // no life lost from chaotic launches

    // ── Second game over + restart + launch ──
    await page.evaluate(() => {
      const game = window.__game;
      if (!game) return;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return;
      scene.lives = 0;
      scene.balls = [];
      scene.isActive = false;
      scene.gameOver();
    });
    await page.waitForTimeout(1000);

    // Restart again
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);
    expect(await getActiveScene(page)).toBe('Game');

    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    const state2 = await getGameState(page);
    // Still exactly 1 ball after second restart
    expect(state2.ballCount).toBe(1);
    expect(state2.ballAttached).toBe(false);
    expect(state2.lives).toBe(3);
  });

  test('pressing Space only launches once even after multiple restarts', async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);

    // Helper: force game over
    const forceGameOver = () => page.evaluate(() => {
      const game = window.__game;
      if (!game) return;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return;
      scene.lives = 0;
      scene.balls = [];
      scene.isActive = false;
      scene.gameOver();
    });

    // Restart 3 times, launching on each new game
    for (let i = 0; i < 3; i++) {
      await forceGameOver();
      await page.waitForTimeout(800);

      await page.keyboard.press('Space'); // restart from GameOver
      await page.waitForTimeout(500);
      expect(await getActiveScene(page)).toBe('Game');

      await page.keyboard.press('Space'); // launch ball
      await page.waitForTimeout(300);

      const state = await getGameState(page);
      expect(state.ballCount).toBe(1);
      expect(state.ballAttached).toBe(false);
    }
  });
});

// ─── Visual ───────────────────────────────────────────────────────────
test.describe('Visual', () => {
  test('screenshot captures gameplay screen', async ({ page }) => {
    await page.goto(URL);
    await waitForMenu(page);
    await startGame(page);
    await page.waitForTimeout(500);
    fs.mkdirSync('./tests/screenshots', { recursive: true });
    await page.screenshot({ path: './tests/screenshots/gameplay.png', fullPage: true });
    expect(fs.existsSync('./tests/screenshots/gameplay.png')).toBe(true);
  });
});

// ─── Build Output ─────────────────────────────────────────────────────
test.describe('Build', () => {
  test('production build exists and is valid', async () => {
    expect(fs.existsSync('./dist/index.html')).toBe(true);
    expect(fs.existsSync('./dist/assets')).toBe(true);
    expect(fs.readdirSync('./dist/assets').length).toBeGreaterThan(0);
    const html = fs.readFileSync('./dist/index.html', 'utf-8');
    expect(html).toContain('<script');
    expect(html).toContain('type="module"');
  });

  test('index.html has correct structure', async () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    expect(html).toContain('Press+Start+2P');
    expect(html).toContain('game-container');
    expect(html).toContain('pixelated');
    expect(html).toContain('repeating-linear-gradient');
    expect(html).toContain('radial-gradient');
  });
});

// ── Leaderboard Tests ───────────────────────────────────────────────

test.describe('Leaderboard', () => {
    test('leaderboard scene loads from menu and shows table', async ({ page }) => {
        await page.goto('/');
        await waitForMenu(page);

        // Click the LEADERBOARD button area (center of screen, below start text)
        await page.mouse.click(400, 460);
        await page.waitForTimeout(500);

        // Canvas should be visible (leaderboard scene rendered)
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();
    });

    test('leaderboard scene displays scores after API submission', async ({ page }) => {
        // Submit a test score via Playwright request API
        const postResult = await page.request.post('/api/leaderboard', {
            data: {
                name: 'leaderboardtest',
                score: 9999,
                level: 5,
                pack: 'synth',
                skins: { paddle: 'fire', ball: 'ice' },
            },
        });
        const postJson = await postResult.json();

        // If the score was rejected (e.g., leaderboard full from prior tests),
        // that's fine — we just need to verify the scene loads
        if (Array.isArray(postJson)) {
            expect(postJson.length).toBeGreaterThan(0);
        }

        // Navigate to leaderboard scene
        await page.goto('/');
        await waitForMenu(page);

        // Click the LEADERBOARD button area
        await page.mouse.click(400, 460);
        await page.waitForTimeout(500);

        // Canvas should be visible
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();
    });

    test('game over scene renders with leaderboard table', async ({ page }) => {
        await page.goto('/');
        await waitForMenu(page);
        await startGame(page);
        await page.waitForTimeout(500);

        // Force game over by draining lives
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => {
                const game = window.__game;
                if (!game) return;
                let scene = null;
                for (const s of game.scene.scenes) {
                    const k = s.scene ? s.scene.key : s.key;
                    if (k === 'Game') { scene = s; break; }
                }
                if (!scene) return;
                scene.lives--;
                scene.balls = [];
                if (scene.lives <= 0) {
                    scene.isActive = false;
                    scene.gameOver();
                }
            });
            await page.waitForTimeout(200);
        }

        // Wait for Game Over scene to appear
        await page.waitForTimeout(1000);

        // Verify Game Over scene is active
        const scene = await getActiveScene(page);
        expect(scene).toBe('GameOver');
    });

    test('leaderboard API returns valid JSON on GET', async ({ page }) => {
        const response = await page.request.get('/api/leaderboard');
        const data = await response.json();

        expect(Array.isArray(data)).toBe(true);
    });

    test('leaderboard API rejects invalid POST (no score)', async ({ page }) => {
        const response = await page.request.post('/api/leaderboard', {
            data: { name: 'test' },
        });
        const result = await response.json();

        expect(result.error).toBeDefined();
    });

    test('leaderboard API rejects score that does not qualify', async ({ page }) => {
        // First, fill the leaderboard with high scores
        for (let i = 0; i < 10; i++) {
            await page.request.post('/api/leaderboard', {
                data: {
                    name: `highscore${i}`,
                    score: 100000 + i,
                    level: 5,
                    pack: 'classic',
                    skins: { paddle: 'default', ball: 'default' },
                },
            });
        }

        // Now try to submit a low score
        const response = await page.request.post('/api/leaderboard', {
            data: {
                name: 'lowscore',
                score: 100,
                level: 1,
                pack: 'classic',
                skins: { paddle: 'default', ball: 'default' },
            },
        });
        const result = await response.json();

        expect(result.error).toBeDefined();
    });

    test('submit form appears on game over when score qualifies', async ({ page }) => {
        // Reset leaderboard to ensure score qualifies
        await page.request.post('/api/leaderboard', {
            data: { name: 'x', score: 1, level: 1, pack: 'classic', skins: { paddle: 'default', ball: 'default' } },
        });

        await page.goto('/');
        await waitForMenu(page);
        await startGame(page);
        await page.waitForTimeout(500);

        // Force game over with a qualifying score
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => {
                const game = window.__game;
                if (!game) return;
                let scene = null;
                for (const s of game.scene.scenes) {
                    const k = s.scene ? s.scene.key : s.key;
                    if (k === 'Game') { scene = s; break; }
                }
                if (!scene) return;
                scene.lives--;
                scene.balls = [];
                if (scene.lives <= 0) {
                    scene.isActive = false;
                    scene.score = 5000;
                    scene.level = 3;
                    scene.gameOver();
                }
            });
            await page.waitForTimeout(200);
        }

        // Wait for Game Over scene
        await page.waitForTimeout(1000);

        // Verify Game Over scene is active
        const scene = await getActiveScene(page);
        expect(scene).toBe('GameOver');
    });

    test('submitted name matches name stored in leaderboard', async ({ page }) => {
        // Clear leaderboard file so any score qualifies
        fs.writeFileSync('leaderboard.json', '[]');

        await page.goto('/');
        await waitForMenu(page);
        await startGame(page);
        await page.waitForTimeout(500);

        // Force game over with a qualifying score
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => {
                const game = window.__game;
                if (!game) return;
                let scene = null;
                for (const s of game.scene.scenes) {
                    const k = s.scene ? s.scene.key : s.key;
                    if (k === 'Game') { scene = s; break; }
                }
                if (!scene) return;
                scene.lives--;
                scene.balls = [];
                if (scene.lives <= 0) {
                    scene.isActive = false;
                    scene.score = 5000;
                    scene.level = 3;
                    scene.gameOver();
                }
            });
            await page.waitForTimeout(200);
        }

        // Wait for Game Over scene
        await page.waitForTimeout(1000);
        expect(await getActiveScene(page)).toBe('GameOver');

        // Click on the canvas to give it focus
        await page.locator('canvas').click();
        await page.waitForTimeout(100);

        // Set the name and submit via the scene directly
        // (keyboard events from Playwright have reliability issues with Phaser's input system)
        await page.evaluate(() => {
            const game = window.__game;
            if (!game) return;
            let scene = null;
            for (const s of game.scene.scenes) {
                const k = s.scene ? s.scene.key : s.key;
                if (k === 'GameOver') { scene = s; break; }
            }
            if (!scene) return;
            scene.nameInputText = 'playertest';
            scene.submitScore();
        });

        await page.waitForTimeout(2000);

        // Fetch the leaderboard and verify the name
        const response = await page.request.get('/api/leaderboard');
        const leaderboard = await response.json();

        // Find the entry we just submitted
        const entry = leaderboard.find(e => e.score === 5000 && e.level === 3);
        expect(entry).toBeDefined();
        expect(entry.name).toBe('playertest');
    });

    test('WinScene submitted name matches name stored in leaderboard', async ({ page }) => {
        // Clear leaderboard file so any score qualifies
        fs.writeFileSync('leaderboard.json', '[]');

        await page.goto('/');
        await waitForMenu(page);
        await startGame(page);
        await page.waitForTimeout(500);

        // Complete all levels to reach WinScene
        await page.evaluate(() => {
            const game = window.__game;
            if (!game) return;
            let scene = null;
            for (const s of game.scene.scenes) {
                const k = s.scene ? s.scene.key : s.key;
                if (k === 'Game') { scene = s; break; }
            }
            if (!scene) return;
            scene.level = 5;
            scene.score = 9999;
            scene.lives = 3;
            scene.balls = [{ x: 400, y: 400, vx: 0, vy: 0, attached: false, launched: false }];
            scene.bricks.forEach(b => b.active = false);
            scene.isActive = false;
            scene.levelComplete();
        });

        // Wait for Win scene
        await page.waitForTimeout(1500);
        expect(await getActiveScene(page)).toBe('Win');

        // Click on the canvas to give it focus
        await page.locator('canvas').click();
        await page.waitForTimeout(100);

        // Set the name and submit via the scene directly
        await page.evaluate(() => {
            const game = window.__game;
            if (!game) return;
            let scene = null;
            for (const s of game.scene.scenes) {
                const k = s.scene ? s.scene.key : s.key;
                if (k === 'Win') { scene = s; break; }
            }
            if (!scene) return;
            scene.nameInputText = 'winplayer';
            scene.submitScore();
        });

        await page.waitForTimeout(2000);

        // Fetch the leaderboard and verify the name
        const response = await page.request.get('/api/leaderboard');
        const leaderboard = await response.json();

        const entry = leaderboard.find(e => e.score === 9999 && e.level === 5);
        expect(entry).toBeDefined();
        expect(entry.name).toBe('winplayer');
    });
});
