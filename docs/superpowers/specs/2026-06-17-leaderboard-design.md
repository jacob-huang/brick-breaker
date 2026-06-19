# LAN Leaderboard — Design Spec

Brick Breaker LAN Leaderboard — a local network scoreboard persisted on disk, accessible from the Menu, Game Over, and Win scenes.

## Architecture

```
Browser (client) ──HTTP──▶ Vite dev server ──▶ leaderboard.json (on disk)
     │                              │
     │  GET /api/leaderboard        │  reads & returns top 10
     │  POST /api/leaderboard       │  appends, sorts, truncates, writes
```

The Vite dev server gains two API endpoints via a custom Vite plugin. The plugin reads/writes `leaderboard.json` in the project root. Zero external dependencies.

## Data Model

`leaderboard.json` — JSON array of up to 10 entries, sorted by score descending:

```json
[
  {
    "name": "jacob",
    "score": 12450,
    "level": 5,
    "pack": "synth",
    "skins": {"paddle": "fire", "ball": "rainbow"},
    "timestamp": "2026-06-17T14:32:00Z"
  }
]
```

Fields:
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Player alias, max 12 chars, sanitized |
| `score` | number | Numeric score |
| `level` | number | Level reached (1–5) |
| `pack` | string | Sound pack used (`classic`, `retro`, `synth`) |
| `skins` | object | `{paddle, ball}` skin keys |
| `timestamp` | string | ISO 8601 submission time |

## Vite Plugin

**File**: `leaderboard-plugin.js` at project root.

**API endpoints**:
- `GET /api/leaderboard` — returns `leaderboard.json` as JSON array
- `POST /api/leaderboard` — accepts `{name, score, level, pack, skins}`, appends entry, sorts by score desc, truncates to 10, writes to `leaderboard.json`, returns updated list

**Behavior**:
- File path: `leaderboard.json` in project root
- Creates file if missing (empty array)
- Atomic writes (write to temp file, then `fs.rename`)
- Sanitizes `name` input: strip HTML, max 12 chars, trim whitespace
- Rejects POST if score is not a positive number
- Rejects POST if list already has 10 entries and new score is not high enough
- Rejects POST if name is empty or exceeds 12 chars

**Error handling**:
- 400 Bad Request for invalid POST data
- 500 Internal Server Error for file I/O failures
- Returns JSON error messages

## LeaderboardScene

**File**: `src/scenes/LeaderboardScene.js`

**Entry**: Menu scene "LEADERBOARD" button.

**UI layout** (800×600):
- Title: "LEADERBOARD" at top center
- Scrollable table (x=200, y=60, width=400, height=400):
  - Header row: Rank | User | Score | Date & Time
  - Up to 10 data rows, scrollable if content exceeds 400px height
  - Row format: `#X  Name       Score    DD/MM/YYYY HH:MM`
- "BACK" button at bottom center

**Behavior**:
- Fetches leaderboard from `GET /api/leaderboard` on scene create
- Displays empty table with "NO SCORES YET" if list is empty
- Fetches on every scene entry (always fresh)
- Back button returns to MenuScene

**Rendering**: Uses Phaser Graphics for table borders, Phaser Text for content. Scrollable region implemented via clipping mask — items outside the viewport are not drawn.

## Game Over / Win Scene Extensions

**Existing scenes**: `src/scenes/GameOverScene.js`, `src/scenes/WinScene.js`

**Changes**:
1. After showing the player's result, fetch leaderboard from `GET /api/leaderboard`
2. Display top 10 scrollable table below the player's result
3. If score qualifies (top 10 or list has < 10 entries):
   - Show name input field + "SUBMIT" button
   - On submit: POST to `/api/leaderboard`, then refresh table
   - Show "NEW #X!" confirmation after successful submission
4. If server is unreachable: show "SERVER OFFLINE" below the player's result, hide submit form

**Player result section** (existing, unchanged):
- Final score, level reached, high score comparison

**Leaderboard table** (new, below player result):
- Header: "TOP 10"
- Scrollable table: Rank | User | Score | Date & Time
- Same rendering as LeaderboardScene

**Submit form** (conditional):
- Label: "YOUR SCORE QUALIFIED!"
- Input: text field for name (max 12 chars)
- Button: "SUBMIT"
- On success: replace form with "NEW #X!" message
- On failure: show error message

**Layout** (Game Over / Win combined):
- Top: player result (existing)
- Middle: leaderboard table (scrollable, up to 250px)
- Bottom: submit form (if qualifies) or "SERVER OFFLINE" (if unreachable)
- Footer: "PRESS SPACE TO CONTINUE"

## Error Handling

- **Server unreachable**: All leaderboard fetches/submits show "SERVER OFFLINE"
- **Invalid response**: Gracefully degrade to empty table
- **File corruption**: If `leaderboard.json` is invalid JSON, reset to empty array and log warning
- **Network timeout**: 3-second timeout on all fetch calls

## Testing

**New Playwright tests** (add to `tests/brick-breaker.spec.cjs`):
1. LeaderboardScene exists and loads from Menu
2. LeaderboardScene displays empty state when no scores
3. LeaderboardScene displays scores after submission
4. Game Over scene shows leaderboard table
5. Game Over scene shows submit form when score qualifies
6. Submit score posts to server and refreshes table
7. Win scene shows leaderboard table
8. Server offline handling — "SERVER OFFLINE" displayed
9. Name sanitization — HTML stripped, max 12 chars
10. Duplicate name handling — same name allowed (multiple entries)

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `leaderboard-plugin.js` | **New** | Vite plugin for API endpoints |
| `src/scenes/LeaderboardScene.js` | **New** | Dedicated leaderboard scene |
| `src/scenes/GameOverScene.js` | Modify | Add leaderboard table + submit form |
| `src/scenes/WinScene.js` | Modify | Add leaderboard table + submit form |
| `src/scenes/MenuScene.js` | Modify | Add "LEADERBOARD" button |
| `tests/brick-breaker.spec.cjs` | Modify | Add leaderboard tests |
| `package.json` | Unchanged | No new dependencies |
| `leaderboard.json` | Created at runtime | Score data file |
