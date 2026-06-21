# Codebase Audit — GameScene & Cross-Cutting Analysis

**Date:** 2026-06-20  
**Scope:** `src/scenes/GameScene.js`, design doc `docs/design/GameScene-Design.md`, and all supporting files

---

## Part A — Design Doc vs. Code Inconsistencies

Cross-checked every section of `docs/design/GameScene-Design.md` against `src/scenes/GameScene.js`.

### §3.3 `create()` — Listener count wrong

- **Doc says:** "5 keyboard + 1 mouse listener"
- **Code:** 6 keyboard listeners (SPACE, P, ESC×2, M, TAB) + 1 mouse = **7 total**
- ESC's two handlers counted as one.

### §3.5 `shutdown()` — Missing detail

- **Doc says:** "Removes all input listeners registered in `create()`"
- **Code:** Does NOT clear `this.cursors` or `this.adKeys` keyboard key references. Minor leak.

### §3.6 Input Registration — ESC guards reversed

**Doc table:**

| Listener | Handler | Purpose |
|---|---|---|
| `keydown-ESC` (1st) | `togglePause()` | Pause/resume |
| `keydown-ESC` (2nd) | `toggleSettings()` | Close settings |

**Code (lines 147–159):**
```javascript
this.input.keyboard.on('keydown-ESC', () => {
    if (!this.settingsVisible) this.togglePause();   // 1st: pauses ONLY when settings NOT visible
});
this.input.keyboard.on('keydown-ESC', () => {
    if (this.settingsVisible) this.toggleSettings();  // 2nd: closes settings ONLY when VISIBLE
});
```

The guard conditions are **reversed** from the descriptions. The 1st listener does *not* always pause — it skips when settings are open. The 2nd does *not* always close settings — it skips when settings are closed.

### §4.4 Paddle entity model — Wrong variable scope

- **Doc says:** "Not a plain object — tracked as two module-scoped variables"
- **Code (lines 100–101):** `this.paddleWidth = PADDLE_W;` and `this.paddleX = W / 2;`
- These are **`this.` properties** (instance properties), not module-scoped `const`/`let` variables.

### §5.1 Sub-stepping — Speed-4 narrative misleading

- **Doc says:** "At speed 4, 1 sub-step"
- **Code:** `Math.ceil(4 / 4) = 1` — numerically correct, but 1 sub-step means no actual sub-division. The doc presents this as meaningful sub-stepping.

### §5.4 Ball-Brick Collision — Reset timing

- **Doc says:** "After one brick is hit, `ball.brickHitThisFrame = true` prevents further brick collisions that frame."
- **Code (line 666):** Reset happens *before* the sub-step loop, not after. Outcome is correct but the doc omits this implementation detail.

### §7.1 Scoring — Combo initial value

- **Doc says:** "`combo` = consecutive hits counter (starts at 1)"
- **Code (line 79):** `this.combo = 0;` — initialized to 0, incremented on first brick hit. "Starts at 1" is the *effective* value on first hit, not the stored value.

### §8.3 Multi-ball Math — Angle range

- **Doc:** `angle = -π/2 + random(-0.6, +0.6)`
- **Code (line 454):** `(Math.random() - 0.5) * 1.2` → `[-0.6, +0.6]`
- **Verdict:** Correct. Just documenting the equivalence.

### §9.3 Level Transition — Win path missing fadeOut

- **Doc pseudo-code:** Win path shows `→ WinScene(score, highScore)` with no fade.
- **Code (lines 897–899):** No `fadeOut` call for win path, while non-win path has `this.cameras.main.fadeOut(500, ...)` (line 903).
- **Behavioral difference:** Level N→N+1 fades out; level 5→Win does not. Design doc pseudo-code matches code but does not call this out.

### §14 Rendering Pipeline — Trail radius hardcoded

- **Doc says:** "Radius: `min(7, 3 + dist * 0.3)`"
- **Code (line 843):** `Math.min(BALL_R, 3 + dist * 0.3)`
- Numerically identical (`BALL_R = 7`), but doc hardcodes `7` instead of referencing `BALL_R`. Unmaintainable if radius changes.

### §16 Observations — Particle cleanup (correctly identified)

- **Doc correctly notes:** Particles pushed to `this.particles` but never removed from array. `onComplete` calls `px.destroy()`, but array entries persist. Minor memory concern.

---

## Part B — P0: Bugs & Correctness (fix now)

| # | File:Line | Issue | Impact | Status |
|---|-----------|-------|--------|--------|
| **B-1** | `GameScene.js:147-158` | Duplicate `keydown-ESC` listeners. Two separate handlers with inverse guards instead of one handler with `if/else`. | Works by accident (Phaser processes both in order), but fragile. Adding a third ESC handler could break the order. | ✅ Fixed 2026-06-20 — merged into single handler with `if/else` |
| **B-2** | `MenuScene.js:shutdown()` | `pointerdown` listener (line 85) never removed. Only `keydown-SPACE` and `keydown-ENTER` cleaned up. | Listener leak — re-entering menu accumulates duplicate handlers. | ✅ Already fixed (line 137: `this.input.off('pointerdown')`) |
| **B-3** | `GameScene.js:713-729` | `brickHitThisFrame` reset once *before* sub-step loop. Ball can only hit one brick per frame even if passing through multiple bricks in later sub-steps. | Intentional design, but fast balls may tunnel through bricks without registering collisions on later sub-steps. | ⏭️ Intentional design — no action |
| **B-4** | `GameScene.js:759` | `reflectBallOffBrick` pushes ball by only 1px. On exact corner hits, may not fully separate ball from brick. | Rare corner-case: ball may register repeated collisions with same brick. | ✅ Fixed 2026-06-20 — push now proportional to overlap + 1px buffer |
| **B-5** | `WinScene.js` | Uses magic number `data.level \|\| 5` — should reference `TOTAL_LEVELS` constant. | Fragile — if total levels changes, win screen default breaks. | ✅ Fixed 2026-06-20 — uses `TOTAL_LEVELS` from `src/constants.js` |

---

## Part C — P1: Data Loss & UX (fix next)

| # | File:Line | Issue | Impact | Status |
|---|-----------|-------|--------|--------|
| **C-1** | `settings.js` + `GameScene.js` | `muted` state NOT persisted. User mutes, refreshes, sound is back. | Preference lost on every reload. | ✅ Fixed 2026-06-20 — `muted` added to settings.js DEFAULTS/load/save. `toggleMute()` persists. `AudioManager.setMuted()` added. |
| **C-2** | `settings.js` | `highScore` stored in separate localStorage key, not consolidated. | Fragmented persistence — two keys for related data. | ✅ Fixed 2026-06-20 — `getHighScore`/`saveHighScore` moved to `settings.js`. `GameScene` imports them. |
| **C-3** | `GameScene.js:470-490` | `spawnParticles` pushes Graphics to `this.particles`, but `levelComplete()`/`gameOver()` do `this.particles = []` — clearing array without destroying orphaned particles. | Memory leak — orphaned particles run tweens. Scene shutdown mid-tween may throw. | ✅ Fixed 2026-06-20 — `levelComplete()` and `gameOver()` now destroy each particle before clearing array. |
| **C-4** | `EndScreenScene.js:136-164` | `addEmptyRows()` creates text objects never destroyed on shutdown. | Memory leak — empty row texts accumulate across restarts. | ✅ Fixed 2026-06-20 — `shutdown()` now iterates `rowTexts` and `headerTexts`, destroying each before nulling. |
| **C-5** | `GameScene.js:937-944` | `shutdown()` does NOT clear `this.cursors` or `this.adKeys` references. | Minor leak — stale key object references persist. | ✅ Fixed 2026-06-20 — `shutdown()` now sets `this.cursors = null; this.adKeys = null;` |
| **C-6** | `GameScene.js:897-899` | Win path has NO `fadeOut` transition. Non-win level transitions fade out. | Inconsistent UX — level N→N+1 fades, level 5→Win does not. | ✅ Fixed 2026-06-20 — `this.cameras.main.fadeOut(500, ...)` added to win path. |

---

## Part D — P2: Robustness & Quality (should fix)

| # | File:Line | Issue | Impact | Status |
|---|-----------|-------|--------|--------|
| **D-1** | `package.json` | `vite` in `dependencies` instead of `devDependencies`. | Unnecessary bloat in production installs. | ✅ Fixed 2026-06-20 — moved to `devDependencies` |
| **D-2** | `GameScene.js:35` | `SUB_STEP_MAX` is misleading name — represents max step *size* (px), not max number of sub-steps. | Code readability — readers expect "MAX" to mean a cap on count. | ✅ Fixed 2026-06-20 — renamed to `SUB_STEP_MAX_SIZE` (all occurrences) |
| **D-3** | `EndScreenScene.js` + `LeaderboardScene.js` | ~150 lines duplicated leaderboard rendering logic (table, scrolling, headers). | DRY violation — changes must be applied in two places. | ✅ Fixed 2026-06-20 — extracted `LeaderboardMixin.js` with `drawTableBg`, `addHeader`, `addEmptyRows`, `renderRows`, `formatDate`, `LeaderboardMixinUpdate`, `LeaderboardMixinShutdown`. Both scenes now import and use it. |
| **D-4** | `leaderboard-plugin.js` | `sanitizeName` does not block Unicode invisible chars, emoji, or zero-width joiners. | Users can name themselves with invisible strings. | ✅ Fixed 2026-06-20 — added regex to strip zero-width chars, emoji ranges, and control chars |
| **D-5** | `leaderboard-plugin.js` | No rate limiting on POST submissions. Concurrent POSTs have read-modify-write race. | Spam-able; multi-tab submissions could corrupt data. | ✅ Fixed 2026-06-20 — added per-IP rate limiting: 2s per-request cooldown + 5 submissions per 30s window. Returns HTTP 429 when exceeded. |
| **D-6** | `AudioManager.js` | 40ms cooldown is global across all sound types. Rapid brick destructions silently drop some `brick` sounds. | Feels unnatural — fast play sessions have uneven audio feedback. | ✅ Fixed 2026-06-20 — replaced global `#lastTime` with `#lastPlayed` Map keyed by sound type. Each type has its own 40ms cooldown. |
| **D-7** | `LeaderboardScene.js:58` | `disableContextMenu()` blocks right-click on canvas. | Frustrates power users who want to inspect/debug. | ✅ Fixed 2026-06-20 — removed `this.input.mouse.disableContextMenu()` |

---

## Part E — P3: Performance (nice to optimize)

| # | File:Line | Issue | Impact |
|---|-----------|-------|--------|
| **E-1** | `GameScene.js:713` | Brick collision: brute-force iteration of ALL active bricks (up to 70) per sub-step per ball. Worst case: 8 × 2 × 70 = 1,120 iterations/frame. | Acceptable at current scale, doesn't scale well. Spatial hash/grid would help if brick count grows. |
| **E-2** | `index.html` | CRT scanline `::after` pseudo-element creates extra compositor layer over entire viewport. | Minor impact on low-end devices. |
| **E-3** | `BootScene.js` | All textures generated synchronously in `preload()` with no loading indicator. | User sees black screen briefly. A progress bar would improve perceived performance. |

---

## Part F — P4: Features (enhancements)

| # | File | Feature | Value |
|---|------|---------|-------|
| **F-1** | `GameScene.js` + `settings.js` | Master volume slider — currently only mute/unmute. Persisted volume setting. | High UX value. |
| **F-2** | `GameScene.js` | Difficulty settings — Easy (slower speed, more lives, higher power-up chance) and Hard (faster, fewer lives). | Replayability for experienced players. |
| **F-3** | `settings.js` | Settings reset button — restore all settings to defaults. | Convenience — currently requires manual localStorage clear. |
| **F-4** | `index.html` | SEO meta tags — `description`, Open Graph, favicon, `preconnect` for Google Fonts. | Important for public deployment. |
| **F-5** | `index.html` | Accessibility — `role="application"`, `aria-label` on game container, skip links. | Screen reader usability. |
| **F-6** | `GameScene.js` | Screen shake on power-up collection — currently only on brick destruction. | Consistent visual feedback. |
| **F-7** | `GameScene.js` | In-game leaderboard access — currently only from menu and end screens. | Check scores mid-session. |
| **F-8** | `GameScene.js` | Visual indicator for settings menu — no hint that Tab opens settings. | Discoverability. |
| **F-9** | `EndScreenScene.js` | Loading state for leaderboard fetch — no spinner while API is queried. | Feedback during network delay. |
| **F-10** | `EndScreenScene.js` | Error retry on score submission failure — shows error text but no "try again" button. | Better UX on network failures. |

---

## Part G — P5: Testing Gaps

| # | Area | Gap |
|---|------|-----|
| **G-1** | `settings.js` | No tests for persistence, defaults, or error handling. |
| **G-2** | `AudioManager.js` | Zero tests — no unit or integration tests for pack switching, cooldown, or mute. |
| **G-3** | `GameScene.js` | No test for settings menu (TAB open/close, skin switching, persistence). |
| **G-4** | `GameScene.js` | No test for brick patterns at different levels (checker, fortress, diamond, pyramid). |
| **G-5** | `GameScene.js` | No test for ball trail rendering or particle spawning. |
| **G-6** | `tests/` | Heavy reliance on `page.waitForTimeout()` (200-2000ms) — slow and flaky. Replace with `page.waitForFunction`. |
| **G-7** | `GameScene.js` | No test for `shutdown()` listener cleanup. |
| **G-8** | `tests/` | Many tests manipulate game state directly (`scene.lives = 0`, `scene.score = 500`) rather than triggering through gameplay. Brittle integration tests. |

---

## Part H — Cross-Cutting Observations

### Architecture
- Clean scene-based organization (Phaser best practice).
- `EndScreenScene` + thin alias pattern for GameOver/Win is elegant.
- Manual AABB collision + sub-stepped ball movement is well-implemented.
- Three sound packs provide meaningful variety.
- Programmatic texture generation avoids external asset dependencies.

### Code Smells
- **EndScreenScene is 448 lines** — handles game-over rendering, leaderboard fetch/display, score submission form, restart navigation, and blink animation. Violates Single Responsibility Principle.
- **LeaderboardScene duplicates ~150 lines** of leaderboard rendering logic from EndScreenScene. Should be extracted to a shared mixin or helper.
- **`shutdown()` methods are incomplete** across multiple scenes — MenuScene misses `pointerdown`, GameScene misses `cursors`/`adKeys`.

### Positive Patterns
- Good error handling (try/catch around localStorage, graceful API failure handling).
- Atomic file writes for leaderboard data (temp file + rename).
- `window.__game` exposure gated by `typeof window !== 'undefined'`.
- `waitingForBall` flag prevents double life drain when all balls die simultaneously.
- Persistent Graphics instances reused each frame to minimize allocations.
- Ball sub-stepping prevents tunneling through bricks.

---

## Recommended Execution Order

```
Phase 1 — Bugs (P0) ✅ COMPLETE
  B-1: ✅ Merge duplicate ESC listeners → single handler with if/else
  B-2: ✅ Already fixed — MenuScene.shutdown() has pointerdown cleanup
  B-3: ⏭️ Intentional design — no action
  B-4: ✅ Ball push now proportional to overlap + 1px buffer
  B-5: ✅ WinScene uses TOTAL_LEVELS from src/constants.js

Phase 2 — Data & Memory (P1) ✅ COMPLETE
  C-1: ✅ `muted` added to settings.js DEFAULTS/load/save. `toggleMute()` persists. `AudioManager.setMuted()` added.
  C-2: ✅ `getHighScore`/`saveHighScore` moved to `settings.js`. `GameScene` imports them.
  C-3: ✅ `levelComplete()` and `gameOver()` destroy particles before clearing array.
  C-4: ✅ `EndScreenScene.shutdown()` iterates `rowTexts` and `headerTexts`, destroying each.
  C-5: ✅ `GameScene.shutdown()` sets `this.cursors = null; this.adKeys = null;`
  C-6: ✅ `this.cameras.main.fadeOut(500, ...)` added to win path.

Phase 3 — Robustness (P2) ✅ COMPLETE
  D-1: ✅ Moved vite to devDependencies
  D-2: ✅ Renamed SUB_STEP_MAX → SUB_STEP_MAX_SIZE
  D-3: ✅ Extracted LeaderboardMixin.js — both EndScreenScene and LeaderboardScene now use it
  D-4: ✅ Added regex to strip zero-width chars, emoji, control chars from sanitizeName
  D-5: ✅ Added per-IP rate limiting (2s cooldown + 5/30s window), HTTP 429 on excess
  D-6: ✅ Replaced global cooldown with per-type Map in AudioManager
  D-7: ✅ Removed input.mouse.disableContextMenu()

Phase 4 — Performance (P3)
  E-1: Spatial hash for brick collision (defer unless profiling shows need)
  E-2: Optimize CRT scanline (defer — minimal impact)
  E-3: Add loading bar to BootScene (quick win)

Phase 5 — Features (P4)
  Pick based on user feedback and roadmap.
  Priority suggestions: F-1 (volume slider), F-8 (settings hint), F-9 (loading state)

Phase 6 — Testing (P5)
  G-1: settings.js unit tests
  G-2: AudioManager unit tests
  G-3: Settings menu E2E tests
  G-4: Brick pattern verification tests
  G-6: Replace waitForTimeout with waitForFunction
```
