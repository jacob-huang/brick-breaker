# Settings — Design Document

> Analysis of the in-game settings overlay implementation, its architecture, and current limitations.

---

## 1. Overview

The Settings system provides an in-game overlay for customizing audio and visual preferences. It is implemented entirely as an **inline Phaser Graphics overlay** within `GameScene` — no separate scene, no HTML modal, no external assets.

### What it controls

| Setting | Options | Persisted | Runtime Effect |
|---------|---------|-----------|----------------|
| **Sound Pack** | `classic`, `retro`, `synth` | `localStorage` | Switches all sound effects immediately via `AudioManager.setPack()` |
| **Paddle Skin** | `default`, `fire`, `ice`, `rainbow` | `localStorage` | Changes paddle color on next frame redraw |
| **Ball Skin** | `default`, `fire`, `ice`, `rainbow` | `localStorage` | Changes ball color, glow, and trail color on next frame redraw |

### What is NOT a setting

| Feature | Persisted? | Notes |
|---------|-----------|-------|
| Mute toggle (🔊/🔇) | No | Volatile `this.muted` on `GameScene` only; resets on scene restart |
| Mute keyboard shortcut | N/A | `M` key toggles mute; also volatile |
| Volume level | N/A | No volume slider — binary mute/unmute only |

---

## 2. Architecture

### 2.1 File Layout

```
src/
  settings.js              — Persistence module (load/save)
  scenes/
    GameScene.js           — Settings UI, state, keyboard shortcuts (~160 lines)
    WinScene.js            — Reads settings for leaderboard submission
    GameOverScene.js       — Reads settings for leaderboard submission
  audio/
    AudioManager.js        — Sound pack switching, mute toggle
```

### 2.2 Data Flow

```
localStorage ("brickBreakerSettings")
       ▲
       │  saveSettings()
       │
  ┌────┴────┐
  │settings │  ← { soundPack, paddleSkin, ballSkin }
  │.js      │
  └────┬────┘
       │  loadSettings()
       │
  ┌────┴──────────────────────────┐
  │  GameScene.init()             │
  │  this.settings = settings     │
  │  this.audio.setPack(...)      │
  │  this.paddleSkin = ...        │
  │  this.ballSkin = ...          │
  └────┬──────────────────────────┘
       │  _addRadioRow() → pointerdown
       │    1. this.settings[key] = opt
       │    2. saveSettings(this.settings)
       │    3. this.audio.setPack(opt)  ← if soundPack
       │    4. drawSettingsMenu()       ← full redraw
```

### 2.3 Persistence Module (`src/settings.js`)

A 41-line ES module with two exported functions:

- **`loadSettings()`** — Reads `localStorage["brickBreakerSettings"]`, parses JSON, falls back to defaults per key (`soundPack: 'classic'`, `paddleSkin: 'default'`, `ballSkin: 'default'`). Catches parse errors silently.
- **`saveSettings(settings)`** — `JSON.stringify` → `localStorage.setItem()`. Catches storage errors silently.

The module uses a module-scoped constant for the key (`brickBreakerSettings`) and a `DEFAULTS` object. No schema validation beyond truthy checks on each key.

### 2.4 Audio Manager Integration (`src/audio/AudioManager.js`)

The `AudioManager` singleton holds three things relevant to settings:

| Property | Type | Default | Setter |
|----------|------|---------|--------|
| `#pack` | string | `'classic'` | `setPack(name)` — validates against `AudioManager.PACKS` keys |
| `#enabled` | boolean | `true` | `toggle()` — binary on/off |
| `#lastTime` | number | `0` | Internal — 40ms cooldown enforcement |

Three sound packs are statically defined as class constants (`#PACK_CLASSIC`, `#PACK_RETRO`, `#PACK_SYNTH`), each defining configs for 6 sound types: `bounce`, `brick`, `powerup`, `lifeLost`, `levelComplete`, `gameOver`. Each pack uses different oscillator waveforms (square, triangle, sawtooth, sine) with different frequencies and durations.

### 2.5 Leaderboard Integration

Both `WinScene` and `GameOverScene` read `localStorage["brickBreakerSettings"]` directly (not via the `settings.js` module) when submitting scores to the leaderboard. They include `soundPack`, `paddleSkin`, and `ballSkin` in the submission body. This is a read-only use — no settings modification happens in these scenes.

---

## 3. UI Design

### 3.1 Layout

The settings menu is drawn as a **440×280px** box centered on the 800×600 canvas, with a semi-transparent black background (50% opacity) and a cyan border.

```
┌──────────────────────────────────────────────────────────┐
│                    SETTINGS                               │
│                                                          │
│  SOUND                                                   │
│  ► Classic   Retro   Synth                               │
│                                                          │
│  PADDLE                                                  │
│  ► Default   Fire     Ice   Rainbow                      │
│                                                          │
│  BALL                                                    │
│  ► Default   Fire     Ice   Rainbow                      │
│                                                          │
│              PRESS TAB OR ESC TO CLOSE                   │
└──────────────────────────────────────────────────────────┘
```

#### Layout constants

| Constant | Value | Meaning |
|---|---|---|
| `menuW` | 440 | Menu box width (px) |
| `menuH` | 280 | Menu box height (px) |
| `menuX` | 180 | Menu left edge (`cx - menuW / 2`) |
| `menuY` | 30 | Menu top edge |
| `titleY` | 65 | Title vertical position (`menuY + 35`) |
| `sectionPadX` | 30 | Left padding for section titles (`menuX + sectionPadX = 210`) |
| `rowStartX` | 240 | Left edge for option rows (`menuX + 60`) |
| `sectionGap` | 35 | Vertical gap between sections |
| `titleRowGap` | 20 | Vertical gap between section title and its options |

#### Element positions (computed, not hardcoded)

Each section is placed sequentially from the previous one using `y += gap`, not absolute values:

| Element | Y position | Notes |
|---|---|---|
| Title | 65 | `menuY + 35` |
| SOUND section title | 95 | `titleY + 30` |
| Sound options (3) | 115 | `y += titleRowGap` |
| PADDLE section title | 150 | `y += sectionGap` |
| Paddle options (4) | 170 | `y += titleRowGap` |
| BALL section title | 205 | `y += sectionGap` |
| Ball options (4) | 225 | `y += titleRowGap` |
| Close hint | 270 | `y += sectionGap + 10` |

#### Horizontal spacing

| Row type | Options | Gap | Interactive range | Right clearance |
|---|---|---|---|---|
| Sound (3 options) | classic, retro, synth | 100px | [240, 540] | 80px (menu ends at 620) |
| Paddle (4 options) | default, fire, ice, rainbow | 90px | [240, 600] | 20px (menu ends at 620) |
| Ball (4 options) | default, fire, ice, rainbow | 90px | [240, 600] | 20px (menu ends at 620) |

All interactive areas are adjacent — no gaps, no overlaps. The 4-option rows fit within the 440px menu with 20px right clearance.

### 3.2 Visual Style

- **Title**: 20px cyan (`#00ccff`), centered at `x = 400`
- **Section headers**: 9px yellow (`#ffcc00`), left-aligned at `x = 210`
- **Options**: 9px text, selected = cyan (`#00ffcc`) with `►` prefix, unselected = gray (`#888888`) with two-space prefix
- **Close hint**: 8px gray, centered at `x = 400`

### 3.3 Interactivity

- Each option is a `Phaser.Geom.Rectangle(0, -12, gap, 24)` interactive area overlaid on the text — the full gap width is clickable
- `pointerdown` → changes selection, saves to localStorage, applies runtime effect, redraws entire menu
- `pointerover` → alpha 0.8, `pointerout` → alpha 1 (unless selected)
- Full menu redraw on each selection change (`drawSettingsMenu()` calls `_destroySettingsChildren()` then rebuilds everything)

### 3.4 Entry Points

| Method | Trigger |
|--------|---------|
| Gear button (`⚙`) | Mouse/touch click at top-right (W-30, 30) |
| TAB key | Keyboard — toggles open/closed |
| ESC key | Keyboard — only closes (does not open) |

Note: There is **no settings entry point in MenuScene**. Settings are only accessible during active gameplay.

---

## 4. Game Loop Integration

The settings overlay **completely pauses the game** when visible:

```js
// GameScene.update(time, delta)
if (!this.isActive || this.paused || this.settingsVisible) return;
```

This is a binary gate — when `settingsVisible` is true, the entire update loop (physics, collision, rendering, input) is skipped. The game state is frozen in place behind the overlay.

### 4.1 Redraw Strategy

Every selection change triggers a full menu rebuild:

1. `_destroySettingsChildren()` — iterates children in reverse, calls `removeAllListeners()` then `destroy()` on each
2. `this.settingsBg.clear()` — clears the background graphics
3. Re-creates title, section headers, all radio options with new selection state
4. Re-draws background rect with semi-transparent fill and border

This is a **destroy-and-rebuild** pattern rather than a toggle-visibility pattern. Every time the user clicks an option, the entire menu is torn down and recreated.

### 4.2 Memory Management

The `_destroySettingsChildren()` method is careful about event listeners — it calls `removeAllListeners()` on each child before `destroy()`. This prevents stale pointer events from firing on re-opened menus. The `this.settingsOptionTexts` array is also reset.

---

## 5. Current Limitations & Observations

### 5.1 Mute state not persisted

The mute toggle (`toggleMute()`) only sets `this.muted` on the `GameScene` instance. It is not part of the persisted settings object. This means:

- Reloading the game always starts with sound enabled (🔊)
- The mute state is lost on scene transitions (Game → GameOver → Game)
- There is no way to set a persistent "sound off" preference

### 5.2 No volume slider

Only binary mute/unmute is available. No analog volume control exists.

### 5.3 Settings only accessible in GameScene

There is no settings button in `MenuScene`. Players cannot access settings before starting a game. The only entry points are the gear icon and TAB key during active gameplay.

### 5.4 Full menu redraw on every selection

Each option click destroys and recreates the entire settings menu. For a menu this small (one title, three section headers, ten options, one hint), the performance cost is negligible, but the pattern is unnecessary — only the changed option's text needs updating.

### 5.5 Leaderboard scenes bypass `settings.js`

`WinScene` and `GameOverScene` read `localStorage` directly with inline `JSON.parse` + fallback, duplicating the logic in `settings.js` rather than importing `loadSettings()`. This is a minor code duplication issue.

### 5.6 No settings validation on load

`loadSettings()` falls back to defaults per-key using `parsed.soundPack || DEFAULTS.soundPack`. This means:

- An empty string `""` for `soundPack` falls back to `'classic'` (correct)
- A numeric value like `0` falls back to `'classic'` (correct, but silently)
- A completely unknown pack name like `"retro-v2"` is **not** rejected — it gets saved to localStorage and passed to `audio.setPack()`, which silently ignores it (falls back to `'classic'` internally)

### 5.7 Skin changes are visual-only

Selecting a new paddle or ball skin applies immediately to the next frame's `drawPaddle()` / ball rendering. There is no preview — you change it and the next brick break or ball trail shows the new appearance. This is fine for the current scope but means you can't "try before commit."

---

## 6. Code Locations Reference

| Component | File | Line Range |
|-----------|------|------------|
| Persistence module | `src/settings.js` | 1–41 |
| Settings import & init | `src/scenes/GameScene.js` | 7, 88–92 |
| Settings state vars | `src/scenes/GameScene.js` | 167–170 |
| Keyboard shortcuts | `src/scenes/GameScene.js` | 147–159 |
| HUD gear button | `src/scenes/GameScene.js` | 218–225 |
| toggleSettings() | `src/scenes/GameScene.js` | 524–534 |
| _destroySettingsChildren() | `src/scenes/GameScene.js` | 536–546 |
| drawSettingsMenu() | `src/scenes/GameScene.js` | 548–605 |
| _addSectionTitle() | `src/scenes/GameScene.js` | 607–613 |
| _addText() | `src/scenes/GameScene.js` | 615–619 |
| _addRadioRow() | `src/scenes/GameScene.js` | 621–651 |
| Game loop pause guard | `src/scenes/GameScene.js` | 769 |
| Sound pack definitions | `src/audio/AudioManager.js` | 28–68 |
| setPack() | `src/audio/AudioManager.js` | 77–81 |
| toggle() (mute) | `src/audio/AudioManager.js` | 238–241 |
| Leaderboard read (Win) | `src/scenes/WinScene.js` | 313 |
| Leaderboard read (GameOver) | `src/scenes/GameOverScene.js` | 322 |

---

## 7. Summary

The settings implementation is a compact, self-contained system: ~40 lines for persistence, ~160 lines of settings-related code in `GameScene`, and ~10 lines in `AudioManager` for pack switching. It uses a destroy-and-rebuild pattern for the UI, freezes the game loop while open, and persists three preferences to localStorage.

The UI layout uses **computed positioning** — each section is placed sequentially from the previous one (`y += gap`), with layout constants (`sectionGap`, `titleRowGap`, `rowStartX`) at the top of `drawSettingsMenu()`. This ensures consistent spacing and prevents horizontal overflow: all option rows fit within the 440px menu box with adequate clearance.

The main gaps remain: no persistent mute state, no settings access from the menu screen, and no validation of saved values.
