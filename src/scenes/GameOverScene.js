/**
 * GameOverScene — Thin alias for EndScreenScene.
 * Registered as 'GameOver' scene key.
 */
import { EndScreenScene } from './EndScreenScene.js';

export class GameOverScene extends EndScreenScene {
    constructor() {
        super('GameOver');
    }

    init(data) {
        super.init({
            ...data,
            cfg: {
                title: 'GAME OVER',
                titleColor: '#ff4444',
                showLevelReached: true,
                highScoreY: 240,
            },
        });
    }
}
