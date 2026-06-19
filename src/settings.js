/**
 * Settings — localStorage persistence for user preferences.
 * Keys: soundPack, paddleSkin, ballSkin.
 */
const SETTINGS_KEY = 'brickBreakerSettings';

const DEFAULTS = {
    soundPack: 'classic',
    paddleSkin: 'default',
    ballSkin: 'default',
};

/**
 * Load settings from localStorage, falling back to defaults.
 * @returns {{ soundPack: string, paddleSkin: string, ballSkin: string }}
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
            };
        }
    } catch { /* ignore */ }
    return { ...DEFAULTS };
}

/**
 * Save settings to localStorage.
 * @param {{ soundPack: string, paddleSkin: string, ballSkin: string }} settings
 */
export function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch { /* ignore */ }
}
