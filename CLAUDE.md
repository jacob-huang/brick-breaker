# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Brick Breaker — a retro arcade brick-breaker game built with Phaser 3 (CANVAS renderer). Zero external assets; all textures generated programmatically at runtime. Single HTML entry point, served via Vite.

- **Internal resolution**: 800×600, scales via `Phaser.Scale.FIT`
- **Framework**: Phaser 3 (`phaser@^3.90.0`)
- **Build**: Vite (port 3000)
- **Tests**: Playwright (Chromium, 83 tests across 2 files)
- **Audio**: Web Audio API oscillators — no external audio files

## Commands

```bash
npm run dev          # Start Vite dev server (localhost:3000)
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm test             # Run Playwright tests
npm run test:ui      # Run Playwright tests with UI mode
```

To expose the dev server to your network (e.g., phone on same WiFi):
```bash
npx vite --host
# or
npm run dev -- --host
```

The `--` separates npm flags from script flags. Without it, npm tries to interpret `--host` as its own config and warns. With `--host`, Vite binds to `0.0.0.0` instead of `127.0.0.1`, showing a `Network:` URL in the output. To make this permanent, set `host: true` in `vite.config.js` under `server`.

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
| BootScene | `Boot` | `src/scenes/BootScene.js` | Loading bar + texture generation. Transitions to Menu. |
| MenuScene | `Menu` | `src/scenes/MenuScene.js` | Decorative bricks, title, instructions, blinking "PRESS SPACE TO START". Space/click → Game level 1. |
| GameScene | `Game` | `src/scenes/GameScene.js` | Core gameplay loop. Handles physics, scoring, combo, power-ups, lives, levels. |
| EndScreenScene | *(abstract)* | `src/scenes/EndScreenScene.js` | Shared base for game-over/victory screens. Leaderboard + score submission + restart. |
| GameOverScene | `GameOver` | `src/scenes/GameOverScene.js` | Thin alias of EndScreenScene (cfg: title="GAME OVER", showLevelReached=true). |
| WinScene | `Win` | `src/scenes/WinScene.js` | Thin alias of EndScreenScene (cfg: title="YOU WIN!", showLevelReached=false). |
| LeaderboardScene | `Leaderboard` | `src/scenes/LeaderboardScene.js` | Top-10 scores display. Accessible from Menu. Uses LeaderboardMixin. |

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
- **Paddle**: tracked as `this.paddleX` / `this.paddleWidth` instance properties (not module-scoped)

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

**Spatial Hash** (P3 E-1):
- `buildSpatialHash()` — populates `this.spatialHash` Map from active bricks, keyed by `cellX,cellY`
- `spatialQueryBall(ball)` — returns only bricks in cells overlapping the ball's bounding box
- Cell size = 68px (`BRICK_W + BRICK_PAD`)
- Called once per frame in `update()` before the ball loop

**Audio**:
`src/audio/AudioManager.js` — Singleton via `AudioManager.instance`. 6 sound types: `bounce`, `brick`, `powerup`, `lifeLost`, `levelComplete`, `gameOver`. Per-type rate-limit: each sound type has its own 40ms cooldown (replaced global cooldown in P2 D-6). All oscillator-based (square/sawtooth/sine/triangle). 3 sound packs: classic, retro, synth.

**Settings**:
`src/settings.js` — localStorage persistence for `soundPack`, `paddleSkin`, `ballSkin`, `muted`. Shared high score getter/setter.

**In-game controls**:
- **TAB** — Open/close settings menu
- **M** — Toggle mute (also via gear button in HUD)
- **Gear button** — Clickable settings icon in top-right HUD corner

**Paddle/Ball skins** (applied from settings on init):
- Paddle: `default`, `fire`, `ice`, `rainbow` — each with distinct color + wide color
- Ball: `default`, `fire`, `ice`, `rainbow` — each with distinct glow/ball/trail colors

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
| `SUB_STEP_MAX_SIZE` | 4px | max sub-step size (renamed from SUB_STEP_MAX, P2 D-2) |
| `SPATIAL_CELL` | 68px | spatial hash cell size |
| `POWERUP_CHANCE` | 0.22 | |

Shared constants also live in `src/constants.js` (`TOTAL_LEVELS`, `START_LIVES`, `MAX_LIVES`).

### State Management

- `this.isActive` — gates the entire game loop (set false during level transitions)
- `this.paused` — pause flag (toggled by P/Esc)
- `this.waitingForBall` — prevents double life drain when all balls die
- `this.settingsVisible` — settings menu open/closed
- Level transitions: fade out → reset state → fade in (500ms each)
- Game over / win: fade out → start new scene (500ms)

### High Score

Persisted in `localStorage` under key `brickBreakerHighScore` (via `settings.js`). Saved on game over and win. Displayed in HUD as "BEST: {score}".

### LeaderboardMixin

`src/scenes/LeaderboardMixin.js` — Shared rendering logic extracted from EndScreenScene and LeaderboardScene. Provides `drawTableBg`, `addHeader`, `addEmptyRows`, `renderRows`, `formatDate`, plus `LeaderboardMixinUpdate` and `LeaderboardMixinShutdown` lifecycle helpers. Eliminates ~150 lines of duplication (P2 D-3).

## MCP Tools

- **Context7** — Fetch Phaser 3 documentation (`/phaserjs/phaser`). Use for any Phaser API questions: Graphics methods, scene lifecycle, physics, textures, input, audio, scaling. Always resolve library ID first via `mcp__context7__resolve-library-id`, then query via `mcp__context7__query-docs`.
- **Playwright** — Browser automation for testing and debugging. Use for navigating to the dev server, taking screenshots, inspecting console messages, and running functional tests.
- **Chrome DevTools** — Chrome development info & logs. Use for console logs, network requests, page snapshots, element inspection, and performance traces.

## Testing

**Two test files, 83 tests total:**

- `tests/brick-breaker.spec.cjs` (~1960 lines, 68 tests) — E2E: page load, gameplay, pause, power-ups, levels, brick grid, game over, win, restart, settings menu, brick patterns, ball trail/particles, shutdown cleanup, gameplay-triggered, leaderboard
- `tests/unit.spec.cjs` (~370 lines, 15 tests) — settings.js (9 tests), AudioManager.js (6 tests)

Tests run against the Vite dev server. They interact via:
- Keyboard/mouse events (Phaser input)
- `page.evaluate()` to inspect game state via `window.__game`
- Screenshot capture
- Build output validation
- `page.request` for leaderboard API tests

Key test helpers: `waitForMenu()`, `startGame()`, `getGameState()`, `getActiveScene()`, `waitForScene()`

## Visual Effects (CSS-only, no JS overhead)

- **CRT scanlines**: `repeating-linear-gradient` on `#game-container::after` (with `contain: strict`)
- **Vignette**: `radial-gradient` on `#game-container::before` (with `contain: strict`)
- **Pixelated rendering**: `image-rendering: pixelated` on canvas
- **Touch-action**: `none` on canvas for mobile support

## File Structure

```
index.html              # Entry point, CSS effects (scanlines, vignette)
package.json            # Scripts: dev, build, preview, test, test:ui
vite.config.js          # Port 3000, Phaser vendor chunk split
playwright.config.cjs   # Chromium, baseURL: localhost:3000
leaderboard-plugin.js   # Express REST API for leaderboard
README.md               # Project overview and quickstart
src/
  main.js               # Phaser.Game config, scene list
  settings.js           # localStorage persistence (settings + high score)
  constants.js          # Shared game constants (TOTAL_LEVELS, START_LIVES, MAX_LIVES)
  audio/AudioManager.js # Web Audio API, singleton, 6 sound types, 3 packs, per-type cooldown
  scenes/
    BootScene.js        # Loading bar + texture generation
    MenuScene.js        # Start screen
    GameScene.js        # Core gameplay (~990 lines)
    EndScreenScene.js   # Shared base for GameOver/Win (leaderboard + score submission)
    GameOverScene.js    # Thin alias of EndScreenScene
    WinScene.js         # Thin alias of EndScreenScene
    LeaderboardScene.js # Top-10 scores display
    LeaderboardMixin.js # Shared leaderboard rendering (used by EndScreen + Leaderboard)
tests/
  brick-breaker.spec.cjs  # E2E tests (68)
  unit.spec.cjs           # Unit tests (15)
  screenshots/          # menu.png, gameplay.png
docs/
  PRD.md                # Product requirements document
  design/               # Design docs (GameScene, EndScreenScene, MenuScene, Leaderboard, Settings)
  reviews/              # Audit reports (GameScene-Audit.md)
  superpowers/          # Plans and specs
debug-tunnel.cjs        # Debug utility
debug-tunnel2.cjs       # Debug utility
```
