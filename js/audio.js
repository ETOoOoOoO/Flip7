/**
 * AudioManager - Gestion des effets sonores via Web Audio API
 */

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.masterGain = null;

        // Initialiser au premier clic utilisateur nécessite une interaction
        this.initialized = false;
    }

    /**
     * Initialise le contexte audio (doit être appelé suite à une interaction utilisateur)
     */
    init() {
        if (this.initialized) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Master volume
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5; // 50% volume par défaut
            this.masterGain.connect(this.ctx.destination);

            this.initialized = true;
            console.log('Audio Context initialized');
        } catch (e) {
            console.error('Web Audio API not supported', e);
        }
    }

    /**
     * Active/Désactive le son
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.isMuted ? 0 : 0.5;
        }
        return this.isMuted;
    }

    /**
     * Son de clic bouton
     */
    playClick() {
        if (!this.initialized || this.isMuted) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);

        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

        osc.start(t);
        osc.stop(t + 0.05);
    }

    /**
     * Son de distribution de carte / Hit
     */
    playCardFlip() {
        if (!this.initialized || this.isMuted) return;

        const t = this.ctx.currentTime;

        // Noise burst for friction
        const bufferSize = this.ctx.sampleRate * 0.1; // 0.1s
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();

        // Low frequency bump
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();

        noise.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);

        // Noise envelope
        noiseGain.gain.setValueAtTime(0.2, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        // Osc envelope (snap)
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        oscGain.gain.setValueAtTime(0.3, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        noise.start(t);
        osc.start(t);

        osc.stop(t + 0.1);
        noise.stop(t + 0.1);
    }

    /**
     * Son Stay (validation)
     */
    playStay() {
        if (!this.initialized || this.isMuted) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(this.masterGain);

        // Ding high pitch
        osc.frequency.setValueAtTime(880, t); // A5
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.5);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        osc.start(t);
        osc.stop(t + 0.5);
    }

    /**
     * Son Bust (échec)
     */
    playBust() {
        if (!this.initialized || this.isMuted) return;

        const t = this.ctx.currentTime;

        // Sawtooth wave falling down
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';

        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        osc.start(t);
        osc.stop(t + 0.5);
    }

    /**
     * Son FLIP 7 ! (Victoire majeure)
     */
    playFlip7() {
        if (!this.initialized || this.isMuted) return;

        const t = this.ctx.currentTime;

        // Arpeggio C Major
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.connect(gain);
            gain.connect(this.masterGain);

            const startTime = t + i * 0.1;

            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);

            osc.start(startTime);
            osc.stop(startTime + 0.8);
        });
    }

    /**
     * Sons pour actions spéciales
     */
    playActionEffect(type) {
        if (!this.initialized || this.isMuted) return;

        const t = this.ctx.currentTime;

        if (type === 'freeze') {
            // Glassy sound (high sine waves)
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.frequency.setValueAtTime(2000, t);
            osc.frequency.exponentialRampToValueAtTime(1500, t + 0.3);

            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

            osc.start(t);
            osc.stop(t + 0.3);

        } else if (type === 'stop') {
            // Punchy bass
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);

            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

            osc.start(t);
            osc.stop(t + 0.2);

        } else if (type === 'flip-three' || type === 'flip-three-action') {
            // 3 quick swooshes
            for (let i = 0; i < 3; i++) {
                setTimeout(() => this.playCardFlip(), i * 150);
            }
        }
    }

    /**
     * Son Victoire partie
     */
    playVictory() {
        if (!this.initialized || this.isMuted) return;

        // Similar to Flip7 but longer/richer
        this.playFlip7();
        setTimeout(() => this.playFlip7(), 500);
    }
}

// Instance globale exportée
export const audioManager = new AudioManager();
