/**
 * WinScene — Thin alias for EndScreenScene.
 * Registered as 'Win' scene key.
 */
import { EndScreenScene } from './EndScreenScene.js';
import { TOTAL_LEVELS } from '../constants.js';

export class WinScene extends EndScreenScene {
    constructor() {
        super('Win');
    }

    init(data) {
        super.init({
            ...data,
            level: data.level || TOTAL_LEVELS, // WinScene implies last level completed
            cfg: {
                title: 'YOU WIN!',
                titleColor: '#44dd44',
                showLevelReached: false,
                highScoreY: 210,
            },
        });
    }
}
