// Sound System for Lucky's Market Run
// Using Web Audio API for synthesized sounds - no external files needed

class SoundSystem {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3;
        this.musicVolume = 0.4;
        this.initialized = false;
        this.bgMusic = null;
        this.musicPlaying = false;

        // Music rotation system
        this.musicTracks = ['MainTheme.mp3', 'MainTheme2.mp3', 'MainTheme3.mp3'];
        this.currentTrackIndex = 0;
    }

    async init() {
        if (this.initialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;

            // Initialize background music
            this.initBackgroundMusic();
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }

    initBackgroundMusic() {
        this.bgMusic = new Audio(this.musicTracks[this.currentTrackIndex]);
        this.bgMusic.loop = false; // Don't loop - we'll handle track changes
        this.bgMusic.volume = this.musicVolume;

        // When track ends, switch to next track
        this.bgMusic.addEventListener('ended', () => {
            // Switch to next track
            this.currentTrackIndex = (this.currentTrackIndex + 1) % this.musicTracks.length;
            console.log(`Switching to track ${this.currentTrackIndex + 1}: ${this.musicTracks[this.currentTrackIndex]}`);

            // Load and play new track
            this.bgMusic.src = this.musicTracks[this.currentTrackIndex];

            // Continue playing if music was on
            if (this.musicPlaying) {
                this.bgMusic.play().catch(e => console.warn('Could not play next track:', e));
            }
        });

        // Handle autoplay restrictions
        this.bgMusic.addEventListener('canplaythrough', () => {
            console.log('Background music loaded and ready:', this.musicTracks[this.currentTrackIndex]);
        });

        this.bgMusic.addEventListener('error', (e) => {
            console.warn('Could not load background music:', e);
            // Try next track if current one fails
            if (this.musicPlaying) {
                this.currentTrackIndex = (this.currentTrackIndex + 1) % this.musicTracks.length;
                this.bgMusic.src = this.musicTracks[this.currentTrackIndex];
            }
        });
    }

    startMusic() {
        if (!this.bgMusic || this.musicPlaying || !this.enabled) return;

        this.bgMusic.play().then(() => {
            this.musicPlaying = true;
            console.log('Background music started:', this.musicTracks[this.currentTrackIndex]);
        }).catch(e => {
            console.warn('Could not autoplay music:', e);
        });
    }

    stopMusic() {
        if (!this.bgMusic) return;
        this.bgMusic.pause();
        this.musicPlaying = false;
    }

    toggleMusic() {
        if (this.musicPlaying) {
            this.stopMusic();
        } else {
            this.startMusic();
        }
        return this.musicPlaying;
    }

    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        if (this.bgMusic) {
            this.bgMusic.volume = this.musicVolume;
        }
    }

    async ensureContext() {
        if (!this.audioContext) {
            await this.init();
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // Create an oscillator with envelope
    createTone(frequency, duration, type = 'sine', attack = 0.01, decay = 0.1) {
        if (!this.enabled || !this.audioContext) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + attack);
        gain.gain.linearRampToValueAtTime(this.volume * 0.7, this.audioContext.currentTime + attack + decay);
        gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start(this.audioContext.currentTime);
        osc.stop(this.audioContext.currentTime + duration);

        return osc;
    }

    // Play multiple tones as a chord
    playChord(frequencies, duration, type = 'sine') {
        if (!this.enabled || !this.audioContext) return;

        frequencies.forEach((freq, i) => {
            setTimeout(() => {
                this.createTone(freq, duration, type, 0.01, 0.15);
            }, i * 30); // Slight stagger for richness
        });
    }

    // UI Click - subtle tick
    click() {
        this.ensureContext().then(() => {
            this.createTone(800, 0.05, 'sine', 0.001, 0.02);
        });
    }

    // Candle advance - soft tick
    tick() {
        this.ensureContext().then(() => {
            if (!this.enabled || !this.audioContext) return;

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, this.audioContext.currentTime);
            osc.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.03);

            gain.gain.setValueAtTime(this.volume * 0.2, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.03);

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.start();
            osc.stop(this.audioContext.currentTime + 0.03);
        });
    }

    // Trade opened - satisfying "entry" sound
    tradeOpen() {
        this.ensureContext().then(() => {
            // Rising arpeggio
            const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
            notes.forEach((freq, i) => {
                setTimeout(() => {
                    this.createTone(freq, 0.2, 'sine', 0.01, 0.1);
                }, i * 60);
            });
        });
    }

    // Win sound - triumphant chord
    win() {
        this.ensureContext().then(() => {
            // Major chord with fanfare feel
            this.playChord([523.25, 659.25, 783.99, 1046.5], 0.6, 'sine');

            // Add sparkle
            setTimeout(() => {
                this.createTone(1318.51, 0.3, 'sine', 0.01, 0.1);
            }, 200);
            setTimeout(() => {
                this.createTone(1567.98, 0.4, 'sine', 0.01, 0.1);
            }, 350);
        });
    }

    // Big win sound - extra triumphant
    bigWin() {
        this.ensureContext().then(() => {
            // Ascending fanfare
            const fanfare = [
                { freq: 523.25, delay: 0 },
                { freq: 659.25, delay: 100 },
                { freq: 783.99, delay: 200 },
                { freq: 1046.5, delay: 300 },
                { freq: 1318.51, delay: 450 },
                { freq: 1567.98, delay: 600 },
            ];

            fanfare.forEach(({ freq, delay }) => {
                setTimeout(() => {
                    this.createTone(freq, 0.5, 'sine', 0.01, 0.2);
                }, delay);
            });

            // Final chord
            setTimeout(() => {
                this.playChord([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.8, 'sine');
            }, 700);
        });
    }

    // Loss sound - descending tone
    lose() {
        this.ensureContext().then(() => {
            if (!this.enabled || !this.audioContext) return;

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, this.audioContext.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.4);

            gain.gain.setValueAtTime(this.volume * 0.4, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.4);

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.start();
            osc.stop(this.audioContext.currentTime + 0.4);
        });
    }

    // Level complete - celebratory jingle
    levelComplete() {
        this.ensureContext().then(() => {
            const melody = [
                { freq: 523.25, delay: 0, dur: 0.15 },    // C
                { freq: 587.33, delay: 150, dur: 0.15 }, // D
                { freq: 659.25, delay: 300, dur: 0.15 }, // E
                { freq: 783.99, delay: 450, dur: 0.15 }, // G
                { freq: 1046.5, delay: 600, dur: 0.4 },  // High C
            ];

            melody.forEach(({ freq, delay, dur }) => {
                setTimeout(() => {
                    this.createTone(freq, dur, 'sine', 0.01, dur * 0.3);
                }, delay);
            });
        });
    }

    // Near stop loss warning - tension build
    warning() {
        this.ensureContext().then(() => {
            if (!this.enabled || !this.audioContext) return;

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, this.audioContext.currentTime);

            gain.gain.setValueAtTime(0, this.audioContext.currentTime);
            gain.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.05);
            gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1);
            gain.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.15);
            gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.2);

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.start();
            osc.stop(this.audioContext.currentTime + 0.2);
        });
    }

    // Streak sound - ascending intensity
    streak(count) {
        this.ensureContext().then(() => {
            const baseFreq = 523.25 + (count * 50); // Higher pitch for longer streaks
            this.playChord([baseFreq, baseFreq * 1.25, baseFreq * 1.5], 0.3, 'sine');
        });
    }

    // Splash screen intro
    intro() {
        this.ensureContext().then(() => {
            const intro = [
                { freq: 261.63, delay: 0, dur: 0.3 },     // C4
                { freq: 329.63, delay: 200, dur: 0.3 },   // E4
                { freq: 392.00, delay: 400, dur: 0.3 },   // G4
                { freq: 523.25, delay: 600, dur: 0.5 },   // C5
            ];

            intro.forEach(({ freq, delay, dur }) => {
                setTimeout(() => {
                    this.createTone(freq, dur, 'sine', 0.05, dur * 0.5);
                }, delay);
            });
        });
    }

    // Button hover
    hover() {
        this.ensureContext().then(() => {
            this.createTone(600, 0.03, 'sine', 0.001, 0.01);
        });
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stopMusic();
        }
        return this.enabled;
    }

    // Toggle just the sound effects (not music)
    toggleSFX() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }
}

// Export singleton
const sounds = new SoundSystem();
export default sounds;
