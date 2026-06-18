# Brick Breaker — Product Requirements Document

## Overview

A polished retro arcade Brick Breaker game built with **Phaser 3** framework, targeting modern web browsers. Zero external assets — all textures generated programmatically at runtime. Single HTML entry point, runs via Vite dev server or production build.

**Status**: ✅ Complete — v1.2 (June 15, 2026)  
**Framework**: Phaser 3 (CANVAS renderer)  
**Build**: Vite  

**Tests**: 41/41 Playwright tests passing (June 15, 2026)

---

## 1. Gameplay

### Core Loop
- Player controls a paddle at the bottom of the screen
- A ball bounces around, destroying bricks on contact
- Goal: clear all bricks to advance to the next level
- Lose a life when the ball falls below the paddle
- Game ends when all lives are lost

### Level Design
- **5 levels** total
- Each level increases ball speed by 0.5px/frame (base: 4px/frame, max: ~6px/frame)
- Brick grid: **7 rows × 10 columns**
- Bricks are destroyed one at a time — the ball reflects off each brick it hits (no tunneling through stacked bricks)

### Scoring
| Row (top to bottom) | Color | Points |
|---------------------|-------|--------|
| 7 (top) | Red-Pink `#ff2266` | 70 |
| 6 | Orange `#ff8800` | 60 |
| 5 | Yellow `#ffdd00` | 50 |
| 4 | Green `#44dd44` | 40 |
| 3 | Cyan `#00ccdd` | 30 |
| 2 | Purple `#aa44ff` | 20 |
| 1 (bottom) | Magenta `#ff44aa` | 10 |

**Combo System**: Consecutive brick hits without touching the ground multiply score. Combo resets after 2 seconds of no hits or losing a ball. The combo multiplier is displayed in the HUD as `{combo}x COMBO!` in orange text, fading out in the last 500ms of the combo window.

### Lives
- Start with **3 lives**
- Max **9 lives**
- Lose one life when a ball drops below the paddle
- Game Over when lives reach 0

---

## 2. Controls

| Input | Action |
|-------|--------|
| **Mouse** | Move paddle (primary) — paddle follows cursor horizontally |
| **Arrow Keys / A D** | Move paddle (secondary) — continuous movement while key held |
| **Click / Space** | Launch ball / Start game |
| **P / Esc** | Pause / Resume |

---

## 3. Power-ups

Dropped randomly (22% chance) when a brick is destroyed. Power-ups fall from the brick's position at 80px/second and are caught when they overlap the paddle.

| Power-up | Icon | Effect | Duration |
|----------|------|--------|----------|
| **Wide Paddle** | Colored circle (cyan) | Expands paddle width from 100 to 160px | 10 seconds |
| **Multi-ball** | Colored circle (pink) | Splits each ball into 3 (max 8 total) | 15 seconds |
| **Extra Life** | Colored circle (yellow) | Adds +1 life (max 9) | Instant |

---

## 4. Visual Requirements

### Color Palette
- **Background**: `#0a0a1a` (deep navy)
- **Bricks**: 7 neon colors (red-pink, orange, yellow, green, cyan, purple, magenta)
- **Paddle**: `#00ccff` (default), `#00ffcc` (wide mode)
- **Ball**: White with blue inner tint
- **HUD**: Score `#00ffcc`, Level `#ffcc00`, Lives `#ff4488`

### Effects
- **Neon glow**: Shadow blur on ball, paddle, and bricks (drawn via Phaser Graphics)
- **CRT scanline overlay**: CSS `repeating-linear-gradient` (no JS overhead)
- **Vignette**: CSS `radial-gradient` darkening edges
- **Particle explosions**: 12 particles per brick hit, colored to match brick, with gravity and fade-out
- **Subtle background grid**: 40px spacing, 2% opacity white lines (pre-rendered as texture)

### Typography
- **Font**: Press Start 2P (Google Fonts)
- **HUD**: 12px, combo: 10px, title: 32px, instructions: 10px

---

## 5. Audio Requirements

Web Audio API oscillators — no external audio files.

| Event | Waveform | Frequency | Duration |
|-------|----------|-----------|----------|
| Ball bounce | Square | 440 Hz | 80ms |
| Brick hit (row 0) | Square | 520–740 Hz (row-dependent) | 120ms, descending slide |
| Power-up pickup | Sine | 600→1200 Hz, then 900→1400 Hz | 100ms + 150ms (delayed) |
| Life lost | Sawtooth | 300→80 Hz | 300ms, descending |
| Level complete | Square | 500→900 Hz (5-note fanfare) | 150ms each, 100ms apart |
| Game over | Sawtooth | 400→100 Hz, 300→60 Hz, 200→40 Hz | 200ms + 300ms + 500ms |

**Rate-limited audio**: 40ms cooldown between sounds to prevent overlap.

---

## 6. UI Screens

### Start Screen
- Decorative brick rows (3 rows × 6 bricks, neon colors)
- Title: "BRICK BREAKER" (32px, cyan)
- Instructions (3 lines, gray)
- Blinking "PRESS SPACE TO START" (14px, yellow)

### HUD (during gameplay)
- **Top-left**: `SCORE: {score}` (cyan)
- **Top-center**: `LEVEL {level}` (yellow)
- **Top-right**: `♥ {lives}` (pink)
- **Combo**: `{combo}x COMBO!` (orange, fades after 2 seconds)

### Pause Overlay
- Semi-transparent black background
- "PAUSED" (28px, cyan)
- "Press P to Resume" (11px, gray)

### Game Over Screen
- Semi-transparent black background
- "GAME OVER" (28px, red)
- `FINAL SCORE: {score}` (14px, yellow)
- `LEVEL REACHED: {level}` (11px, gray)
- Blinking "PRESS SPACE TO RESTART" (11px, cyan)

### Win Screen
- Semi-transparent black background
- "YOU WIN!" (28px, green)
- `FINAL SCORE: {score}` (14px, yellow)
- Blinking "PRESS SPACE TO RESTART" (11px, cyan)

---

## 7. Technical Requirements

### Canvas
- Internal resolution: **800×600**
- Scales to fit browser window via CSS (`Phaser.Scale.FIT`, centered)
- `image-rendering: pixelated` for crisp rendering

### Rendering
- **Phaser Graphics** for all game visuals (paddle, bricks, balls, power-ups, particles) — avoids WebGL CanvasTexture upload issues
- **Static background** pre-rendered as a canvas texture (grid + solid color)
- All game entities use **invisible physics sprites** (for collision) with **Graphics objects** (for rendering) synced each frame

### Performance
- **Sub-stepped ball physics**: Movement divided into steps of max 4px to prevent tunneling through stacked bricks
- **One-brick-per-frame**: Each ball can only break one brick per frame, then reflects off it
- **Particle cap**: 12 particles per brick hit, each animated via tween
- **Audio cooldown**: 40ms between sounds

### Responsive
- Canvas scales via CSS `width: 100%; height: 100%`
- Centered on screen with `flexbox`
- `max-width: 100vw; max-height: 100vh`

### Code Quality
- Single entry point (`index.html`)
- No external assets — all textures generated programmatically
- Phaser 3 CANVAS renderer (avoids WebGL CanvasTexture bugs)
- Vanilla JavaScript (ES6+)
- Well-commented, structured sections
- Clean separation: audio → state → entities → input → game loop → rendering

---

## 8. Architecture

### Scene Structure
| Scene | Key | Purpose |
|-------|-----|---------|
| BootScene | `Boot` | Loads game, transitions to menu |
| MenuScene | `Menu` | Start screen with decorative bricks and instructions |
| GameScene | `Game` | Core gameplay loop |
| GameOverScene | `GameOver` | Game over screen with final score |
| WinScene | `Win` | Victory screen after completing all 5 levels |

### Entity Design
- **Balls**: Plain objects `{x, y, vx, vy, attached, launched, brickHitThisFrame}` — no physics sprites
- **Bricks**: Plain objects `{x, y, row, active}` — no physics sprites
- **Power-ups**: Plain objects `{x, y, vy, type, active}` — no physics sprites
- **Paddle**: Position tracked as `{paddleX, paddleWidth}` — no physics sprite
- **Particles**: Temporary Graphics objects animated via Phaser Tweens

### Physics
- **Manual collision detection**: AABB checks against brick rectangles
- **Ball-wall bounce**: Simple velocity inversion at screen edges
- **Ball-paddle bounce**: Angle varies based on hit position (-1 to +1 maps to -150° to -30°)
- **Ball-brick bounce**: Reflects on the axis with minimum overlap (top/bottom vs left/right)
- **Paddle hit cooldown**: 80ms to prevent multi-hit from overlapping bodies

---

## 9. Future Enhancements (Backlog)

- [x] Sound toggle (mute/unmute) — **v1.1** — Click 🔊 button or press M
- [x] High score persistence (localStorage) — **v1.1** — Saves on game over / win
- [x] Screen shake on brick destruction — **v1.1** — 80ms shake per brick hit
- [x] Custom brick patterns per level — **v1.2** — 5 unique layouts (solid, checker, fortress, diamond, pyramid)
- [x] Ball trail effect — **v1.2** — 6-segment fading trail per ball
- [x] Mobile touch controls — **v1.2** — `touch-action: none`, touch-drag paddle, touch-tap launch
- [x] Vite production build optimization — **v1.2** — Phaser vendor chunk split (22KB game code)
- [ ] Sound pack selection (chiptune, 8-bit, etc.)
- [ ] Online leaderboard
- [ ] Custom paddle/ball skins
- [ ] WebGL renderer support (fix CanvasTexture upload issues)
