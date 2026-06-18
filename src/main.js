/**
 * Brick Breaker — Main entry point.
 * Phaser 3 CANVAS renderer, 800×600, scale FIT.
 */
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { WinScene } from './scenes/WinScene.js';

const config = {
    type: Phaser.CANVAS,
    width: 800,
    height: 600,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, GameScene, GameOverScene, WinScene],
    banner: false,
    backgroundColor: '#0a0a1a',
};

const game = new Phaser.Game(config);

// Expose game instance for testing (dev only)
if (typeof window !== 'undefined') {
    window.__game = game;
}
