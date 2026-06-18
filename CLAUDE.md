# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Brick Breaker — a retro arcade brick-breaker game built with Phaser 3 (CANVAS renderer). Zero external assets; all textures generated programmatically at runtime. Single HTML entry point, served via Vite.

- **Internal resolution**: 800×600, scales via `Phaser.Scale.FIT`
- **Framework**: Phaser 3 (`phaser@^3.90.0`)
- **Build**: Vite (port 3000)
- **Tests**: Playwright ( Chromium, runs against dev server)
- **Audio**: Web Audio API oscillators — no external audio files

## Commands

```bash
npm run dev          # Start Vite dev server (localhost:3000)
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm test             # Run Playwright tests
npm run test:ui      # Run Playwright tests with UI mode
```

To run a single test file:
```bash
npx playwright test tests/brick-breaker.spec.cjs -g "name of test"
```

## Architecture

### Entry Point

`src/main.js` — Creates the Phaser.Game instance with 5 scenes in order: `Boot → Menu → Game → GameOver/Win`. Exposes `window.__game` for testing. Uses CANVAS renderer, 800×600, scale FIT centered.

### Scene Flow

```
BootScene → MenuScene → GameScene → (GameOverScene | WinScene) → GameScene (restart)
                                              ↓
                                      (level complete) → GameScene (next level)
```

| Scene | Key | File | Purpose |
|-------|-----|------|---------|
| BootScene | `Boot` | `src/scenes/BootScene.js` | Generates all textures programmatically (bg grid, brick, ball, paddle, powerup, particle, heart canvases). Transitions to Menu. |
| MenuScene | `Menu` | `src/scenes/MenuScene.js` | Decorative bricks, title, instructions, blinking "PRESS SPACE TO START". Space/click → Game level 1. |
| GameScene | `Game` | `src/scenes/GameScene.js` | Core gameplay loop. Handles physics, scoring, combo, power-ups, lives, levels. |
| GameOverScene | `GameOver` | `src/scenes/GameOverScene.js` | Final score, level reached, high score. Space/click → restart at level 1. |
| WinScene | `Win` | `src/scenes/WinScene.js` | Victory screen after completing all 5 levels. Space/click → restart at level 1. |

### GameScene — Core Loop

This is the main file. Key subsystems:

**Physics (manual, no Phaser physics engine)**:
- Ball movement is sub-stepped (max 4px per sub-step) to prevent tunneling through bricks
- AABB collision: circle-vs-rectangle (closest point on rect to circle center)
- One-brick-per-frame: ball reflects off first brick hit, then skips remaining bricks that frame
- Ball reflects on axis with minimum overlap (top/bottom vs left/right)
- Paddle bounce angle varies by hit position (-1 to +1 maps to -150° to -30°)
- Paddle hit cooldown: 80ms prevents multi-hit

**Entities (plain objects, not Phaser sprites)**:
- **Balls**: `{x, y, vx, vy, attached, launched, brickHitThisFrame, trailX, trailY}`
- **Bricks**: `{x, y, w, h, row, col, active, color, points}`
- **Power-ups**: `{x, y, vy, type, active}`
- **Paddle**: `{paddleX, paddleWidth}` (tracked as variables, not objects)

**Rendering**: All visuals via Phaser Graphics objects (`this.add.graphics()`), synced each frame. Persistent Graphics instances are reused (cleared and redrawn) to minimize allocations.

**5 Level Patterns** (defined in `this.patterns`):
1. `solid` — all 70 bricks filled
2. `checker` — alternating bricks
3. `fortress` — thick bottom rows, gaps at top
4. `diamond` — diamond shape
5. `pyramid` — wide base narrowing to top

**Scoring & Combo**:
- Brick row 0 (top) = 70pts, row 6 (bottom) = 10pts
- Combo increments on each brick hit, resets after 2s window
- Score = `brick.points × combo`
- Combo display fades in last 500ms of window

**Power-ups** (22% chance per brick destroy):
- `wide` — paddle 100→160px, 10s duration
- `multiball` — splits each ball into 3 (max 8 total), 15s
- `life` — +1 life (max 9), instant

### Audio

`src/audio/AudioManager.js` — Singleton via `AudioManager.instance`. 6 sound types: `bounce`, `brick`, `powerup`, `lifeLost`, `levelComplete`, `gameOver`. 40ms rate-limit cooldown between sounds. All oscillator-based (square/sawtooth/sine).

### Key Constants (GameScene.js top)

| Constant | Value | Meaning |
|----------|-------|---------|
| `BASE_SPEED` | 4 | px per sub-step |
| `SPEED_INCREMENT` | 0.5 | per level |
| `MAX_SPEED` | 6 | cap |
| `START_LIVES` | 3 | initial |
| `MAX_LIVES` | 9 | cap |
| `TOTAL_LEVELS` | 5 | |
| `COMBO_WINDOW` | 2000ms | |
| `PADDLE_COOLDOWN` | 80ms | |
| `SUB_STEP_MAX` | 4px | max sub-step |
| `POWERUP_CHANCE` | 0.22 | |

### State Management

- `this.isActive` — gates the entire game loop (set false during level transitions)
- `this.paused` — pause flag (toggled by P/Esc)
- `this.waitingForBall` — prevents double life drain when all balls die
- Level transitions: fade out → reset state → fade in (500ms each)
- Game over / win: fade out → start new scene (500ms)

### High Score

Persisted in `localStorage` under key `brickBreakerHighScore`. Saved on game over and win. Displayed in HUD as "BEST: {score}".

## Testing

Single test file: `tests/brick-breaker.spec.cjs` (~950 lines, ~41 tests)

Tests run against the Vite dev server. They interact via:
- Keyboard/mouse events (Phaser input)
- `page.evaluate()` to inspect game state via `window.__game`
- Screenshot capture
- Build output validation

Key test helpers: `waitForMenu()`, `startGame()`, `getGameState()`, `getActiveScene()`

## Visual Effects (CSS-only, no JS overhead)

- **CRT scanlines**: `repeating-linear-gradient` on `#game-container::after`
- **Vignette**: `radial-gradient` on `#game-container::before`
- **Pixelated rendering**: `image-rendering: pixelated` on canvas
- **Touch-action**: `none` on canvas for mobile support

## File Structure

```
index.html              # Entry point, CSS effects (scanlines, vignette)
package.json            # Scripts: dev, build, preview, test, test:ui
vite.config.js          # Port 3000, Phaser vendor chunk split
playwright.config.cjs   # Chromium, baseURL: localhost:3000
src/
  main.js               # Phaser.Game config, scene list
  audio/AudioManager.js # Web Audio API, singleton, 6 sound types
  scenes/
    BootScene.js        # Texture generation
    MenuScene.js        # Start screen
    GameScene.js        # Core gameplay (~750 lines)
    GameOverScene.js    # Game over screen
    WinScene.js         # Victory screen
tests/
  brick-breaker.spec.cjs  # All Playwright tests
  screenshots/          # menu.png, gameplay.png
docs/
  PRD.md                # Product requirements document
debug-tunnel.cjs        # Debug utility
debug-tunnel2.cjs       # Debug utility
```
