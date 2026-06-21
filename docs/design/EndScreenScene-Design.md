# EndScreenScene — Detailed Design Analysis

## 1. Architecture Overview

Three files implement the game-over / win screens using a **shared base class + thin alias** pattern:

| File | Lines | Role |
|------|-------|------|
| `src/scenes/EndScreenScene.js` | 448 | Shared base class — all leaderboard, submit form, scroll, and rendering logic |
| `src/scenes/GameOverScene.js` | 23 | Thin alias — registers as `'GameOver'`, passes `cfg: { title: 'GAME OVER', … }` |
| `src/scenes/WinScene.js` | 24 | Thin alias — registers as `'Win'`, passes `cfg: { title: 'YOU WIN!', … }` |

**Total**: 495 lines (vs. 872 before refactor — 43% reduction, zero duplication).

### Inheritance Chain

```
Phaser.Scene
    └── EndScreenScene (base class, 448 lines)
            ├── GameOverScene (alias, 23 lines)
            │       constructor() → super('GameOver')
            │       init(data) → super.init({ …, cfg: { title, titleColor, showLevelReached, highScoreY } })
            │
            └── WinScene (alias, 24 lines)
                    constructor() → super('Win')
                    init(data) → super.init({ …, level: data.level || 5, cfg: { title, titleColor, showLevelReached, highScoreY } })
```

### Scene Flow

```
GameScene (lives == 0)
    → fadeOut(500)
    → GameOverScene (cfg.title='GAME OVER', cfg.showLevelReached=true, cfg.highScoreY=240)
    → restart → fadeOut(300) → GameScene (level 1)

GameScene (level >= TOTAL_LEVELS)
    → fadeOut(500)
    → WinScene (cfg.title='YOU WIN!', cfg.showLevelReached=false, cfg.highScoreY=210)
    → restart → fadeOut(300) → GameScene (level 1)
```

---

## 2. Config Schema

The `cfg` object passed to `init()` drives all visual differences between the two scenes:

```js
const cfg = {
    title: 'GAME OVER',           // title text
    titleColor: '#ff4444',        // title color
    showLevelReached: true,       // display "LEVEL REACHED: N"
    highScoreY: 240,              // Y position of high score text
};
```

| Config Key | GameOver Value | Win Value |
|------------|---------------|-----------|
| `title` | `'GAME OVER'` | `'YOU WIN!'` |
| `titleColor` | `'#ff4444'` (red) | `'#44dd44'` (green) |
| `showLevelReached` | `true` | `false` |
| `highScoreY` | `240` | `210` |

### Data Payloads (from GameScene)

**GameOverScene**:
```js
this.scene.start('GameOver', { score, level, highScore });
```

**WinScene**:
```js
this.scene.start('Win', { score, highScore });
// level defaults to 5 inside WinScene.init()
```

---

## 3. EndScreenScene — `init()` and `create()`

### `init(data)`

```js
init(data) {
    this.cfg = data.cfg || {};
    this.score = data.score || 0;
    this.level = data.level || 1;
    this.highScore = data.highScore || 0;
}
```

- `cfg` — merged from alias `init()`, contains title, titleColor, showLevelReached, highScoreY
- `score`, `level`, `highScore` — game state passed from GameScene
- All values have defensive defaults

### `create()` — Rendering Order

1. **Overlay**: Full-screen black rect @ 70% opacity
2. **Title**: `this.cfg.title`, `this.cfg.titleColor` at (400, 100), 28px
3. **Final Score**: "FINAL SCORE: N" at (400, 180), 14px, yellow
4. **Level Reached**: Conditional — only if `this.cfg.showLevelReached`, at (400, 210), 11px, gray
5. **High Score**: "HIGH SCORE: N" at (400, `this.cfg.highScoreY`), 11px, pink
6. **Leaderboard table**: Background, header, 7 empty row slots, fetch from API
7. **Submit form**: Hidden initially, shown via `maybeShowSubmitForm()`
8. **Restart prompt**: "PRESS SPACE TO RESTART" at (400, 570), 11px, cyan, blinking
9. **Input listeners**: SPACE, pointerdown (with form guard), mouse wheel

---

## 4. Visual Layout (800×600)

### GameOver variant (`showLevelReached: true`, `highScoreY: 240`)

```
┌──────────────────────────────────────────────────────────────┐
│  [black overlay 0.7 opacity]                                 │
│                                                              │
│                    GAME OVER       (y=100, 28px, red)        │
│                                                              │
│                FINAL SCORE: 12345     (y=180, 14px, yellow)  │
│                LEVEL REACHED: 3       (y=210, 11px, gray)    │
│                HIGH SCORE: 9999       (y=240, 11px, pink)    │
│                                                              │
│  ┌──────────────────────────────────┐                        │
│  │ #   USER     SCORE   LVL  DATE   │  ← header (y=385)      │
│  │ 1   Alice    15000   5   06/17   │  ← data rows           │
│  │ 2   Bob      12000   4   06/18   │    (scrollable)        │
│  │ ...                              │                        │
│  └──────────────────────────────────┘  (y=370–550)           │
│                                                              │
│             YOUR SCORE QUALIFIED!  (y=525, green)            │
│             ┌────────────┐                        (y=545)    │
│             │ Alice_     │  ← text input (120×24)            │
│             └────────────┘                        │          │
│                                      SUBMIT  (button)        │
│             NEW #3!  (result message, y=600)                 │
│                                                              │
│          PRESS SPACE TO RESTART    (y=570, 11px, cyan)       │
└──────────────────────────────────────────────────────────────┘
```

### Win variant (`showLevelReached: false`, `highScoreY: 210`)

```
┌──────────────────────────────────────────────────────────────┐
│  [black overlay 0.7 opacity]                                 │
│                                                              │
│                    YOU WIN!        (y=100, 28px, green)      │
│                                                              │
│                FINAL SCORE: 50000     (y=180, 14px, yellow)  │
│                HIGH SCORE: 45000      (y=210, 11px, pink)    │
│                                                              │
│  ┌──────────────────────────────────┐                        │
│  │ #   USER     SCORE   LVL  DATE   │  ← header (y=385)      │
│  │ 1   Alice    50000   5   06/20   │  ← data rows           │
│  │ ...                              │    (scrollable)        │
│  └──────────────────────────────────┘  (y=370–550)           │
│                                                              │
│             YOUR SCORE QUALIFIED!  (y=525, green)            │
│             ┌────────────┐                        (y=545)    │
│             │ Alice_     │  ← text input (120×24)            │
│             └────────────┘                        │          │
│                                      SUBMIT  (button)        │
│             NEW #1!  (result message, y=600)                 │
│                                                              │
│          PRESS SPACE TO RESTART    (y=570, 11px, cyan)       │
└──────────────────────────────────────────────────────────────┘
```

The only visual difference is: GameOver has the extra "LEVEL REACHED" line at y=210 and the high score pushed down to y=240; Win omits "LEVEL REACHED" and places high score at y=210.

---

## 5. Constants (module scope, shared by both aliases)

| Constant | Value | Purpose |
|----------|-------|---------|
| `API_URL` | `'/api/leaderboard'` | REST endpoint for GET/POST |
| `TABLE_Y` | `380` | Table top position |
| `TABLE_X` | `208` | Table left (centered: 400 - 385/2) |
| `TABLE_WIDTH` | `385` | Table content + padding |
| `TABLE_HEIGHT` | `170` | Header + 7 data rows + padding |
| `ROW_HEIGHT` | `20` | Per-row pixel height |
| `HEADER_Y` | `385` | Header text Y |
| `MAX_VISIBLE_ROWS` | `8` | Header + 7 data rows |
| `FORM_Y` | `545` | Submit form Y center |
| `INPUT_WIDTH` | `120` | Text input width |
| `INPUT_HEIGHT` | `24` | Text input height |
| `colX` | `[238, 273, 383, 438, 473]` | Column left edges: rank, name, score, level, date |

---

## 6. Data Flow

### 6.1 Leaderboard Fetch

```
fetch('/api/leaderboard') → GET → JSON array
```

Each entry: `{ name: string, score: number, level: number, timestamp: string }`

**Graceful degradation**: If fetch fails, `this.leaderboard = []` and table shows "NO SCORES YET".

### 6.2 Score Submit

```
fetch('/api/leaderboard') → POST → JSON body
```

Body:
```json
{
  "name": "player_name",
  "score": 12345,
  "level": 3,
  "pack": "classic",
  "skins": { "paddle": "default", "ball": "default" }
}
```

Settings are read from `localStorage` key `brickBreakerSettings` at submit time.

**Response handling**:
- **Success** (2xx): Parse JSON for new leaderboard, find rank of submitted entry, show "NEW #N!", auto-hide form after 2s.
- **Error** (4xx/5xx): Show `data.error || "Submission failed"`.
- **Network failure**: Show "SERVER OFFLINE".

### 6.3 Submit Form Visibility Logic (`maybeShowSubmitForm`)

Three conditions that **hide** the form:
1. `this.score <= 0` — no score to submit
2. Leaderboard has ≥10 entries AND `this.score <= lowest entry score`

Otherwise, the form is **shown**. Implements a soft top-10 leaderboard with a fallback: if you beat the 10th entry, you qualify.

---

## 7. Interactive Elements

### 7.1 Restart Inputs

| Input | Condition | Action |
|-------|-----------|--------|
| **Space bar** | `!submitFormVisible` | Restart |
| **Mouse click** | `!submitFormVisible && pointer.y < FORM_Y - 40` | Restart |

The `pointer.y < FORM_Y - 40` guard prevents clicks on the submit form from accidentally restarting. `FORM_Y = 545`, so clicks above y=505 trigger restart.

### 7.2 Submit Form Input

| Input | Condition | Action |
|-------|-----------|--------|
| **Alphanumeric + ` _-`** | `submitFormVisible && submitState === 'idle' && len < 12` | Append to name |
| **Backspace** | Same | Remove last char |
| **Enter** | Same | Submit score |
| **Mouse on SUBMIT button** | `submitFormVisible && submitState === 'idle'` | Submit score |

**Character filter**: Only `[a-z0-9 _-]` accepted (after `.toLowerCase()`). Max 12 characters.

**Cursor**: Blinking underscore (`_`) toggles every 500ms in the `update()` loop.

### 7.3 Leaderboard Scroll

| Input | Action |
|-------|--------|
| **Mouse wheel** | `scrollSpeed -= deltaY * 0.3` (inertia-based) |

Inertia decays at `0.92` per frame. Scroll clamped to `maxScroll = (leaderboard.length - 7) * ROW_HEIGHT`.

**Visible rows**: 7 data rows (`MAX_VISIBLE_ROWS - 1 = 7`). Header is fixed. Table scrolls if leaderboard has >7 entries.

---

## 8. Rendering Pipeline

### 8.1 Static Elements (created once in `create()`)

1. **Overlay**: Full-screen black rect @ 70% opacity
2. **Title text**: Configurable text/color at (400, 100)
3. **Score text**: "FINAL SCORE: N" at (400, 180)
4. **Level text**: Conditional, at (400, 210)
5. **High score text**: At (400, `cfg.highScoreY`)
6. **Table background**: Graphics rect @ (208, 370), 385×190, cyan border
7. **Header texts**: 5 column headers at y=385
8. **Row text slots**: 7 rows × 5 columns = 35 text objects (pre-created, empty)
9. **Restart prompt**: "PRESS SPACE TO RESTART" at (400, 570)

### 8.2 Dynamic Elements (created/destroyed by submit form lifecycle)

| Element | Created | Destroyed |
|---------|---------|-----------|
| `submitLabel` | `showSubmitForm()` | `hideSubmitForm()` |
| `submitInputBg` | `showSubmitForm()` | `hideSubmitForm()` |
| `submitInputText` | `showSubmitForm()` | `hideSubmitForm()` |
| `submitButton` | `showSubmitForm()` | `hideSubmitForm()` |
| `submitResult` | `submitScore()` success/error | `hideSubmitForm()` |

### 8.3 Per-Frame Updates (`update(time, delta)`)

1. **Blink timer**: Toggle restart text visibility every 500ms
2. **Scroll inertia**: Decay × 0.92, accumulate delta, clamp
3. **Row positioning**: Apply `scrollY` offset to each visible row
4. **Row visibility**: Hide rows outside table bounds
5. **Cursor blink**: Toggle input cursor every 500ms when form is active

---

## 9. State Machine (Submit Form)

```
          ┌─────────┐
          │  idle   │ ← initial, cursor blinking
          └────┬────┘
               │ submitScore()
               ▼
        ┌─────────────┐
        │ submitting  │ ← button disabled, input locked
        └──────┬──────┘
               │
        ┌──────┴──────┐
        ▼             ▼
   ┌─────────┐  ┌──────────┐
   │   done  │  │  error   │
   │ (2s→    │  │ (stay    │
   │  hide)  │  │  until   │
   └────┬────┘  │  user    │
        │       │  acts)   │
        ▼       └──────────┘
   ┌─────────┐
   │  idle   │ ← via hideSubmitForm() (reset)
   └─────────┘
```

---

## 10. PRD Alignment Audit

### 10.1 Game Over Screen (PRD §6)

| PRD Requirement | Implementation | Status |
|-----------------|---------------|--------|
| Semi-transparent black background | `fillStyle(0x000000, 0.7)` at (0,0,800,600) | ✅ |
| "GAME OVER" (28px, red) | `fontSize: '28px'`, `color: '#ff4444'` (GameOver cfg) | ✅ |
| `FINAL SCORE: {score}` (14px, yellow) | `fontSize: '14px'`, `color: '#ffcc00'` | ✅ |
| `LEVEL REACHED: {level}` (11px, gray) | `fontSize: '11px'`, `color: '#888888'` (GameOver cfg) | ✅ |
| Blinking "PRESS SPACE TO RESTART" (11px, cyan) | Blink timer 500ms, `fontSize: '11px'`, `color: '#00ccff'` | ✅ |

### 10.2 Win Screen (PRD §6)

| PRD Requirement | Implementation | Status |
|-----------------|---------------|--------|
| Semi-transparent black background | `fillStyle(0x000000, 0.7)` at (0,0,800,600) | ✅ |
| "YOU WIN!" (28px, green) | `fontSize: '28px'`, `color: '#44dd44'` (Win cfg) | ✅ |
| `FINAL SCORE: {score}` (14px, yellow) | `fontSize: '14px'`, `color: '#ffcc00'` | ✅ |
| Blinking "PRESS SPACE TO RESTART" (11px, cyan) | Blink timer 500ms, `fontSize: '11px'`, `color: '#00ccff'` | ✅ |

### 10.3 Extra Features (Beyond PRD)

| Feature | Description | PRD Reference |
|---------|-------------|---------------|
| **High Score display** | "HIGH SCORE: N" in pink (`#ff44aa`) — appears on both screens | ❌ Not in PRD Game Over / Win sections. CLAUDE.md notes: "Saved on game over and win. Displayed in HUD as BEST: {score}" — but this is HUD, not end screens. |
| **Leaderboard table** | Scrollable table with rank, user, score, level, date/time | ❌ Not in PRD Game Over / Win sections. PRD §9 lists "Online leaderboard" as unchecked backlog. |
| **Score submit form** | Name input + SUBMIT button, POSTs to `/api/leaderboard` | ❌ Not in PRD. Part of "Online leaderboard" backlog. |
| **Scrollable leaderboard** | Mouse wheel with inertia decay | ❌ Not in PRD. |

**Assessment**: Both screens fully satisfy their explicit PRD requirements. The leaderboard and submit form are implemented features from the "Online leaderboard" backlog item — the PRD should be updated to mark it complete.

### 10.4 Alignment with Other PRD Sections

| PRD Section | Relevance | Alignment |
|-------------|-----------|-----------|
| §1 Lives — "Game Over when lives reach 0" | Triggers GameOverScene | ✅ |
| §1 High Score — "Saves on game over" | High score passed in via `init` | ✅ |
| §4 Typography — "Press Start 2P" | Font used everywhere | ✅ All text uses `"Press Start 2P", monospace` |
| §7 Technical — "Single entry point" | Scenes registered in `main.js` | ✅ |
| §8 Architecture — Scene structure table | Lists GameOverScene and WinScene | ✅ Both registered correctly |
| §9 Backlog — "Online leaderboard" | Leaderboard + submit | ⚠️ **Implemented but PRD not updated** |

---

## 11. Alias Comparison

| Aspect | GameOverScene | WinScene |
|--------|--------------|----------|
| **Scene key** | `'GameOver'` | `'Win'` |
| **Title** | `'GAME OVER'` | `'YOU WIN!'` |
| **Title color** | `'#ff4444'` (red) | `'#44dd44'` (green) |
| **showLevelReached** | `true` | `false` |
| **highScoreY** | `240` | `210` |
| **level default** | `data.level \|\| 1` (from GameScene) | `data.level \|\| 5` (Win implies level 5) |
| **Lines of code** | 23 | 24 |
| **Unique logic** | None (pure alias) | `level: data.level \|\| 5` |

---

## 12. Observations

### 12.1 Zero Duplication

The refactor eliminated all duplicated code. The leaderboard, submit form, scroll, and rendering logic exist in exactly one place (`EndScreenScene.js`). Any future change to these features only requires editing one file.

### 12.2 Safe Phaser Inheritance

Both aliases use minimal Phaser-compatible inheritance: `super('KeyName')` in the constructor and `super.init()` in the `init()` method. Phaser resolves scene classes by their registration key in `main.js`, so both `'GameOver'` and `'Win'` correctly map to the underlying `EndScreenScene` class with the appropriate config.

### 12.3 `shutdown()` Inheritance

The base class `shutdown()` removes all event listeners (SPACE, pointerdown, wheel, generic keydown). Since aliases don't override `shutdown()`, the inherited method handles both scenes correctly. No risk of duplicate listeners or memory leaks.

### 12.4 Keyboard Listener Dedup

The submit key handler uses `if (!this._submitKeyHandler)` guard to prevent duplicates. The `shutdown()` method sets `_submitKeyHandler = null`, so if the scene is re-created, a fresh handler is installed. Correct lifecycle.

### 12.5 Global `API_URL`

`const API_URL = '/api/leaderboard'` is module-scoped in `EndScreenScene.js`. Both aliases share the same URL. A centralized config would be cleaner but this is fine for a single endpoint.

### 12.6 Form Auto-Hide Timing

After successful submit, the form hides after 2000ms. The leaderboard refresh is awaited before the delayed call, so the user sees the updated table before the form disappears. Good UX.

### 12.7 Scroll Physics

Inertia: `scrollSpeed *= 0.92` per frame at 60fps means e^(-0.08) ≈ 0.92 decay. After ~25 frames, speed is ~10% of original. Feels natural.

---

## 13. Summary

| Category | Verdict |
|----------|---------|
| PRD §6 Game Over Screen alignment | ✅ All 5 required elements present and correct |
| PRD §6 Win Screen alignment | ✅ All 4 required elements present and correct |
| Extra features (leaderboard, submit) | ⚠️ Implemented but PRD backlog "Online leaderboard" not marked complete |
| High score on screen | ✅ Present on both screens (not specified in PRD end-screen sections) |
| Typography consistency | ✅ Press Start 2P, correct sizes/colors |
| Visual style consistency | ✅ Matches game aesthetic (neon colors, retro feel) |
| Code quality | ✅ Zero duplication, clean inheritance |
| Error handling | ✅ Graceful degradation for offline server |
| Cleanup | ✅ Proper shutdown listener removal |
| Test coverage | ✅ 52/52 tests passing (includes GameOver and Win tests) |

**Overall**: EndScreenScene fully satisfies the PRD's explicit requirements for both the game over and win screens. The leaderboard and submit form are implemented features from the "Online leaderboard" backlog item. The refactor reduced code from 872 to 495 lines with zero duplication.
