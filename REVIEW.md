# Code Review — Commits 29593f9, e99ce1c, 4f8cccf

**Diff range**: `6bd27b4...HEAD` (3 commits, 4 files, +201/-57 lines)

**Files changed**:
- `src/scenes/GameOverScene.js` — submit form keyboard handler refactored, blink fix, input guards, null guards
- `src/scenes/WinScene.js` — same submit form refactor and null guards (but **missed** the blink fix)
- `src/scenes/GameScene.js` — ball rendering fix for attached balls
- `tests/brick-breaker.spec.cjs` — two new leaderboard integration tests

**Review method**: 10 independent finder angles (line-by-line diff scan, removed-behavior auditor, cross-file tracer, language-pitfall specialist, wrapper/proxy correctness, cleanup, efficiency, altitude, conventions, sweep), 3-state verification (CONFIRMED/PLAUSIBLE/REFUTED), recall mode.

---

## Critical

### 1. WinScene blink effect toggles entire scene visibility

- **File**: `src/scenes/WinScene.js`, lines 353–360
- **Severity**: **Critical**
- **Status**: **RESOLVED** — replaced `this.visible = !this.visible; this.restartText.setVisible(this.visible)` with `this.restartText.setVisible(!this.restartText.visible)` (single line, no scene-level toggle)
- **Description**: The blink effect in `WinScene.update()` toggles `this.visible` (the Phaser Scene's built-in visibility property), which hides **all** scene content every 500ms — the title, leaderboard table, submit form, everything. Only `this.restartText.visible` should toggle.
- **Reasoning**: `GameOverScene.js` was fixed in commit 29593f9 to use `this.restartText.setVisible(!this.restartText.visible)`, but `WinScene.js` still used the old buggy pattern. Copy-paste bug — WinScene was never updated when GameOverScene's blink was fixed.

---

## High

### 2. `_submitKeyHandler` never cleared after `hideSubmitForm()` — keyboard input dies on subsequent form shows

- **File**: `src/scenes/GameOverScene.js`, lines 259–262, 277
- **Severity**: **High**
- **Status**: **RESOLVED** — added `this._submitKeyHandler = null;` in `hideSubmitForm()` after the `off()` call, so the next `showSubmitForm()` re-registers the listener (guard `if (!this._submitKeyHandler)` now evaluates correctly)
- **Description**: `hideSubmitForm()` calls `this.input.keyboard.off('keydown', this._submitKeyHandler)` but never sets `this._submitKeyHandler = null`. The next time `showSubmitForm()` is called, the guard `if (!this._submitKeyHandler)` evaluates to `false` (the reference still exists), so the keydown listener is never re-registered. The user sees the form but cannot type their name.
- **Reasoning**: The handler is created once and cached on `this._submitKeyHandler`. The `off()` call removes it from the keyboard's listener list, but the property on the scene is never reset. This is a lifecycle bug — the handler has no "off" state.

### 3. Same `_submitKeyHandler` lifecycle bug in WinScene

- **File**: `src/scenes/WinScene.js`, lines 259–261, 268
- **Severity**: **High**
- **Status**: **RESOLVED** — added `this._submitKeyHandler = null;` in `WinScene.hideSubmitForm()`, identical fix to Finding 2
- **Description**: Identical to Finding 2. `WinScene.hideSubmitForm()` removes the handler but never clears the reference, preventing re-registration on subsequent `showSubmitForm()` calls.
- **Reasoning**: `GameOverScene` and `WinScene` share nearly identical submit form logic. The same copy-paste bug exists in both files.

### 4. `showSubmitForm()` creates duplicate UI elements when called twice during scene creation

- **File**: `src/scenes/GameOverScene.js`, lines 68, 75, 222–265
- **Severity**: **High**
- **Status**: **RESOLVED** — added `if (this.submitFormVisible) return;` at the top of `showSubmitForm()`, making it idempotent so the second call (from async fetch completion) is a safe no-op
- **Description**: `create()` calls `fetchLeaderboard()` (async) then synchronously calls `maybeShowSubmitForm()`, which calls `showSubmitForm()`. When the async fetch completes, `fetchLeaderboard()` calls `maybeShowSubmitForm()` again (because `submitFormVisible` is `true`), which calls `showSubmitForm()` a second time. The second call creates a fresh set of UI elements (`submitLabel`, `submitInputBg`, `submitInputText`, `submitButton`) and overwrites the `this.*` properties, leaving the first set orphaned in the Phaser scene graph with no reference to destroy.
- **Reasoning**: The sequence is deterministic and triggers on every game over screen where the score qualifies (which is most games). The leaderboard starts empty (`[]`), so `leaderboard.length < 10` is always true on the first check. The async fetch completes with the same result (still < 10 entries), triggering the second call. Old Phaser Graphics and Text objects persist in memory and continue rendering — the player sees the submit form drawn twice at the same position.

### 5. Same duplicate UI bug in WinScene

- **File**: `src/scenes/WinScene.js`, lines 61, 68, 213–256
- **Severity**: **High**
- **Status**: **RESOLVED** — added `if (this.submitFormVisible) return;` at the top of `WinScene.showSubmitForm()`, identical fix to Finding 4
- **Description**: Identical to Finding 4. The same create → fetchLeaderboard → maybeShowSubmitForm → showSubmitForm sequence triggers twice, orphaning the first set of UI elements.
- **Reasoning**: Same root cause. Same deterministic trigger. Same memory leak and visual double-rendering.

---

## Medium

### 6. Ball glow and fill drawn every frame for attached balls — wasted rendering

- **File**: `src/scenes/GameScene.js`, lines 837–843
- **Severity**: **Medium**
- **Status**: **RESOLVED** — wrapped glow+fill draw calls inside the `if (!b.attached)` block, so attached balls skip all rendering (trail was already gated)
- **Description**: The ball rendering loop draws glow (`fillCircle` at radius + 3) and solid fill (`fillCircle` at radius) for **all** balls, including attached ones. Attached balls never move (their position is set to the paddle's position in `subStepBall`), so the same circles are drawn at identical pixel coordinates every frame. This is wasted GPU work — 2 redundant draw calls per frame per attached ball.
- **Reasoning**: The fix in the diff correctly moved the `if (b.attached) return;` early exit to only gate the trail (which is correct — attached balls don't need trails), but the glow and fill remained unconditional. At 60fps, a single attached ball produces 120 redundant `fillCircle` calls per second. With multi-ball (up to 8 launched + 1 attached), the attached ball adds constant wasted work.

### 7. `BALL_SKINS` lookup repeated inside per-ball loop

- **File**: `src/scenes/GameScene.js`, line 819
- **Severity**: **Medium**
- **Status**: **RESOLVED** — hoisted `const skin = BALL_SKINS[this.ballSkin] || BALL_SKINS.default;` outside the `forEach` loop, so it runs once per frame instead of once per ball
- **Description**: `const skin = BALL_SKINS[this.ballSkin] || BALL_SKINS.default;` runs once per ball per frame. `this.ballSkin` is set in `init()` and never changes during gameplay, so this lookup always returns the same value. With 1–9 balls, this is 1–9 redundant property lookups per frame.
- **Reasoning**: While the per-call cost is negligible (object property access + fallback), this pattern is a dead-idom in a 60fps loop. It also signals a structure that makes future per-skin optimizations accidentally run per-ball.

### 8. `submitScore()` has no `submitFormVisible` guard — can POST when form is hidden

- **File**: `src/scenes/GameOverScene.js`, line 301 (and `WinScene.js`, line 292)
- **Severity**: **Medium**
- **Status**: **RESOLVED** — added `!this.submitFormVisible` as the first guard in `submitScore()` in both scenes, so hidden forms cannot submit
- **Description**: `submitScore()` guards on `this.submitState !== 'idle'` and `this.nameInputText.trim().length > 0`, but does not check `this.submitFormVisible`. If `submitState` were `'idle'` on a scene where the form was hidden (e.g., via external manipulation or a future code path), `submitScore()` would POST to the API and add `submitResult` text to the scene with no visible UI feedback.
- **Reasoning**: The guard is incomplete — it trusts that `submitState` alone is sufficient to prevent submissions when the form is hidden. But `submitState` can be `'idle'` in multiple scenarios (initial state, after hide, after error recovery).

---

## Low

### 9. `this.visible = true` is dead code in GameOverScene after blink fix

- **File**: `src/scenes/GameOverScene.js`, line 86
- **Severity**: **Low**
- **Status**: **RESOLVED** — deleted the `this.visible = true;` line from `create()`
- **Description**: `this.visible = true;` is set in `create()` but never read or modified anywhere. The blink fix changed the toggle to `this.restartText.setVisible(!this.restartText.visible)` directly, so `this.visible` is now a no-op assignment.
- **Reasoning**: Harmless dead code left from the old blink implementation. It confuses readers who may assume `this.visible` controls scene visibility.

### 10. `off('keydown', undefined)` silently does nothing when handler hasn't been created

- **File**: `src/scenes/GameOverScene.js`, line 277 (and `WinScene.js`, line 268)
- **Severity**: **Low**
- **Status**: **RESOLVED** — wrapped `this.input.keyboard.off('keydown', this._submitKeyHandler)` in `if (this._submitKeyHandler)` in both scenes, so the call is skipped when no handler exists
- **Description**: When `score <= 0`, `maybeShowSubmitForm()` calls `hideSubmitForm()` before `showSubmitForm()` has ever run. At that point `this._submitKeyHandler` is `undefined`. Phaser's `off('keydown', undefined)` silently does nothing (it's a no-op — the undefined reference doesn't match any listener). This is safe today but fragile — if Phaser ever changes to throw on undefined listeners, this line crashes.
- **Reasoning**: The old code used `this.input.keyboard.off('keydown')` (no argument) which removed all keydown listeners unconditionally. The new code passes a specific handler reference that may not yet exist.

### 11. Inconsistent pointer.y threshold between GameOverScene and WinScene

- **File**: `src/scenes/GameOverScene.js`, line 93 (`FORM_Y - 40 = 505`); `src/scenes/WinScene.js`, line 86 (`TABLE_Y - 40 = 340`)
- **Severity**: **Low**
- **Status**: **RESOLVED** — changed WinScene's `TABLE_Y - 40` to `FORM_Y - 40`, matching GameOverScene's threshold
- **Description**: When the submit form is hidden, the pointerdown restart handler allows clicks only above a certain Y threshold. GameOverScene uses `FORM_Y - 40 = 505` (clickable area: y < 505). WinScene uses `TABLE_Y - 40 = 340` (clickable area: y < 340). Both scenes have identical layout constants, so the 165-pixel discrepancy is unexplained.
- **Reasoning**: This is a behavioral inconsistency between two nearly identical scenes. A player at WinScene clicking at y = 400 would not restart, while the same click at GameOverScene would.

### 12. Input listeners registered in `create()` with no `shutdown()` cleanup

- **File**: `src/scenes/GameOverScene.js`, lines 89–101 (and `WinScene.js`, lines 82–101)
- **Severity**: **Low**
- **Status**: **RESOLVED** — added `shutdown()` method to both scenes that explicitly unregisters `keydown-SPACE`, `pointerdown`, `wheel`, and `_submitKeyHandler` listeners
- **Description**: Three event listeners are registered in `create()`: `keydown-SPACE`, `pointerdown`, and `wheel`. None are unregistered before `restart()` is called. While Phaser typically cleans up input listeners on scene destruction, relying on implicit cleanup is fragile — especially with Phaser's EventEmitter-based input system.
- **Reasoning**: If a scene instance is not fully destroyed (e.g., due to Phaser's scene caching or rapid restart), old listeners can fire alongside new ones, causing double-trigger behavior.

---

## Summary

| Severity | Total | Resolved | Remaining |
|----------|-------|----------|-----------|
| Critical | 1 | 1 | 0 |
| High | 4 | 4 | 0 |
| Medium | 3 | 3 | 0 |
| Low | 4 | 4 | 0 |

**All root cause clusters resolved**:
- **Cluster A** (Findings 2–5): RESOLVED — `showSubmitForm()` now has `if (this.submitFormVisible) return;` guard and `hideSubmitForm()` now sets `this._submitKeyHandler = null;`
- **Cluster B** (Finding 1): RESOLVED — WinScene blink now uses `this.restartText.setVisible(!this.restartText.visible)`
- **Cluster C** (Findings 6–7): RESOLVED — `BALL_SKINS` lookup hoisted outside loop; glow+fill gated behind `if (!b.attached)`
