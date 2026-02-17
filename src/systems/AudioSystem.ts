import { AUDIO_CONF } from '../utils/Constants';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private initialized = false;

  // Wind sound
  private windOsc: OscillatorNode | null = null;
  private windGain: GainNode | null = null;

  // Ground rush sound (IMPROVEMENT #6)
  private groundRushOsc: OscillatorNode | null = null;
  private groundRushGain: GainNode | null = null;

  // Background music
  private musicOscs: OscillatorNode[] = [];
  private musicGains: GainNode[] = [];
  private musicBeat = 0;
  private musicMeasure = 0;
  private musicNextBeatTime = 0;
  private musicBPM = 95;
  private musicIntensity = 0; // 0=calm, 1=intense (driven by gameplay)
  private musicTargetIntensity = 0;

  // Ambient city
  private ambientGain: GainNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;

  init(): void {
    if (this.initialized) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = AUDIO_CONF.MASTER_VOLUME;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = AUDIO_CONF.SFX_VOLUME;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = AUDIO_CONF.MUSIC_VOLUME;
    this.musicGain.connect(this.masterGain);

    this.startWindAmbience();
    this.startBackgroundMusic();
    this.startAmbientCity();
    this.initialized = true;
  }

  private startWindAmbience(): void {
    if (!this.ctx || !this.musicGain) return;

    // Create wind-like noise using filtered oscillators
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.15;

    noise.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.musicGain);
    noise.start();
  }

  updateWind(speed: number, altitude: number): void {
    if (!this.windGain || !this.ctx) return;
    const intensity = Math.min(speed / 80, 1) * 0.3;
    const altFactor = Math.min(altitude / 100, 1) * 0.1;
    this.windGain.gain.setTargetAtTime(
      intensity + altFactor,
      this.ctx.currentTime,
      0.3,
    );
  }

  playPoop(): void {
    // Very subtle drop sound — present but not annoying over time
    this.playTone(180, 0.06, 'sine', 0.06);
    setTimeout(() => this.playTone(130, 0.08, 'sine', 0.04), 35);
  }

  playHit(momentum: number = 0): void {
    if (!this.ctx || !this.sfxGain) return;

    // Satisfying splat: filtered noise burst + low thud
    const volume = 0.12 + momentum * 0.08;

    // Noise burst for "splat" texture
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 350 + momentum * 200;
    filter.Q.value = 1.2;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = volume;
    noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start();
    noise.stop(this.ctx.currentTime + 0.12);

    // Low thud for impact weight
    this.playTone(100 + momentum * 30, 0.1, 'sine', volume * 0.5);
    // Light high-end "splck" for crispness
    this.playTone(1800 + Math.random() * 400, 0.03, 'sine', volume * 0.2);
  }

  playComboTierUp(tierIndex: number): void {
    // Escalating chime fanfare based on combo tier
    const baseFreq = 523 + tierIndex * 80;
    const volume = Math.min(0.25, 0.12 + tierIndex * 0.02);
    const count = Math.min(tierIndex + 1, 4);

    for (let i = 0; i < count; i++) {
      const freq = baseFreq * (1 + i * 0.25);
      setTimeout(() => this.playTone(freq, 0.15, 'sine', volume * (1 - i * 0.15)), i * 70);
    }
  }

  playBank(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.15, 'sine', 0.25), i * 80);
    });
  }

  playGrounded(): void {
    this.playTone(300, 0.3, 'sawtooth', 0.3);
    setTimeout(() => this.playTone(200, 0.4, 'sawtooth', 0.2), 100);
  }

  playBankCancel(): void {
    this.playTone(400, 0.08, 'square', 0.15);
    this.playTone(300, 0.12, 'square', 0.1);
  }

  playBoost(): void {
    this.playTone(400, 0.1, 'sine', 0.2);
    this.playTone(600, 0.15, 'sine', 0.15);
  }

  playLevelUp(): void {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'sine', 0.3), i * 100);
    });
  }

  playLaugh(): void {
    // Comedic descending tones for first-drop celebration
    const notes = [1200, 1000, 800, 600, 500];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.12, 'sine', 0.25), i * 70);
    });
  }

  playEmote(): void {
    // Bird squawk
    this.playTone(1000, 0.05, 'sawtooth', 0.15);
    this.playTone(1500, 0.08, 'sawtooth', 0.1);
    this.playTone(800, 0.06, 'sawtooth', 0.12);
  }

  playWantedSting(): void {
    // No-op — heat/wanted system removed
  }

  playBankingLoop(): void {
    // Soft tension loop during banking channel
    const notes = [440, 523, 587];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, 'sine', 0.15), i * 200);
    });
  }

  playBankingSuccess(): void {
    // Lock-in success chime
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'sine', 0.3), i * 60);
    });
  }

  /** Swoosh sound when bird flies through NPCs — ascending tone burst */
  playScatter(speed: number = 30, npcCount: number = 1): void {
    const speedFactor = Math.min(speed / 60, 1.5);
    const volume = Math.min(0.15 + npcCount * 0.03, 0.35);

    // Quick ascending swoosh
    this.playTone(300 * speedFactor, 0.08, 'sine', volume);
    setTimeout(() => this.playTone(500 * speedFactor, 0.06, 'sine', volume * 0.8), 30);
    setTimeout(() => this.playTone(700 * speedFactor, 0.05, 'sine', volume * 0.5), 60);

    // Extra impact thud for cluster hits
    if (npcCount >= 3) {
      this.playTone(120, 0.1, 'triangle', 0.2);
    }
  }

  playCarEnter(): void {
    this.playTone(200, 0.08, 'square', 0.15);
    setTimeout(() => this.playTone(350, 0.1, 'square', 0.12), 50);
    setTimeout(() => this.playTone(500, 0.06, 'sine', 0.1), 100);
  }

  playCarExit(): void {
    this.playTone(500, 0.06, 'sine', 0.1);
    setTimeout(() => this.playTone(350, 0.08, 'square', 0.12), 50);
    setTimeout(() => this.playTone(200, 0.1, 'square', 0.15), 100);
  }

  playUIClick(): void {
    // Subtle click
    this.playTone(800, 0.03, 'sine', 0.15);
  }

  private playTone(freq: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.01);
  }

  /** IMPROVEMENT #6: Ground proximity audio feedback */
  updateGroundRush(altitude: number, speed: number): void {
    if (!this.ctx || !this.musicGain) return;

    const shouldPlay = altitude < 8 && speed > 30;

    if (shouldPlay && !this.groundRushOsc) {
      // Start low rumble when ground skimming
      this.groundRushOsc = this.ctx.createOscillator();
      this.groundRushOsc.type = 'sawtooth';
      this.groundRushOsc.frequency.value = 60;

      this.groundRushGain = this.ctx.createGain();
      const intensity = Math.min((speed / 80) * 0.15, 0.2);
      this.groundRushGain.gain.value = intensity;

      this.groundRushOsc.connect(this.groundRushGain);
      this.groundRushGain.connect(this.musicGain);
      this.groundRushOsc.start();
    } else if (!shouldPlay && this.groundRushOsc) {
      // Stop rumble
      this.groundRushOsc.stop();
      this.groundRushOsc = null;
      this.groundRushGain = null;
    } else if (shouldPlay && this.groundRushGain) {
      // Update intensity based on speed
      const intensity = Math.min((speed / 80) * 0.15, 0.2);
      this.groundRushGain.gain.setTargetAtTime(intensity, this.ctx.currentTime, 0.1);
    }
  }

  // =========================================================================
  // Background Music — procedural lo-fi chill/action adaptive soundtrack
  // =========================================================================

  private startBackgroundMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    this.musicNextBeatTime = this.ctx.currentTime + 0.5;
    this.scheduleMusicLoop();
  }

  private scheduleMusicLoop(): void {
    if (!this.ctx) return;
    const scheduleAhead = 0.2; // schedule notes 200ms ahead
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      while (this.musicNextBeatTime < this.ctx.currentTime + scheduleAhead) {
        this.playMusicBeat(this.musicNextBeatTime);
        const beatDuration = 60 / this.musicBPM;
        this.musicNextBeatTime += beatDuration;
        this.musicBeat = (this.musicBeat + 1) % 16;
        if (this.musicBeat === 0) this.musicMeasure++;
      }
      // Smooth intensity transitions
      this.musicIntensity += (this.musicTargetIntensity - this.musicIntensity) * 0.02;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private playMusicBeat(time: number): void {
    if (!this.ctx || !this.musicGain) return;

    // Chord progression: Am - F - C - G (classic uplifting loop)
    const chordSets = [
      [220, 261.63, 329.63],  // Am
      [174.61, 220, 261.63],  // F
      [261.63, 329.63, 392],  // C
      [196, 246.94, 293.66],  // G
    ];
    const chordIndex = Math.floor(this.musicMeasure % 4);
    const chord = chordSets[chordIndex];
    const beat = this.musicBeat;

    // Bass line — plays on beats 0, 4, 8, 12 (quarter notes)
    if (beat % 4 === 0) {
      const bassFreq = chord[0] / 2; // one octave down
      this.playMusicNote(bassFreq, time, 0.25, 'triangle', 0.08 + this.musicIntensity * 0.04);
    }

    // Pad chords — sustained, quiet, dreamy
    if (beat === 0) {
      for (const freq of chord) {
        this.playMusicNote(freq, time, 1.5, 'sine', 0.025 + this.musicIntensity * 0.01);
      }
    }

    // Arpeggio — 8th notes, plays the chord tones in a pattern
    if (beat % 2 === 0) {
      const arpeggioNote = chord[beat % chord.length];
      const octave = (beat % 8 < 4) ? 2 : 1; // alternate octaves
      this.playMusicNote(
        arpeggioNote * octave,
        time,
        0.12,
        'sine',
        0.03 + this.musicIntensity * 0.025,
      );
    }

    // Hi-hat pattern — gets busier as intensity increases
    const hihatPattern = this.musicIntensity > 0.4
      ? [true, false, true, true, true, false, true, false,
         true, false, true, true, true, false, true, true]
      : [true, false, false, false, true, false, false, false,
         true, false, false, false, true, false, false, false];
    if (hihatPattern[beat]) {
      this.playPercussion(time, 'hihat', 0.02 + this.musicIntensity * 0.015);
    }

    // Kick drum on strong beats
    if (beat === 0 || beat === 8 || (this.musicIntensity > 0.5 && (beat === 4 || beat === 12))) {
      this.playPercussion(time, 'kick', 0.06 + this.musicIntensity * 0.03);
    }

    // Melody line — simple pentatonic phrase that appears during intense moments
    if (this.musicIntensity > 0.3) {
      const pentatonic = [0, 3, 5, 7, 10, 12, 15]; // semitone intervals
      const melodyPattern = [0, -1, 2, -1, 4, -1, 3, -1, 5, -1, 4, -1, 2, -1, 0, -1];
      const melodyIndex = melodyPattern[beat];
      if (melodyIndex >= 0) {
        const baseNote = chord[0] * 2; // melody an octave above root
        const semitones = pentatonic[melodyIndex % pentatonic.length];
        const freq = baseNote * Math.pow(2, semitones / 12);
        this.playMusicNote(
          freq, time, 0.15, 'sine',
          0.025 * this.musicIntensity,
        );
      }
    }
  }

  private playMusicNote(freq: number, time: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.ctx || !this.musicGain) return;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gain = this.ctx.createGain();
    // Soft attack
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.02);
    gain.gain.setValueAtTime(volume, time + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  private playPercussion(time: number, type: 'kick' | 'hihat', volume: number): void {
    if (!this.ctx || !this.musicGain) return;

    if (type === 'kick') {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.08);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.2);
    } else {
      // Hi-hat: short burst of filtered noise
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.04);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 8000;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      noise.start(time);
      noise.stop(time + 0.06);
    }
  }

  /** Update music intensity based on gameplay state (0 = exploring, 1 = combo chaos) */
  setMusicIntensity(intensity: number): void {
    this.musicTargetIntensity = Math.max(0, Math.min(1, intensity));
  }

  // =========================================================================
  // Ambient City Soundscape
  // =========================================================================

  private startAmbientCity(): void {
    if (!this.ctx || !this.musicGain) return;

    // City ambience: filtered brown noise (low rumble of traffic/crowds)
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02; // brown noise
      data[i] = lastOut * 3.5;
    }

    this.ambientNoise = this.ctx.createBufferSource();
    this.ambientNoise.buffer = buffer;
    this.ambientNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 250;
    filter.Q.value = 0.3;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.06;

    this.ambientNoise.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.musicGain);
    this.ambientNoise.start();
  }

  /** Adjust city ambience volume based on altitude (louder when low, quiet when high) */
  updateAmbientCity(altitude: number): void {
    if (!this.ambientGain || !this.ctx) return;
    // Full volume at ground, fades to ~20% at altitude 100+
    const factor = Math.max(0.02, 1 - altitude / 120);
    this.ambientGain.gain.setTargetAtTime(0.06 * factor, this.ctx.currentTime, 0.5);
  }

  setMasterVolume(v: number): void {
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  setSFXVolume(v: number): void {
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  setMusicVolume(v: number): void {
    if (this.musicGain) this.musicGain.gain.value = v;
  }
}
