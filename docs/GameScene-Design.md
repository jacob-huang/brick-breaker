# GameScene — Detailed Design Document

**File:** `src/scenes/GameScene.js` (946 lines)  
**Scene Key:** `'Game'`  
**Last Updated:** 2026-06-20

---

## 1. Overview

`GameScene` is the core gameplay loop of Brick Breaker. It manages all game entities (paddle, ball, bricks, power-ups, particles), physics, rendering, scoring, input, and scene transitions. All visuals are rendered via **Phaser Graphics** objects (no physics sprites). The scene runs at the browser's frame rate with manual sub-stepped physics.

---

## 2. Constants

All tuning parameters are defined at the top of the file as module-level `const`:

| Constant | Value | Purpose |
|---|---|---|
| `W`, `H` | 800, 600 | Canvas resolution |
| `PADDLE_W` | 100 | Default paddle width (px) |
| `PADDLE_H` | 12 | Paddle height (px) |
| `PADDLE_Y` | `H - 40` (=560) | Paddle Y position |
| `BALL_R` | 7 | Ball radius (px) |
| `BRICK_ROWS` | 7 | Grid rows |
| `BRICK_COLS` | 10 | Grid columns |
| `BRICK_W`, `BRICK_H` | 64, 24 | Brick dimensions |
| `BRICK_PAD` | 4 | Brick spacing (px) |
| `BRICK_TOP` | 60 | Top margin for brick grid |
| `BASE_SPEED` | 4 | Ball speed px/sub-step at level 1 |
| `SPEED_INCREMENT` | 0.5 | Speed increase per level |
| `MAX_SPEED` | 6 | Speed cap |
| `START_LIVES` | 3 | Initial lives |
| `MAX_LIVES` | 9 | Lives cap |
| `TOTAL_LEVELS` | 5 | Total levels |
| `POWERUP_CHANCE` | 0.22 | Brick-destroy → power-up spawn probability |
| `POWERUP_SPEED` | 80 | Power-up fall speed (px/s) |
| `POWERUP_DURATION_WIDE` | 10000 | Wide paddle duration (ms) |
| `POWERUP_DURATION_MULTIBALL` | 15000 | Multi-ball duration (ms) |
| `COMBO_WINDOW` | 2000 | Combo timer window (ms) |
| `COMBO_FADE` | 500 | Combo fade-in start window (ms) |
| `PADDLE_COOLDOWN` | 80 | Ball-paddle hit cooldown (ms) |
| `SUB_STEP_MAX` | 4 | Max sub-step size (px) |

### Brick Definitions (`BRICK_DEFS`)

7 rows, top-to-bottom. Points decrease toward the bottom:

| Row Index | Color | Points |
|---|---|---|
| 0 (top) | `#ff2266` | 70 |
| 1 | `#ff8800` | 60 |
| 2 | `#ffdd00` | 50 |
| 3 | `#44dd44` | 40 |
| 4 | `#00ccdd` | 30 |
| 5 | `#aa44ff` | 20 |
| 6 (bottom) | `#ff44aa` | 10 |

### Paddle Skins (`PADDLE_SKINS`)

| Skin | Color | Wide Color | Glow |
|---|---|---|---|
| `default` | `#00ccff` | `#00ffcc` | Yes |
| `fire` | `#ff4400` | `#ff8800` | Yes |
| `ice` | `#00ccff` | `#88eeff` | Yes |
| `rainbow` | `#ff00ff` | `#00ffff` | Yes |

> **Note:** Despite the PRD mentioning gradients for Fire/Ice/Rainbow skins, Phaser Graphics CANVAS renderer does not support gradients. All skins render as solid fills with a glow border.

### Ball Skins (`BALL_SKINS`)

| Skin | Glow Color | Ball Color | Trail Color |
|---|---|---|---|
| `default` | `0xffffff` (white) | `0x88aaff` (blue) | `0x88aaff` |
| `fire` | `0xff6600` (orange) | `0xff4400` | `0xff4400` |
| `ice` | `0x88ffff` (cyan) | `0x00ccdd` | `0x00ccdd` |
| `rainbow` | `0xffffff` (white) | `0xff66ff` | `0xff66ff` |

### Power-up Types

| Type | Constant | Color | Effect |
|---|---|---|---|
| Wide | `PU_WIDE` | `#00ccff` (cyan) | Paddle 100→160px, 10s |
| Multi-ball | `PU_MULTIBALL` | `#ff44aa` (pink) | Splits each ball ×3, max 8, 15s |
| Life | `PU_LIFE` | `#ffcc00` (yellow) | +1 life (max 9), instant |

---

## 3. Scene Lifecycle

### 3.1 `constructor()`

```
super('Game')  // Registers scene with Phaser under key 'Game'
```

### 3.2 `init(data)`

Called when the scene is created. Receives `data` from the scene transition:

```javascript
this.level = data.level || 1;          // Starting level (1–5)
this.score = 0;                         // Reset to 0
this.lives = START_LIVES;               // 3
this.combo = 0;
this.comboTimer = 0;
this.comboActive = false;
this.paddleCooldown = 0;
this.ballSpeed = Math.min(BASE_SPEED + (this.level - 1) * SPEED_INCREMENT, MAX_SPEED);
this.highScore = this.getHighScore();   // From localStorage
```

Settings are loaded from `src/settings.js` and applied:
- `this.audio.setPack(settings.soundPack)` — Classic / Retro / Synth
- `this.paddleSkin = settings.paddleSkin`
- `this.ballSkin = settings.ballSkin`

### 3.3 `create()`

Initializes all game objects and registers input listeners:

1. **Background** — `this.add.image(400, 300, 'bg')`
2. **Paddle** — Creates persistent Graphics object, sets `paddleX = 400`, `paddleWidth = 100`
3. **Balls** — Empty array, calls `attachBall()` to spawn 1 attached ball
4. **Ball glow** — Persistent Graphics for trail + glow
5. **Bricks** — Calls `createBricks()` based on current level pattern
6. **Power-ups** — Empty array, creates Graphics
7. **Particles** — Empty array (managed via Phaser Tweens)
8. **HUD** — Calls `createHUD()` (score, level, lives, combo, high score, mute btn, settings btn)
9. **Pause overlay** — Creates black Graphics + text, initially hidden
10. **Input listeners** — 5 keyboard + 1 mouse listener (see §3.6)
11. **Settings menu** — Creates group, background Graphics, option text array
12. **Wide paddle timer** — `null` (set when wide power-up is collected)
13. **`this.isActive = true`** — Gates the game loop

### 3.4 `update(time, delta)`

The main game loop (detailed in §6). Runs every frame.

### 3.5 `shutdown()`

Removes all input listeners registered in `create()`. Called by Phaser when the scene is destroyed (e.g., when transitioning to GameOver/Win). Prevents duplicate listener accumulation across restarts.

### 3.6 Input Registration

| Listener | Handler | Purpose |
|---|---|---|
| `keydown-SPACE` | `launchAll()` | Launch attached balls |
| `keydown-P` | `togglePause()` | Pause/resume |
| `keydown-ESC` (1st) | `togglePause()` if not in settings | Pause/resume |
| `keydown-ESC` (2nd) | Close settings if visible | Close settings |
| `keydown-M` | `toggleMute()` | Toggle sound |
| `keydown-TAB` | `toggleSettings()` | Open/close settings |
| `pointermove` | Update `paddleX` | Mouse paddle control |

> **Note:** Two `keydown-ESC` listeners are registered. The first fires before the second. Phaser processes them in registration order.

---

## 4. Entity Models

### 4.1 Ball

```javascript
{
    x: number,              // Center X position
    y: number,              // Center Y position
    vx: number,             // Velocity X (px/frame)
    vy: number,             // Velocity Y (px/frame)
    attached: boolean,      // Riding on paddle
    launched: boolean,      // Has been launched at least once
    brickHitThisFrame: boolean,  // One-brick-per-frame limit
    trailX: number,         // Previous X (for trail rendering)
    trailY: number,         // Previous Y (for trail rendering)
}
```

### 4.2 Brick

```javascript
{
    x: number,              // Center X
    y: number,              // Center Y
    w: number,              // Width (64)
    h: number,              // Height (24)
    row: number,            // 0–6 (top to bottom)
    col: number,            // 0–9 (left to right)
    active: boolean,        // Not yet destroyed
    color: string,          // Hex color
    points: number,         // Score value
}
```

### 4.3 Power-up

```javascript
{
    x: number,              // Center X
    y: number,              // Center Y (increases as it falls)
    vy: number,             // Fall speed (POWERUP_SPEED / 60)
    type: string,           // 'wide' | 'multiball' | 'life'
    active: boolean,        // Still on screen and not collected
}
```

### 4.4 Paddle

Not a plain object — tracked as two module-scoped variables:

```javascript
this.paddleX = 400;       // Center X position
this.paddleWidth = 100;   // Current width (100 or 160)
```

### 4.5 Particles

Phaser Graphics objects animated via `this.tweens.add()`. Each particle:
- Starts at brick position with random angle and speed (1–4 px/frame)
- Falls with gravity (`+30` Y offset)
- Fades from alpha 1→0 over 400–700ms
- Auto-destroyed on completion

---

## 5. Physics Engine

### 5.1 Sub-stepping

Ball movement is divided into sub-steps to prevent tunneling:

```javascript
const steps = Math.ceil(Math.sqrt(ball.vx² + ball.vy²) / SUB_STEP_MAX);
const svx = ball.vx / steps;
const svy = ball.vy / steps;
```

Each sub-step moves the ball by at most 4px. For a ball at speed 6, this gives 2 sub-steps. At speed 4, 1 sub-step.

### 5.2 Ball-Wall Bounce

| Wall | Condition | Action |
|---|---|---|
| Left | `ball.x - BALL_R <= 0` | `vx = abs(vx)`, clamp x to `BALL_R` |
| Right | `ball.x + BALL_R >= W` | `vx = -abs(vx)`, clamp x to `W - BALL_R` |
| Top | `ball.y - BALL_R <= 0` | `vy = abs(vy)`, clamp y to `BALL_R` |
| Bottom | `ball.y - BALL_R > H` | Ball is "dead" — lose a life |

### 5.3 Ball-Paddle Bounce

AABB check with cooldown:

```javascript
if (paddleCooldown <= 0 &&
    ball within paddle bounds &&
    ball moving downward (vy > 0)) {
    hitPos = (ball.x - paddleX) / (paddleWidth / 2);  // -1 to +1
    angle = lerp(-150°, -30°, (hitPos + 1) / 2);       // left edge = -150°, center = -90°, right = -30°
    reflect ball at angle
    paddleCooldown = 80ms
}
```

The bounce angle varies by hit position:
- **Left edge** → -150° (shallow left)
- **Center** → -90° (straight up)
- **Right edge** → -30° (shallow right)

### 5.4 Ball-Brick Collision

**Detection (`aabbBallBrick`):**
Circle-vs-rectangle using closest-point method:
1. Find closest point on brick to ball center
2. Check if distance < ball radius

**Reflection (`reflectBallOffBrick`):**
Calculate overlap on each axis. Reflect on the axis with **minimum overlap** (shallowest penetration):
- `|dx| > |dy|` → hit left/right side → flip `vx`
- `|dy| >= |dx|` → hit top/bottom → flip `vy`

**One-brick-per-frame:** After one brick is hit, `ball.brickHitThisFrame = true` prevents further brick collisions that frame.

### 5.5 Attached Ball

When `ball.attached = true`, the ball's position is set to the paddle center every frame. No physics update occurs.

---

## 6. Game Loop (`update`)

Each frame, the following sequence executes (guarded by `!this.isActive || this.paused || this.settingsVisible`):

### Step 1: Paddle Movement
- Keyboard: Arrow keys / A-D at 7px/frame
- Mouse: `pointermove` handler (registered in `create()`)
- Clamped to screen bounds: `[paddleWidth/2, W - paddleWidth/2]`
- `drawPaddle()` called

### Step 2: Cooldown & Timer Decay
- `paddleCooldown -= delta` (prevents multi-hit)
- `comboTimer += delta`; if `>= COMBO_WINDOW`, reset combo

### Step 3: Auto-launch
- If any ball is attached AND pointer is down → `launchAll()`

### Step 4: Ball Physics
- For each ball: `subStepBall(ball, delta)`
- Dead balls (y > H) collected into `toRemove` array
- Removed in reverse order

### Step 5: Life Loss
- If `balls.length === 0 && !waitingForBall`:
  - Decrement lives, play sound, update HUD
  - If lives ≤ 0 → `gameOver()` and return early
  - Otherwise: 800ms delay → clear balls → attach new ball

### Step 6: Ball Trail + Glow Rendering
- Clear persistent Graphics
- For each ball: draw trail (from previous position) + glow circle + solid fill
- Trail alpha = `min(0.2, dist * 0.02)`, radius = `min(7, 3 + dist * 0.3)`

### Step 7: Power-up Update
- Move each power-up downward
- Check paddle overlap → `applyPowerup()`
- Remove off-screen power-ups (y > H + 20)
- `drawPowerups()`

### Step 8: Brick Rendering
- `drawBricks()` — clear Graphics, draw all active bricks

### Step 9: HUD Update
- `updateHUD()` — score, lives, level, high score, combo

### Step 10: Level Complete Check
- If all bricks inactive → `levelComplete()`

---

## 7. Scoring & Combo

### 7.1 Score Calculation

```
score += brick.points × combo
```

- `brick.points` = row-dependent (10–70)
- `combo` = consecutive hits counter (starts at 1)

### 7.2 Combo System

```
on brick hit:
    combo++
    comboTimer = 0
    comboActive = true

every frame:
    if comboActive:
        comboTimer += delta
        if comboTimer >= 2000:
            comboActive = false
            combo = 0
```

### 7.3 Combo Display

- Shown at Y=35, center X
- Text: `{combo}x COMBO!`
- Fades out in last 500ms: `alpha = remaining / 500`
- Only shown when `combo > 1`

---

## 8. Power-up System

### 8.1 Spawn

When a brick is destroyed:
```javascript
if (Math.random() < 0.22) {
    type = random(['wide', 'multiball', 'life'])
    spawn at brick position, falling at 80px/s
}
```

### 8.2 Effects

| Power-up | Effect Details |
|---|---|
| **Wide** | `paddleWidth = 160`, auto-returns to 100 after 10s. Cancels previous timer if already active. |
| **Multi-ball** | For each launched ball, spawns 1 new ball at same position with random angle (-60° to +60° from vertical). Max 8 total balls. Auto-launches attached balls if none are launched. |
| **Life** | `lives = min(lives + 1, 9)`, instant. |

### 8.3 Multi-ball Math

```javascript
existing = balls.filter(b => !b.attached)
toAdd = min(8 - balls.length, existing.length)
for i in 0..toAdd-1:
    src = existing[i]
    angle = -π/2 + random(-0.6, +0.6)
    new ball at src position with angle * speed
```

---

## 9. Level Management

### 9.1 Level Patterns

Each level uses a unique brick layout function:

| Level | Pattern | Description | Brick Count |
|---|---|---|---|
| 1 | `solid` | All 70 bricks filled | 70 |
| 2 | `checker` | `(row + col) % 2 === 0` | 35 |
| 3 | `fortress` | Thick bottom 3 rows, gaps at top | 34 |
| 4 | `diamond` | `|row-3| + |col-4.5| <= 3.5` | 22 |
| 5 | `pyramid` | Widths [2,4,6,8,10,10,10] | 50 |

### 9.2 Speed Curve

```
speed = min(4 + (level - 1) × 0.5, 6)
```

| Level | Speed |
|---|---|
| 1 | 4.0 |
| 2 | 4.5 |
| 3 | 5.0 |
| 4 | 5.5 |
| 5 | 6.0 |

### 9.3 Level Transition

```
levelComplete():
    isActive = false
    saveHighScore(score)
    play 'levelComplete'
    if level >= 5:
        → WinScene(score, highScore)
    else:
        level++
        recalculate ballSpeed
        fade out (500ms)
        after 500ms:
            reset: bricks, powerups, particles, balls, combo
            restore paddleWidth = 100
            cancel wideTimer
            createBricks(), attachBall()
            draw everything
            updateHUD()
            fade in (500ms)
            isActive = true
```

### 9.4 Game Over

```
gameOver():
    isActive = false
    saveHighScore(score)
    play 'gameOver'
    fade out (500ms)
    after 500ms:
        → GameOverScene(score, level, highScore)
```

---

## 10. HUD

### 10.1 Elements

| Element | Position | Font | Color | Content |
|---|---|---|---|---|
| Score | (10, 10) | 12px | `#00ffcc` (cyan) | `SCORE: {score}` |
| Level | (400, 10) | 12px | `#ffcc00` (yellow) | `LEVEL {level}` |
| Lives | (790, 10) | 12px | `#ff4488` (pink) | `♥ {lives}` |
| Combo | (400, 35) | 10px | `#ff8800` (orange) | `{combo}x COMBO!` |
| High Score | (10, 30) | 8px | `#888888` (gray) | `BEST: {highScore}` |
| Mute | (790, 30) | 10px | `#888888` | 🔊 / 🔇 |
| Settings | (770, 30) | 10px | `#888888` | ⚙ |

### 10.2 Interactive Buttons

- **Mute button**: `pointerdown` → `toggleMute()`, `pointerover/out` → alpha 0.8
- **Settings button**: `pointerdown` → `toggleSettings()`, `pointerover/out` → alpha 0.8

---

## 11. Pause System

```
togglePause():
    if not isActive: return
    paused = !paused
    if paused:
        fill black 60% opacity
        show "PAUSED" text (28px cyan)
        show "Press P to Resume" text (11px gray)
    else:
        clear graphics
        hide both texts
```

- `update()` returns early when `this.paused` is true
- ESC key also triggers pause (when not in settings)

---

## 12. Settings System

### 12.1 Access

- Tab button (⚙) in HUD, or press Tab key
- Close: Tab, ESC, or click button again

### 12.2 UI Layout

Menu centered at X=400, Y=30. Dimensions: 440×280px.

Three sections, each with radio-style options:

| Section | Options | Spacing | Setting Key |
|---|---|---|---|
| SOUND | classic, retro, synth | 100px | `soundPack` |
| PADDLE | default, fire, ice, rainbow | 90px | `paddleSkin` |
| BALL | default, fire, ice, rainbow | 90px | `ballSkin` |

### 12.3 Persistence

- Loaded in `init()` from `src/settings.js`
- Saved via `saveSettings()` on each option change
- Key: `brickBreakerSettings` in localStorage
- Sound pack change immediately applies to `AudioManager`

### 12.4 Game State During Settings

- `update()` returns early when `settingsVisible` is true
- Game physics are paused but visuals remain
- Settings menu is drawn behind a semi-transparent black overlay

---

## 13. Audio Integration

`AudioManager` is a singleton accessed via `AudioManager.instance`. GameScene uses:

| Sound Type | When Played |
|---|---|
| `bounce` | Ball hits wall or paddle |
| `brick` | Brick destroyed |
| `powerup` | Power-up collected |
| `lifeLost` | Ball falls off screen, life lost |
| `levelComplete` | All bricks destroyed |
| `gameOver` | Lives reach 0 |

**AudioManager** handles:
- 40ms cooldown between sounds
- Sound pack selection (classic/retro/synth)
- Web Audio API oscillator generation
- Mute toggle

---

## 14. Rendering Pipeline

All rendering uses **Phaser Graphics** objects. Persistent instances are reused (cleared and redrawn each frame) to minimize allocations:

| Graphics Object | Purpose | Drawn When |
|---|---|---|
| `this.brickGfx` | Bricks | `createBricks()` + every frame |
| `this.paddleGfx` | Paddle | `create()` + every frame + on width change |
| `this.ballGlow` | Ball trails + glow | Every frame |
| `this.puGfx` | Power-ups | Every frame |
| `this.pauseBg` | Pause overlay | On pause toggle |
| `this.settingsBg` | Settings menu bg | On settings open/draw |
| Per-particle Graphics | Particle explosions | Created on brick hit, auto-destroy |

### Ball Trail Rendering

For each launched ball:
1. Calculate distance from previous position: `dist = sqrt(dx² + dy²)`
2. If `dist > 0.5`: draw trail circle at previous position
   - Alpha: `min(0.2, dist * 0.02)`
   - Radius: `min(7, 3 + dist * 0.3)`
3. Update trail position: `trailX = x, trailY = y`

### Ball Glow Rendering

For each ball (attached or not):
1. Glow circle: alpha 0.3, radius `BALL_R + 3`
2. Solid fill: alpha 0.5, radius `BALL_R`

---

## 15. High Score

- **Storage:** `localStorage` key `brickBreakerHighScore`
- **Load:** `getHighScore()` — parses integer, defaults to 0
- **Save:** `saveHighScore(score)` — only saves if score > current high score
- **Display:** HUD bottom-left as `BEST: {score}`
- **Triggers:** Called in `levelComplete()` and `gameOver()`

---

## 16. PRD Alignment Analysis

### ✅ Fully Aligned

| PRD Requirement | Implementation | Location |
|---|---|---|
| 5 levels with increasing speed | `SPEED_INCREMENT=0.5`, `MAX_SPEED=6` | `init()`, constants |
| 7×10 brick grid | `BRICK_ROWS=7`, `BRICK_COLS=10` | `createBricks()` |
| Brick points by row (10–70) | `BRICK_DEFS` array | Top of file |
| Combo system (2s window, fade 500ms) | `COMBO_WINDOW=2000`, `COMBO_FADE=500` | `onBrickHit()`, `update()`, `updateHUD()` |
| Start 3 lives, max 9 | `START_LIVES=3`, `MAX_LIVES=9` | `init()`, `applyPowerup()` |
| 22% power-up spawn chance | `POWERUP_CHANCE=0.22` | `spawnPowerup()` |
| Wide paddle: 100→160px, 10s | `POWERUP_DURATION_WIDE=10000` | `applyPowerup()` |
| Multi-ball: split ×3, max 8, 15s | `POWERUP_DURATION_MULTIBALL=15000` | `addMultiBall()` |
| Extra life: +1, max 9 | `Math.min(lives+1, MAX_LIVES)` | `applyPowerup()` |
| Sub-stepped physics (max 4px) | `SUB_STEP_MAX=4` | `subStepBall()` |
| One-brick-per-frame | `brickHitThisFrame` flag | `subStepBall()` |
| Ball-paddle angle -150° to -30° | `Phaser.Math.Linear(-150, -30, ...)` | `subStepBall()` |
| Paddle cooldown 80ms | `PADDLE_COOLDOWN=80` | `subStepBall()` |
| Manual AABB collision | `aabbBallBrick()` | Physics section |
| Ball reflects on min overlap axis | `reflectBallOffBrick()` | Physics section |
| 12 particles per brick hit | `spawnParticles(..., count=12)` | Particle section |
| 40ms audio cooldown | Handled by AudioManager | `AudioManager.play()` |
| Mouse paddle control | `pointermove` handler | `create()` |
| Keyboard paddle control | Arrow keys + A/D | `update()` |
| Click/Space to launch | `keydown-SPACE` + `pointermove` auto-launch | `create()` + `update()` |
| P/Esc to pause | `keydown-P` + `keydown-ESC` | `create()` |
| HUD colors (cyan/yellow/pink/orange/gray) | `createHUD()` color values | HUD section |
| Pause overlay (black 60%, "PAUSED" 28px) | `togglePause()` | Pause section |
| Settings (Sound/Paddle/Ball) | `drawSettingsMenu()` | Settings section |
| Settings persisted in localStorage | `loadSettings()` / `saveSettings()` | `init()` + `_addRadioRow()` |
| High score in localStorage | `getHighScore()` / `saveHighScore()` | High Score section |
| Screen shake on brick hit | `this.cameras.main.shake(80, 0.003)` | `subStepBall()` |
| Ball trail effect | `ballGlow` trail rendering | `update()` |
| Ball glow effect | `ballGlow` glow rendering | `update()` |
| Particle explosions | `spawnParticles()` | Particle section |
| Custom paddle/ball skins (4 each) | `PADDLE_SKINS`, `BALL_SKINS` | Constants |
| Sound pack selection (3 packs) | `AudioManager.PACKS` | `AudioManager.js` |
| 800×600 internal resolution | `W=800, H=600` | Constants |
| Phaser Graphics rendering | All visuals via `add.graphics()` | Throughout |
| Plain object entities | Ball/Brick/Power-up objects | Entity models |
| 5 level patterns (solid/checker/fortress/diamond/pyramid) | `this.patterns` | `createBricks()` |
| Sound toggle (mute/unmute) | `toggleMute()` + M key | Sound Toggle section |
| Settings overlay during gameplay | `toggleSettings()` + Tab | Settings section |

### ⚠️ Partially Aligned

| PRD Requirement | Implementation | Gap |
|---|---|---|
| **Paddle skins: Fire/Ice/Rainbow with gradients** | All skins render as **solid fills** | Phaser Graphics CANVAS does not support gradients. PRD mentions "horizontal gradient" for Fire/Ice/Rainbow. The implementation uses solid colors instead. This is a **known limitation of the CANVAS renderer**, not a design choice. |
| **Ball skins: Rainbow with vertical rainbow gradient** | Solid fill `#ff66ff` | Same CANVAS limitation as above. |

### ❌ Misaligned

**None.** All functional requirements from the PRD are implemented. The gradient rendering difference is a technical limitation of the CANVAS renderer (documented in the PRD's own "Future Enhancements" as a WebGL renderer item).

### 🔍 Observations

1. **Two ESC listeners:** `create()` registers two `keydown-ESC` handlers. This works correctly (first toggles pause, second closes settings), but is an unusual pattern. A single listener with conditional logic would be cleaner.

2. **Auto-launch on pointer down:** The `update()` loop checks `this.input.activePointer.isDown` and launches if any ball is attached. This enables touch/click-to-launch without a separate event handler.

3. **WaitingForBall flag:** Prevents double life drain when all balls die in the same frame (e.g., multi-ball scenario where all balls go off screen simultaneously).

4. **Level transition state reset:** The `levelComplete()` method resets `bricks`, `powerups`, `particles`, `balls`, and `combo` arrays/state. It does **not** reset `score` — score persists across levels as intended.

5. **Particle cleanup:** Particles are pushed to `this.particles` array but never explicitly cleaned up. They are destroyed via `onComplete` callbacks, but the array grows over time. This is a minor memory concern for very long sessions.

6. **Settings menu game continues behind overlay:** The PRD states "Game continues running behind overlay (physics paused)." The implementation **does pause physics** — `update()` returns early when `this.settingsVisible` is true. This is correct behavior.

---

## 17. Diagram — Scene Flow

```
                    ┌──────────┐
                    │  Boot    │
                    └────┬─────┘
                         │ create()
                         ▼
                    ┌──────────┐
                    │  Menu    │
                    └────┬─────┘
                         │ Space/Click → scene.start('Game')
                         ▼
                    ┌──────────┐
                    │  Game    │◄──────────────────────┐
                    └────┬─────┘                       │
                         │                             │
           ┌─────────────┼─────────────┐               │
           │             │             │               │
        All balls    All bricks    lives ≤ 0     Level complete
          die         cleared                          │
           │             │             │               │
           ▼             ▼             ▼               ▼
   ┌───────────┐  ┌───────────┐  ┌──────────┐    ┌──────────────────┐
   │ GameScene │  │ GameScene │  │ GameOver │    │ WinScene /       │
   │ (next lvl)│  │ (next lvl)│  │  Scene   │    │ GameOver Scene   │
   └─────┬─────┘  └─────┬─────┘  └────┬─────┘    └────────┬─────────┘
         │              │             │                   │
         │ fadeIn()     │ fadeOut()   │ Space/Click       │ Space/Click
         │              │             ▼                   ▼
         │         ┌──────────┐  ┌──────────┐        ┌──────────┐
         │         │ GameScene│  │  Menu    │        │  Menu    │
         │         │ (lvl N+1)│  └──────────┘        └──────────┘
         │         └──────────┘
         └──────────────┘
```

---

## 18. Diagram — Update Loop

```
update(time, delta)
│
├─ Guard: !isActive || paused || settingsVisible → return
│
├─ 1. Paddle movement (keyboard)
│   └─ drawPaddle()
│
├─ 2. Decay timers (paddleCooldown, comboTimer)
│
├─ 3. Auto-launch (pointer down + attached ball)
│
├─ 4. Ball physics (subStepBall for each ball)
│   ├─ Wall bounces
│   ├─ Paddle bounce (AABB + angle)
│   ├─ Brick collision (AABB + one-per-frame)
│   └─ Off-screen detection
│
├─ 5. Remove dead balls
│
├─ 6. Life loss check
│   ├─ lives--
│   ├─ lives ≤ 0 → gameOver()
│   └─ else → attach new ball (800ms delay)
│
├─ 7. Render ball trail + glow
│
├─ 8. Update power-ups (fall + paddle pickup)
│   └─ drawPowerups()
│
├─ 9. drawBricks()
│
├─ 10. updateHUD()
│
└─ 11. Level complete check → levelComplete()
```
