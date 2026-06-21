/**
 * WinScene — Thin alias for EndScreenScene.
 * Registered as 'Win' scene key.
 */
import { EndScreenScene } from './EndScreenScene.js';

export class WinScene extends EndScreenScene {
    constructor() {
        super('Win');
    }

    init(data) {
        super.init({
            ...data,
            level: data.level || 5, // WinScene implies level 5 completed
            cfg: {
                title: 'YOU WIN!',
                titleColor: '#44dd44',
                showLevelReached: false,
                highScoreY: 210,
            },
        });
    }
}
