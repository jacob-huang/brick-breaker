/**
 * AudioManager — Web Audio API oscillator-based sound effects.
 * No external audio files. Rate-limited with 40ms cooldown.
 */
export class AudioManager {
    /** @type {AudioManager|null} */
    static #instance = null;

    /** @type {AudioContext|null} */
    #ctx = null;

    /** Last sound timestamp (ms) — enforces 40ms cooldown */
    #lastTime = 0;

    /** Whether sound is enabled */
    #enabled = true;

    /**
     * @returns {AudioManager}
     */
    static get instance() {
        if (!AudioManager.#instance) {
            AudioManager.#instance = new AudioManager();
        }
        return AudioManager.#instance;
    }

    constructor() {
        try {
            this.#ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
            // Audio not available — all sound calls become no-ops
            this.#ctx = null;
        }
    }

    /** Resume the audio context (needed after user gesture) */
    resume() {
        if (this.#ctx && this.#ctx.state === 'suspended') {
            this.#ctx.resume();
        }
    }

    toggle() {
        this.#enabled = !this.#enabled;
        return this.#enabled;
    }

    /**
     * Play a sound — rate-limited to 40ms cooldown.
     * @param {string} type — Sound type identifier
     */
    play(type) {
        if (!this.#enabled || !this.#ctx) return;
        if (this.#ctx.state === 'suspended') {
            this.#ctx.resume();
        }

        const now = performance.now();
        if (now - this.#lastTime < 40) return;
        this.#lastTime = now;

        switch (type) {
            case 'bounce': this.#bounce(); break;
            case 'brick': this.#brick(); break;
            case 'powerup': this.#powerup(); break;
            case 'lifeLost': this.#lifeLost(); break;
            case 'levelComplete': this.#levelComplete(); break;
            case 'gameOver': this.#gameOver(); break;
            default: break;
        }
    }

    /** Square wave 440 Hz, 80ms — ball wall/paddle bounce */
    #bounce() {
        const t = this.#ctx.currentTime;
        const osc = this.#ctx.createOscillator();
        const gain = this.#ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, t);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain).connect(this.#ctx.destination);
        osc.start(t);
        osc.stop(t + 0.08);
    }

    /** Square wave row-dependent 520→740 Hz, 120ms descending slide — brick hit */
    #brick() {
        const t = this.#ctx.currentTime;
        const row = Math.floor(Math.random() * 7);
        const freq = 520 + row * (220 / 7);
        const osc = this.#ctx.createOscillator();
        const gain = this.#ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.12);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain).connect(this.#ctx.destination);
        osc.start(t);
        osc.stop(t + 0.12);
    }

    /** Sine 600→1200 Hz then 900→1400 Hz, 100ms+150ms — power-up pickup */
    #powerup() {
        const t = this.#ctx.currentTime;

        const osc1 = this.#ctx.createOscillator();
        const gain1 = this.#ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(600, t);
        osc1.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
        gain1.gain.setValueAtTime(0.12, t);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc1.connect(gain1).connect(this.#ctx.destination);
        osc1.start(t);
        osc1.stop(t + 0.1);

        const osc2 = this.#ctx.createOscillator();
        const gain2 = this.#ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(900, t + 0.15);
        osc2.frequency.exponentialRampToValueAtTime(1400, t + 0.3);
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.setValueAtTime(0.12, t + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc2.connect(gain2).connect(this.#ctx.destination);
        osc2.start(t + 0.15);
        osc2.stop(t + 0.3);
    }

    /** Sawtooth 300→80 Hz, 300ms descending — life lost */
    #lifeLost() {
        const t = this.#ctx.currentTime;
        const osc = this.#ctx.createOscillator();
        const gain = this.#ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.3);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain).connect(this.#ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    /** Square wave 5-note fanfare 500→900 Hz, 150ms each, 100ms apart — level complete */
    #levelComplete() {
        const t = this.#ctx.currentTime;
        const notes = [500, 600, 700, 800, 900];
        notes.forEach((freq, i) => {
            const noteStart = t + i * 0.1;
            const osc = this.#ctx.createOscillator();
            const gain = this.#ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, noteStart);
            gain.gain.setValueAtTime(0.1, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.15);
            osc.connect(gain).connect(this.#ctx.destination);
            osc.start(noteStart);
            osc.stop(noteStart + 0.15);
        });
    }

    /** Three descending sawtooth sweeps — game over */
    #gameOver() {
        const t = this.#ctx.currentTime;
        const sweeps = [
            { start: t, freqStart: 400, freqEnd: 100, dur: 0.2 },
            { start: t + 0.3, freqStart: 300, freqEnd: 60, dur: 0.3 },
            { start: t + 0.7, freqStart: 200, freqEnd: 40, dur: 0.5 },
        ];
        sweeps.forEach(s => {
            const osc = this.#ctx.createOscillator();
            const gain = this.#ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(s.freqStart, s.start);
            osc.frequency.exponentialRampToValueAtTime(s.freqEnd, s.start + s.dur);
            gain.gain.setValueAtTime(0.1, s.start);
            gain.gain.exponentialRampToValueAtTime(0.001, s.start + s.dur);
            osc.connect(gain).connect(this.#ctx.destination);
            osc.start(s.start);
            osc.stop(s.start + s.dur);
        });
    }
}
