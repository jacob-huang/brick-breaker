# Leaderboard Design

## Overview

The leaderboard is displayed on the **GameOverScene** and **WinScene** screens. It shows the top scores for the game, with the ability to submit a new score if it qualifies (when the leaderboard has fewer than 10 entries or the player's score beats the lowest entry).

## Data Model

### Leaderboard Entry

```json
{
  "name": "jacob",
  "score": 22680,
  "level": 5,
  "pack": "classic",
  "skins": { "paddle": "default", "ball": "default" },
  "timestamp": "2026-06-20T06:05:47.312Z"
}
```

| Field | Type | Displayed? | Notes |
|-------|------|------------|-------|
| `name` | string | Yes — USER column | Max 12 characters (input limit) |
| `score` | number | Yes — SCORE column | Integer, formatted as decimal |
| `level` | number | Yes — LVL column | Level reached; defaults to `"-"` if absent |
| `pack` | string | No | Audio pack setting (stored but not displayed) |
| `skins` | object | No | Paddle/ball skin settings (stored but not displayed) |
| `timestamp` | ISO string | Yes — DATE & TIME column | Formatted as `MM/DD HH:MM` |

### API

- **GET `/api/leaderboard`** — Returns array of entries, sorted by score descending
- **POST `/api/leaderboard`** — Submits a new entry; returns the updated array
- **Storage** — `leaderboard.json` file served by Vite's LAN plugin

## Layout

### Canvas

- Internal resolution: **800 × 600**
- Renderer: Phaser 3 CANVAS
- Scale mode: `Phaser.Scale.FIT`, centered

### Table Dimensions

| Property | Value | Calculation |
|----------|-------|-------------|
| **Table X** | 208 | `400 - 385 / 2 = 207.5` → 208 (centered on 800px) |
| **Table Width** | 385 | content(285) + spacing(40) + padding(60) |
| **Table Y** | 380 | Fixed below score/level info |
| **Table Height** | 170 | 1 header row + 7 data rows, with padding |
| **Row Height** | 20 | px |
| **Visible Rows** | 8 | 1 header + 7 data rows |
| **Scrollable** | Yes | Mouse wheel; inertia-based |

### Column Layout

| Column | Header | Left X | Range | Width | Color |
|--------|--------|--------|-------|-------|-------|
| RANK | `#` | 238 | 238–263 | 25px | `#cccccc` |
| NAME | `USER` | 273 | 273–373 | 100px | `#cccccc` |
| SCORE | `SCORE` | 383 | 383–428 | 45px | `#ffcc00` |
| LVL | `LVL` | 438 | 438–463 | 25px | `#cccccc` |
| DATE & TIME | `DATE & TIME` | 473 | 473–563 | 90px | `#888888` |

- **Text alignment**: All columns are left-aligned (`setOrigin(0, 0.5)`)
- **Gaps between columns**: 10px
- **Left padding**: 30px (table left edge at 208, first column left edge at 238)
- **Right padding**: 30px (last column right edge at 563, table right edge at 593)
- **Total content width**: 285px (column widths) + 40px (4 gaps × 10px) = 325px
- **Table is centered**: center at 400.5 ≈ screen center 400

### Table Background

- Fill: `0x000000` at alpha 0.5
- Stroke: `0x00ccff` at alpha 0.6, line width 2
- Extends 10px above and below the data area: `y = TABLE_Y - 10`, `height = TABLE_HEIGHT + 20`

### Header Text

- Font: `"Press Start 2P", monospace`, 8px
- Color: `#888888`
- Y position: `HEADER_Y = TABLE_Y + 5 = 385`
- Origin: `(0, 0.5)` — left-aligned text, vertically centered

### Data Row Text

- Font: `"Press Start 2P", monospace`, 8px
- Y positions: `TABLE_Y + 15 + i * ROW_HEIGHT` for row `i` (0-indexed)
  - Row 0: y = 395
  - Row 6: y = 515
- Origin: `(0, 0.5)`

### Empty State

When the leaderboard has no entries:
- Row 0, column 1 (NAME) displays: `NO SCORES YET`
- Color: `#666666`
- All other cells remain empty

## Scrolling

- **Trigger**: Mouse wheel event on the scene
- **Mechanism**: Inertia-based — `scrollSpeed` decays by factor 0.92 per frame
- **Threshold**: Scroll stops when `Math.abs(scrollSpeed) < 0.1`
- **Max scroll**: `(leaderboard.length - 7) * ROW_HEIGHT` (clamped to 0 minimum)
- **Clamp**: `Phaser.Math.Clamp(scrollY, 0, maxScroll)`
- **Rendering**: All 5 columns per row are repositioned by `-scrollY` each frame
- **Visibility**: Rows scrolled out of the table bounds (`TABLE_Y - 5` to `TABLE_Y + TABLE_HEIGHT + 5`) are hidden via `setVisible(false)`

## Submit Form

### Trigger Conditions

The submit form appears when:
1. Player score > 0, AND
2. Either:
   - Leaderboard has fewer than 10 entries, OR
   - Player score > lowest entry in leaderboard

### UI Elements

| Element | Position | Style |
|---------|----------|-------|
| Label | (400, FORM_Y - 20) | `YOUR SCORE QUALIFIED!`, 10px, `#44dd44` |
| Input bg | (400, FORM_Y), w=120, h=24 | Black fill, cyan stroke |
| Input text | (400, FORM_Y) | Blinking underscore cursor (500ms interval) |
| Submit button | (400, FORM_Y + 30) | `SUBMIT`, 10px, `#00ccff`, hover → `#88eeff` |
| Result text | (400, FORM_Y + 55) | `NEW #N!` (green) or error message (red) |

### Input

- **Characters allowed**: `[a-z0-9 _-]` (lowercase only)
- **Max length**: 12 characters
- **Keyboard handler**: Registered once as `_submitKeyHandler`, re-registered on each `showSubmitForm()` call
- **Backspace**: Deletes last character
- **Enter**: Triggers submission

### Submission Flow

1. Player types name and clicks SUBMIT (or presses Enter)
2. `submitState` changes to `'submitting'`
3. POST to `/api/leaderboard` with: `{ name, score, level, pack, skins }`
4. On success:
   - `submitState` → `'done'`
   - Result text: `NEW #N!` (green)
   - Leaderboard refreshed
   - Form hidden after 2 seconds
5. On error:
   - `submitState` → `'error'`
   - Result text: error message or `SERVER OFFLINE` (red)
   - Form hidden after 2 seconds

### Guards

- `showSubmitForm()` is idempotent: `if (this.submitFormVisible) return;`
- `hideSubmitForm()` clears `_submitKeyHandler = null` so the next call re-registers the listener
- `submitScore()` checks `!this.submitFormVisible` as the first guard

## Rendering

### Phaser Graphics

The table background uses a persistent `this.tableBg` Graphics object:
- Cleared each frame via `this.tableBg.clear()`
- Redrawn with fill and stroke
- This avoids allocating new Graphics objects every frame

### Text Objects

- Header texts: created once in `addHeader()`, stored in `this.headerTexts[]`
- Row texts: created once in `addEmptyRows()`, stored in `this.rowTexts[][]` (8 rows × 5 columns)
- Updated each frame via `setText()` in `renderRows()`
- Scroll repositions via `setPosition()` in the update loop

### Font

All leaderboard text uses `"Press Start 2P", monospace` at 8px. This is a pixel-art style font loaded via CSS in `index.html`.

## Scenes

The leaderboard appears in **three** scenes, each with different layout constants:

| Scene | File | Purpose | Y Position | Row Height | Visible Rows | Submit Form |
|-------|------|---------|------------|------------|--------------|-------------|
| GameOver | `src/scenes/GameOverScene.js` | Game over screen | 380 | 20px | 8 (1 header + 7 data) | Yes |
| Win | `src/scenes/WinScene.js` | Victory screen | 380 | 20px | 8 (1 header + 7 data) | Yes |
| Leaderboard | `src/scenes/LeaderboardScene.js` | Full-screen leaderboard (from Menu) | 70 | 32px | 11 (1 header + 10 data) | No |

### LeaderboardScene (standalone)

The `LeaderboardScene` is a full-screen leaderboard accessible from the Menu scene via the "LEADERBOARD" button. It differs from GameOver/Win scenes:

- **Table Y**: 70 (below title at y=30)
- **Table height**: 400px (much taller, fills screen)
- **Row height**: 32px (larger text at 9px vs 8px)
- **Visible entries**: up to 10 (vs 7 in GameOver/Win)
- **No submit form** — read-only display
- **Back button**: at y=540, returns to Menu scene
- **Context menu**: disabled via `this.input.mouse.disableContextMenu()`

## Files

| File | Role |
|------|------|
| `src/scenes/GameOverScene.js` | Leaderboard + submit form for game over screen |
| `src/scenes/WinScene.js` | Leaderboard + submit form for win screen |
| `src/scenes/LeaderboardScene.js` | Full-screen read-only leaderboard (Menu → Leaderboard) |
| `src/scenes/MenuScene.js` | Menu with "LEADERBOARD" button navigation |
| `leaderboard.json` | LAN leaderboard data (served by Vite plugin) |
| `docs/LEADERBOARD_DESIGN.md` | This document |

## Constants Summary

```javascript
const API_URL = '/api/leaderboard';
const TABLE_Y = 380;
const TABLE_WIDTH = 385;
const TABLE_X = 208;
const TABLE_HEIGHT = 170;
const ROW_HEIGHT = 20;
const HEADER_Y = TABLE_Y + 5;          // 385
const MAX_VISIBLE_ROWS = 8;            // 1 header + 7 data
const FORM_Y = 545;
const INPUT_WIDTH = 120;
const INPUT_HEIGHT = 24;
const colX = [238, 273, 383, 438, 473]; // left edges: rank, name, score, level, date
```

### LeaderboardScene Constants

| Constant | Value | Notes |
|----------|-------|-------|
| `API_URL` | `/api/leaderboard` | Same as GameOver/Win |
| `TABLE_Y` | 70 | Below title (y=30) |
| `TABLE_WIDTH` | 385 | Same as GameOver/Win, centered |
| `TABLE_X` | 208 | Centered on 800px screen |
| `TABLE_HEIGHT` | 400 | Fills most of screen |
| `ROW_HEIGHT` | 32 | Larger than GameOver/Win (20) |
| `HEADER_Y` | 75 | TABLE_Y + 5 |
| `MAX_VISIBLE_ROWS` | 11 | 1 header + 10 data entries |
| `colX` | `[238, 273, 383, 438, 473]` | Same as GameOver/Win |

## Layout Diagram (ASCII)

```
  208                          593
  |<------ 385px ----------->|
  |                          |
  |   238  273  383  438  473  563   ← column edges
  |    |    |    |    |    |
  |  [#] [USER] [SCORE] [LVL] [DATE]  ← header (y=385), left-aligned
  |  [ 1] [jacob] [22680] [5] [06/20]  ← row 0 (y=395)
  |  [ 2] [winpl...] [9999] [5] [06/20]  ← row 1 (y=415)
  |  ...                              ← scrollable (7 rows max)
  |                                  |
  |   FORM_Y = 545                   |   ← submit form starts here
  |                                  |
  |   570 = "PRESS SPACE..."         |   ← restart prompt
  |                                  |
  |   600 = bottom of screen         |
```

## Known Constraints

1. **Max leaderboard entries**: 10 (form hides when full and score doesn't qualify)
2. **Max visible rows**: 7 data + 1 header (GameOver/Win), 10 data + 1 header (LeaderboardScene) — scrollable beyond that
3. **Max name length**: 12 characters
4. **Font**: Press Start 2P — fixed-width monospace, 8px (GameOver/Win) or 9px (LeaderboardScene)
5. **No WebGL**: Phaser CANVAS renderer only, all rendering via Graphics + Text objects
6. **No external assets**: All textures and fonts must be self-contained
7. **Row text count**: All scenes use 5-column arrays (`rowTexts[i][0..4]`) — scroll loops must iterate `j < 5`
8. **Column left edges**: All three scenes share the same `colX` array — changes propagate everywhere
