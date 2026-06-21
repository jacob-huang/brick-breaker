/**
 * AudioManager — Web Audio API oscillator-based sound effects.
 * No external audio files. Rate-limited with 40ms cooldown.
 * Supports sound pack selection (classic, retro, synth).
 */
export class AudioManager {
    /** @type {AudioManager|null} */
    static #instance = null;

    /** @type {AudioContext|null} */
    #ctx = null;

    /** Per-type cooldown map — ensures each sound type has its own 40ms cooldown */
    #lastPlayed = new Map();

    /** Whether sound is enabled */
    #enabled = true;

    /** Current sound pack name */
    #pack = 'classic';

    // ── Sound Pack Definitions ───────────────────────────────────────

    /**
     * Classic — original square/sawtooth/sine sounds.
     * Authentic 8-bit arcade feel.
     */
    static #PACK_CLASSIC = {
        bounce:    { type: 'square',  freq: 440,       dur: 0.08 },
        brick:     { type: 'square',  freqMin: 520,    freqMax: 740, dur: 0.12 },
        powerup:   { type: 'sine',    freqs: [[600,1200,0.1],[900,1400,0.15]], vol: 0.12 },
        lifeLost:  { type: 'sawtooth',freqStart: 300,  freqEnd: 80, dur: 0.3 },
        levelComplete: { type: 'square', notes: [500,600,700,800,900], noteDur: 0.15, gap: 0.1 },
        gameOver:  { type: 'sawtooth', sweeps: [[0,400,100,0.2],[0.3,300,60,0.3],[0.7,200,40,0.5]] },
    };

    /**
     * Retro — chiptune style using triangle waves.
     * Crisp, 8-bit NES-like sound.
     */
    static #PACK_RETRO = {
        bounce:    { type: 'triangle', freq: 660,       dur: 0.06 },
        brick:     { type: 'triangle', freqMin: 587,    freqMax: 880, dur: 0.1 },
        powerup:   { type: 'triangle', freqs: [[523,1046,0.08],[784,1175,0.12]], vol: 0.1 },
        lifeLost:  { type: 'square',   freqStart: 440,  freqEnd: 110, dur: 0.25 },
        levelComplete: { type: 'triangle', notes: [523,659,784,1046,1318], noteDur: 0.12, gap: 0.08 },
        gameOver:  { type: 'square',   sweeps: [[0,440,110,0.15],[0.2,349,87,0.2],[0.45,261,65,0.35]] },
    };

    /**
     * Synth — modern electronic sounds using sawtooth and sine.
     * Deeper, richer tones with longer decay.
     */
    static #PACK_SYNTH = {
        bounce:    { type: 'sawtooth', freq: 300,       dur: 0.1 },
        brick:     { type: 'sawtooth', freqMin: 220,    freqMax: 440, dur: 0.15 },
        powerup:   { type: 'sine',     freqs: [[440,880,0.12],[660,1100,0.18]], vol: 0.1 },
        lifeLost:  { type: 'sawtooth', freqStart: 220,  freqEnd: 55, dur: 0.35 },
        levelComplete: { type: 'sine', notes: [440,550,660,880,1100], noteDur: 0.18, gap: 0.12 },
        gameOver:  { type: 'sawtooth', sweeps: [[0,220,55,0.25],[0.3,174,43,0.35],[0.7,130,32,0.55]] },
    };

    /** All available packs keyed by name */
    static PACKS = {
        classic: this.#PACK_CLASSIC,
        retro:   this.#PACK_RETRO,
        synth:   this.#PACK_SYNTH,
    };

    /** @returns {string} Current pack name */
    getPack() { return this.#pack; }

    /**
     * Switch sound pack.
     * @param {string} name — 'classic', 'retro', or 'synth'
     */
    setPack(name) {
        if (name in AudioManager.PACKS) {
            this.#pack = name;
        }
    }

    /**
     * Get the config for a sound type in the current pack.
     * @param {string} type
     * @returns {object}
     */
    #getSoundConfig(type) {
        return AudioManager.PACKS[this.#pack]?.[type] || AudioManager.PACKS.classic[type];
    }

    /**
     * Create and play an oscillator from a sound config.
     * @param {string} type
     */
    #playSound(type) {
        const cfg = this.#getSoundConfig(type);
        if (!cfg) return;

        const t = this.#ctx.currentTime;
        const osc = this.#ctx.createOscillator();
        const gain = this.#ctx.createGain();

        osc.type = cfg.type;

        switch (type) {
            case 'bounce': {
                osc.frequency.setValueAtTime(cfg.freq, t);
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.dur);
                osc.connect(gain).connect(this.#ctx.destination);
                osc.start(t);
                osc.stop(t + cfg.dur);
                break;
            }

            case 'brick': {
                const row = Math.floor(Math.random() * 7);
                const range = cfg.freqMax - cfg.freqMin;
                const freq = cfg.freqMin + row * (range / 7);
                osc.frequency.setValueAtTime(freq, t);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + cfg.dur);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.dur);
                osc.connect(gain).connect(this.#ctx.destination);
                osc.start(t);
                osc.stop(t + cfg.dur);
                break;
            }

            case 'powerup': {
                // First tone
                const p1 = cfg.freqs[0];
                const osc1 = this.#ctx.createOscillator();
                const gain1 = this.#ctx.createGain();
                osc1.type = cfg.type;
                osc1.frequency.setValueAtTime(p1[0], t);
                osc1.frequency.exponentialRampToValueAtTime(p1[1], t + p1[2]);
                gain1.gain.setValueAtTime(cfg.vol, t);
                gain1.gain.exponentialRampToValueAtTime(0.001, t + p1[2]);
                osc1.connect(gain1).connect(this.#ctx.destination);
                osc1.start(t);
                osc1.stop(t + p1[2]);

                // Second tone (delayed)
                const p2 = cfg.freqs[1];
                const osc2 = this.#ctx.createOscillator();
                const gain2 = this.#ctx.createGain();
                osc2.type = cfg.type;
                osc2.frequency.setValueAtTime(p2[0], t + p1[2]);
                osc2.frequency.exponentialRampToValueAtTime(p2[1], t + p1[2] + p2[2]);
                gain2.gain.setValueAtTime(0, t);
                gain2.gain.setValueAtTime(cfg.vol, t + p1[2]);
                gain2.gain.exponentialRampToValueAtTime(0.001, t + p1[2] + p2[2]);
                osc2.connect(gain2).connect(this.#ctx.destination);
                osc2.start(t + p1[2]);
                osc2.stop(t + p1[2] + p2[2]);
                break;
            }

            case 'lifeLost': {
                osc.frequency.setValueAtTime(cfg.freqStart, t);
                osc.frequency.exponentialRampToValueAtTime(cfg.freqEnd, t + cfg.dur);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.dur);
                osc.connect(gain).connect(this.#ctx.destination);
                osc.start(t);
                osc.stop(t + cfg.dur);
                break;
            }

            case 'levelComplete': {
                const { notes, noteDur, gap } = cfg;
                notes.forEach((freq, i) => {
                    const noteStart = t + i * (noteDur + gap);
                    const nOsc = this.#ctx.createOscillator();
                    const nGain = this.#ctx.createGain();
                    nOsc.type = cfg.type;
                    nOsc.frequency.setValueAtTime(freq, noteStart);
                    nGain.gain.setValueAtTime(0.1, noteStart);
                    nGain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDur);
                    nOsc.connect(nGain).connect(this.#ctx.destination);
                    nOsc.start(noteStart);
                    nOsc.stop(noteStart + noteDur);
                });
                break;
            }

            case 'gameOver': {
                cfg.sweeps.forEach(s => {
                    const [offset, freqStart, freqEnd, dur] = s;
                    const sweepStart = t + offset;
                    const sOsc = this.#ctx.createOscillator();
                    const sGain = this.#ctx.createGain();
                    sOsc.type = cfg.type;
                    sOsc.frequency.setValueAtTime(freqStart, sweepStart);
                    sOsc.frequency.exponentialRampToValueAtTime(freqEnd, sweepStart + dur);
                    sGain.gain.setValueAtTime(0.1, sweepStart);
                    sGain.gain.exponentialRampToValueAtTime(0.001, sweepStart + dur);
                    sOsc.connect(sGain).connect(this.#ctx.destination);
                    sOsc.start(sweepStart);
                    sOsc.stop(sweepStart + dur);
                });
                break;
            }

            default:
                break;
        }
    }

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
     * Set muted state directly.
     * @param {boolean} muted
     */
    setMuted(muted) {
        this.#enabled = !muted;
    }

    /**
     * Play a sound — per-type rate-limited to 40ms cooldown.
     * Each sound type (bounce, brick, etc.) has its own cooldown timer,
     * so rapid brick destructions don't silently drop sounds.
     * @param {string} type — Sound type identifier
     */
    play(type) {
        if (!this.#enabled || !this.#ctx) return;
        if (this.#ctx.state === 'suspended') {
            this.#ctx.resume();
        }

        const now = performance.now();
        const last = this.#lastPlayed.get(type) || 0;
        if (now - last < 40) return;
        this.#lastPlayed.set(type, now);

        this.#playSound(type);
    }
}
