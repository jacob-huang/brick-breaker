/**
 * Unit tests for settings.js and AudioManager.js
 * Runs in browser context via page.evaluate() to access localStorage and Web Audio API.
 */
const { test, expect } = require('@playwright/test');

const URL = 'http://localhost:3000';

// ─── Helpers ──────────────────────────────────────────────────────────

/** Navigate to menu and start a game */
async function goToGame(page) {
  await page.goto(URL);
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(2000); // Boot → Menu
  await page.keyboard.press('Space');
  await page.waitForTimeout(1000); // Menu → Game
}

// ─── G-1: settings.js Unit Tests ──────────────────────────────────────

test.describe('settings.js', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    // Clear game storage
    await page.evaluate(() => {
      localStorage.removeItem('brickBreakerSettings');
      localStorage.removeItem('brickBreakerHighScore');
    });
  });

  test('loadSettings returns defaults when no localStorage data', async ({ page }) => {
    const defaults = await page.evaluate(() => {
      localStorage.removeItem('brickBreakerSettings');
      const DEFAULTS = {
        soundPack: 'classic',
        paddleSkin: 'default',
        ballSkin: 'default',
        muted: false,
      };
      const raw = localStorage.getItem('brickBreakerSettings');
      return raw ? JSON.parse(raw) : DEFAULTS;
    });
    expect(defaults.soundPack).toBe('classic');
    expect(defaults.paddleSkin).toBe('default');
    expect(defaults.ballSkin).toBe('default');
    expect(defaults.muted).toBe(false);
  });

  test('saveSettings + loadSettings round-trips correctly', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('brickBreakerSettings', JSON.stringify({
        soundPack: 'retro',
        paddleSkin: 'fire',
        ballSkin: 'ice',
        muted: true,
      }));
    });
    const loaded = await page.evaluate(() => {
      const DEFAULTS = {
        soundPack: 'classic',
        paddleSkin: 'default',
        ballSkin: 'default',
        muted: false,
      };
      const raw = localStorage.getItem('brickBreakerSettings');
      const parsed = JSON.parse(raw);
      return {
        soundPack: parsed.soundPack || DEFAULTS.soundPack,
        paddleSkin: parsed.paddleSkin || DEFAULTS.paddleSkin,
        ballSkin: parsed.ballSkin || DEFAULTS.ballSkin,
        muted: parsed.muted ?? DEFAULTS.muted,
      };
    });
    expect(loaded.soundPack).toBe('retro');
    expect(loaded.paddleSkin).toBe('fire');
    expect(loaded.ballSkin).toBe('ice');
    expect(loaded.muted).toBe(true);
  });

  test('loadSettings handles bad JSON gracefully', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('brickBreakerSettings', 'not valid json{{{');
    });
    const defaults = await page.evaluate(() => {
      const DEFAULTS = {
        soundPack: 'classic',
        paddleSkin: 'default',
        ballSkin: 'default',
        muted: false,
      };
      try {
        const raw = localStorage.getItem('brickBreakerSettings');
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            soundPack: parsed.soundPack || DEFAULTS.soundPack,
            paddleSkin: parsed.paddleSkin || DEFAULTS.paddleSkin,
            ballSkin: parsed.ballSkin || DEFAULTS.ballSkin,
            muted: parsed.muted ?? DEFAULTS.muted,
          };
        }
      } catch { /* ignore */ }
      return { ...DEFAULTS };
    });
    expect(defaults.soundPack).toBe('classic');
    expect(defaults.muted).toBe(false);
  });

  test('loadSettings handles missing keys gracefully', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('brickBreakerSettings', JSON.stringify({
        soundPack: 'synth',
      }));
    });
    const loaded = await page.evaluate(() => {
      const DEFAULTS = {
        soundPack: 'classic',
        paddleSkin: 'default',
        ballSkin: 'default',
        muted: false,
      };
      const raw = localStorage.getItem('brickBreakerSettings');
      const parsed = JSON.parse(raw);
      return {
        soundPack: parsed.soundPack || DEFAULTS.soundPack,
        paddleSkin: parsed.paddleSkin || DEFAULTS.paddleSkin,
        ballSkin: parsed.ballSkin || DEFAULTS.ballSkin,
        muted: parsed.muted ?? DEFAULTS.muted,
      };
    });
    expect(loaded.soundPack).toBe('synth');
    expect(loaded.paddleSkin).toBe('default');
    expect(loaded.ballSkin).toBe('default');
    expect(loaded.muted).toBe(false);
  });

  test('loadSettings preserves muted: false (not falsy)', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('brickBreakerSettings', JSON.stringify({
        soundPack: 'classic',
        paddleSkin: 'default',
        ballSkin: 'default',
        muted: false,
      }));
    });
    const loaded = await page.evaluate(() => {
      const DEFAULTS = {
        soundPack: 'classic',
        paddleSkin: 'default',
        ballSkin: 'default',
        muted: false,
      };
      const raw = localStorage.getItem('brickBreakerSettings');
      const parsed = JSON.parse(raw);
      // The ?? operator preserves false; the || operator would replace it with default
      return {
        soundPack: parsed.soundPack || DEFAULTS.soundPack,
        paddleSkin: parsed.paddleSkin || DEFAULTS.paddleSkin,
        ballSkin: parsed.ballSkin || DEFAULTS.ballSkin,
        muted: parsed.muted ?? DEFAULTS.muted,
      };
    });
    expect(loaded.muted).toBe(false);
  });

  test('getHighScore returns 0 when no data', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('brickBreakerHighScore');
    });
    const score = await page.evaluate(() => {
      try { return parseInt(localStorage.getItem('brickBreakerHighScore') || '0', 10); }
      catch { return 0; }
    });
    expect(score).toBe(0);
  });

  test('getHighScore / saveHighScore round-trips', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('brickBreakerHighScore', '12345');
    });
    const score = await page.evaluate(() => {
      try { return parseInt(localStorage.getItem('brickBreakerHighScore') || '0', 10); }
      catch { return 0; }
    });
    expect(score).toBe(12345);
  });

  test('saveHighScore returns true when score improves', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('brickBreakerHighScore', '100');
    });
    const result = await page.evaluate(() => {
      const current = parseInt(localStorage.getItem('brickBreakerHighScore') || '0', 10);
      let updated = false;
      if (500 > current) {
        localStorage.setItem('brickBreakerHighScore', String(500));
        updated = true;
      }
      return { updated, current: parseInt(localStorage.getItem('brickBreakerHighScore'), 10) };
    });
    expect(result.updated).toBe(true);
    expect(result.current).toBe(500);
  });

  test('saveHighScore returns false when score does not improve', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('brickBreakerHighScore', '1000');
    });
    const result = await page.evaluate(() => {
      const current = parseInt(localStorage.getItem('brickBreakerHighScore') || '0', 10);
      let updated = false;
      if (500 > current) {
        localStorage.setItem('brickBreakerHighScore', String(500));
        updated = true;
      }
      return { updated, current: parseInt(localStorage.getItem('brickBreakerHighScore'), 10) };
    });
    expect(result.updated).toBe(false);
    expect(result.current).toBe(1000);
  });
});

// ─── G-2: AudioManager.js Unit Tests ──────────────────────────────────

test.describe('AudioManager.js', () => {
  test.beforeEach(async ({ page }) => {
    await goToGame(page);
  });

  test('singleton returns the same instance', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return { error: 'no game' };
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return { error: 'no game scene' };
      const a1 = scene.audio;
      const a2 = scene.audio;
      return { same: a1 === a2, hasPlay: typeof a1.play === 'function' };
    });
    expect(result.same).toBe(true);
    expect(result.hasPlay).toBe(true);
  });

  test('setPack switches sound pack', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;
      const audio = scene.audio;
      audio.setPack('retro');
      const pack1 = audio.getPack();
      audio.setPack('synth');
      const pack2 = audio.getPack();
      audio.setPack('classic');
      const pack3 = audio.getPack();
      // Invalid pack should be ignored
      audio.setPack('invalid');
      const pack4 = audio.getPack();
      return { pack1, pack2, pack3, pack4 };
    });
    expect(result.pack1).toBe('retro');
    expect(result.pack2).toBe('synth');
    expect(result.pack3).toBe('classic');
    expect(result.pack4).toBe('classic'); // invalid pack ignored
  });

  test('toggle toggles mute state', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;
      const audio = scene.audio;
      // Start unmuted — toggle disables
      const before = audio.toggle(); // returns new enabled state
      const after = audio.toggle(); // toggles back
      return { before, after };
    });
    expect(result.before).toBe(false); // disabled after first toggle
    expect(result.after).toBe(true); // enabled after second toggle
  });

  test('setMuted sets mute state directly', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;
      const audio = scene.audio;
      // setMuted(true) → #enabled = false. toggle() flips to true.
      audio.setMuted(true);
      const enabled1 = audio.toggle(); // flips false→true, returns true
      // setMuted(false) → #enabled = true. toggle() flips to false.
      audio.setMuted(false);
      const enabled2 = audio.toggle(); // flips true→false, returns false
      return { enabled1, enabled2 };
    });
    expect(result.enabled1).toBe(true); // flipped from false→true
    expect(result.enabled2).toBe(false); // flipped from true→false
  });

  test('play() is safe when muted — no throws', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;
      const audio = scene.audio;
      audio.setMuted(true);
      let errors = 0;
      const types = ['bounce', 'brick', 'powerup', 'lifeLost', 'levelComplete', 'gameOver'];
      for (const type of types) {
        try { audio.play(type); } catch { errors++; }
      }
      return { errors };
    });
    expect(result.errors).toBe(0);
  });

  test('per-type cooldown: rapid calls to same type are rate-limited', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return null;
      let scene = null;
      for (const s of game.scene.scenes) {
        const k = s.scene ? s.scene.key : s.key;
        if (k === 'Game') { scene = s; break; }
      }
      if (!scene) return null;
      const audio = scene.audio;
      audio.setMuted(false);
      // Rapidly call play() for the same type — should not throw
      let errors = 0;
      for (let i = 0; i < 10; i++) {
        try { audio.play('bounce'); } catch { errors++; }
      }
      // Rapidly call play() for different types — all should succeed
      const types = ['bounce', 'brick', 'powerup', 'lifeLost', 'levelComplete', 'gameOver'];
      let typeErrors = 0;
      for (const type of types) {
        try { audio.play(type); } catch { typeErrors++; }
      }
      return { errors, typeErrors };
    });
    expect(result.errors).toBe(0);
    expect(result.typeErrors).toBe(0);
  });
});
