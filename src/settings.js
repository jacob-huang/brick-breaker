/**
 * Settings — localStorage persistence for user preferences.
 * Keys: soundPack, paddleSkin, ballSkin, muted, highScore.
 */
const SETTINGS_KEY = 'brickBreakerSettings';
const HIGH_SCORE_KEY = 'brickBreakerHighScore';

const DEFAULTS = {
    soundPack: 'classic',
    paddleSkin: 'default',
    ballSkin: 'default',
    muted: false,
};

/**
 * Load settings from localStorage, falling back to defaults.
 * @returns {{ soundPack: string, paddleSkin: string, ballSkin: string, muted: boolean }}
 */
export function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                soundPack: parsed.soundPack || DEFAULTS.soundPack,
                paddleSkin: parsed.paddleSkin || DEFAULTS.paddleSkin,
                ballSkin: parsed.ballSkin || DEFAULTS.ballSkin,
                muted: parsed.muted ?? DEFAULTS.muted,
            };
        }
    } catch { /* ignore */ }
    return { ...DEFAULTS };
}

/**
 * Save settings to localStorage.
 * @param {{ soundPack: string, paddleSkin: string, ballSkin: string, muted: boolean }} settings
 */
export function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch { /* ignore */ }
}

/**
 * Load high score from localStorage.
 * @returns {number}
 */
export function getHighScore() {
    try { return parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10); }
    catch { return 0; }
}

/**
 * Save high score to localStorage if new score is higher.
 * @param {number} score
 * @returns {boolean} true if the high score was updated
 */
export function saveHighScore(score) {
    try {
        const current = getHighScore();
        if (score > current) {
            localStorage.setItem(HIGH_SCORE_KEY, String(score));
            return true;
        }
    } catch { /* ignore */ }
    return false;
}
