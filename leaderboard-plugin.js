/**
 * Leaderboard Vite plugin — adds GET/POST /api/leaderboard endpoints.
 * Reads/writes leaderboard.json in the project root.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'leaderboard.json');
const MAX_ENTRIES = 10;

/** Read leaderboard from disk, return array. */
function readLeaderboard() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

/** Write leaderboard to disk atomically (write to temp, then rename). */
function writeLeaderboard(data) {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, DATA_FILE);
}

/** Sanitize a player name: strip HTML, trim, lowercase, max 12 chars. */
function sanitizeName(name) {
    if (typeof name !== 'string') return '';
    return name
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '')
        .trim()
        .toLowerCase()
        .slice(0, 12);
}

/** Check if a new score qualifies for the leaderboard. */
function qualifies(newScore, leaderboard) {
    if (leaderboard.length < MAX_ENTRIES) return true;
    const lowest = leaderboard[MAX_ENTRIES - 1].score;
    return newScore > lowest;
}

export function leaderboardPlugin() {
    return {
        name: 'leaderboard',
        apply: 'serve',

        configureServer(server) {
            // server.middlewares.use() runs BEFORE Vite's internal middlewares.
            // This ensures /api/leaderboard is handled before Vite's SPA fallback.
            server.middlewares.use((req, res, next) => {
                if (!req.url || !req.url.startsWith('/api/leaderboard')) {
                    return next();
                }

                res.setHeader('Content-Type', 'application/json');

                if (req.method === 'GET') {
                    const data = readLeaderboard();
                    res.writeHead(200);
                    res.end(JSON.stringify(data));
                    return;
                }

                if (req.method === 'POST') {
                    let body = '';
                    req.on('data', chunk => { body += chunk; });
                    req.on('end', () => {
                        try {
                            const entry = JSON.parse(body);

                            if (typeof entry.score !== 'number' || entry.score <= 0) {
                                res.writeHead(400);
                                res.end(JSON.stringify({ error: 'score must be a positive number' }));
                                return;
                            }
                            if (typeof entry.name !== 'string' || !entry.name.trim()) {
                                res.writeHead(400);
                                res.end(JSON.stringify({ error: 'name is required' }));
                                return;
                            }

                            const name = sanitizeName(entry.name);
                            if (name.length === 0) {
                                res.writeHead(400);
                                res.end(JSON.stringify({ error: 'name is required' }));
                                return;
                            }

                            const leaderboard = readLeaderboard();

                            if (!qualifies(entry.score, leaderboard)) {
                                res.writeHead(400);
                                res.end(JSON.stringify({ error: 'score does not qualify' }));
                                return;
                            }

                            const newEntry = {
                                name: name,
                                score: entry.score,
                                level: entry.level || 1,
                                pack: entry.pack || 'classic',
                                skins: entry.skins || { paddle: 'default', ball: 'default' },
                                timestamp: new Date().toISOString(),
                            };

                            leaderboard.push(newEntry);
                            leaderboard.sort((a, b) => b.score - a.score);
                            leaderboard.splice(MAX_ENTRIES);
                            writeLeaderboard(leaderboard);

                            res.writeHead(200);
                            res.end(JSON.stringify(leaderboard));
                        } catch (e) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ error: 'invalid request body' }));
                        }
                    });
                    return;
                }

                res.writeHead(405);
                res.end(JSON.stringify({ error: 'method not allowed' }));
            });
        },
    };
}
