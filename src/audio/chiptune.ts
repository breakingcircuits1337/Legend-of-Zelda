/**
 * Authentic NES 2A03 Chiptune Synthesizer Engine
 * Simulates:
 * - Pulse 1 (Lead Melody with duty cycles 12.5%, 25%, 50%)
 * - Pulse 2 (Harmony / Counterpoint)
 * - Triangle (Stepped bassline)
 * - Noise (NES LFSR percussion & crunchy sound effects)
 */

class ChiptuneEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;

  private currentBgm: string | null = null;
  private bgmTimer: number | null = null;
  private bgmStep: number = 0;
  private activeVoices: Array<AudioNode> = [];

  // Low health warning oscillator
  private lowHealthOsc: OscillatorNode | null = null;
  private lowHealthGain: GainNode | null = null;

  // Weather audio nodes (NES filtered noise loop for rain, thunder burst)
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private isRainAudioPlaying: boolean = false;

  // Custom 8-bit death chime active nodes and timeouts
  private deathChimeTimeouts: number[] = [];
  private deathChimeGainNodes: GainNode[] = [];

  constructor() {
    // Lazy initialize on first interaction
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      console.warn('Web Audio API not supported');
    }
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  // --- Sound Effects ---

  /**
   * Sword slash: Quick pitch drop pulse + brief noise burst
   */
  public playSwordSlash() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Pulse sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.09);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);

    // Noise burst
    this.playNoiseBurst(0.06, 0.25, 800);
  }

  /**
   * Sword beam projectile: High-frequency beam zap
   */
  public playSwordBeam() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.linearRampToValueAtTime(1800, now + 0.07);
    osc.frequency.linearRampToValueAtTime(800, now + 0.14);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Enemy hit: Staccato crunchy hit
   */
  public playEnemyHit() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
    this.playNoiseBurst(0.08, 0.3, 400);
  }

  /**
   * Enemy die: 4 crunchy staggered noise puffs (classic NES Zelda enemy explosion)
   */
  public playEnemyDie() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.playNoiseBurst(0.05, 0.35 - i * 0.05, 600 - i * 100);
      }, i * 55);
    }
  }

  /**
   * Complex enemy alert / spotted player (authentic NES 2A03 dual-tone chirp)
   */
  public playEnemyAlert() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(880, now + 0.05);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0.25, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Complex enemy flee / retreat chirp
   */
  public playEnemyFlee() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.1);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Player hurt: Authentic descending buzz
   */
  public playPlayerHurt() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.setValueAtTime(90, now + 0.08);
    osc.frequency.setValueAtTime(60, now + 0.16);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  /**
   * Stops any pending death chime timeouts or lingering tone nodes
   */
  public stopDeathChime() {
    this.deathChimeTimeouts.forEach((id) => window.clearTimeout(id));
    this.deathChimeTimeouts = [];

    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.deathChimeGainNodes.forEach((gain) => {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0, now);
        } catch {}
      });
    }
    this.deathChimeGainNodes = [];
  }

  /**
   * 2A03 Chiptune 'Death Chime' Sound Effect:
   * Authentic NES hardware recreation triggering immediately when Link's hearts reach zero.
   * Simulates the Ricoh 2A03 sound processor with:
   * 1. Sudden diminished triad impact strike (B5 + F5 + D5) with downward hardware pitch sweeps.
   * 2. Rapid 19-step descending chromatic death chime cascade across dual Pulse channels.
   * 3. Deep 32-step Triangle sub-bass resonant drop.
   * 4. 15-bit LFSR noise transient impact.
   */
  public playDeathChime() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    // Halt any running BGM and reset any existing death chime nodes
    this.stopBgm();
    this.stopDeathChime();

    const now = this.ctx.currentTime;

    // 1. Initial 2A03 Fatal Impact Strike (Diminished Triad with hardware pitch sweep)
    const strikeFreqs = [
      { freq: 987.77, endFreq: 710.0, type: 'square' as const, vol: 0.28, dur: 0.24 }, // B5 -> F5
      { freq: 698.46, endFreq: 490.0, type: 'square' as const, vol: 0.22, dur: 0.24 }, // F5 -> B4
      { freq: 587.33, endFreq: 415.0, type: 'square' as const, vol: 0.18, dur: 0.24 }, // D5 -> G#4
      { freq: 220.0, endFreq: 65.0, type: 'triangle' as const, vol: 0.32, dur: 0.32 }, // Sub-bass punch
    ];

    strikeFreqs.forEach(({ freq, endFreq, type, vol, dur }) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + dur);
      this.deathChimeGainNodes.push(gain);
    });

    // 15-bit LFSR noise impact hit
    this.playNoiseBurst(0.08, 0.28, 1200);

    // 2. Cascading 2A03 Descending Chromatic Death Chime Cascade
    const CHIME_PITCHES = [
      880.0, // A5
      830.61, // G#5
      783.99, // G5
      739.99, // F#5
      698.46, // F5
      659.25, // E5
      622.25, // D#5
      587.33, // D5
      554.37, // C#5
      523.25, // C5
      493.88, // B4
      466.16, // A#4
      440.0, // A4
      415.3, // G#4
      392.0, // G4
      369.99, // F#4
      349.23, // F4
      329.63, // E4
      293.66, // D4
    ];

    const noteStep = 0.055; // Fast nostalgic cascade rate
    const startDelay = 0.12;

    CHIME_PITCHES.forEach((pitch, i) => {
      const noteTime = now + startDelay + i * noteStep;
      const noteDur = 0.075;

      // Pulse 1 Lead Bell Chime (50% square)
      const osc1 = this.ctx!.createOscillator();
      const gain1 = this.ctx!.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(pitch, noteTime);
      osc1.frequency.exponentialRampToValueAtTime(pitch * 0.94, noteTime + noteDur);

      const leadVol = Math.max(0.12, 0.26 - i * 0.007);
      gain1.gain.setValueAtTime(leadVol, noteTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDur);

      osc1.connect(gain1);
      gain1.connect(this.masterGain!);
      osc1.start(noteTime);
      osc1.stop(noteTime + noteDur);
      this.deathChimeGainNodes.push(gain1);

      // Pulse 2 Harmony Overtone (25% square, octave or fifth)
      const osc2 = this.ctx!.createOscillator();
      const gain2 = this.ctx!.createGain();
      osc2.type = 'square';
      const overtonePitch = i % 2 === 0 ? pitch * 1.5 : pitch * 2;
      osc2.frequency.setValueAtTime(overtonePitch, noteTime);

      gain2.gain.setValueAtTime(leadVol * 0.35, noteTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDur * 0.8);

      osc2.connect(gain2);
      gain2.connect(this.masterGain!);
      osc2.start(noteTime);
      osc2.stop(noteTime + noteDur * 0.8);
      this.deathChimeGainNodes.push(gain2);

      // Stepped Triangle Bass on alternating notes
      if (i % 2 === 0) {
        const subOsc = this.ctx!.createOscillator();
        const subGain = this.ctx!.createGain();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(pitch * 0.25, noteTime);

        subGain.gain.setValueAtTime(0.22, noteTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDur);

        subOsc.connect(subGain);
        subGain.connect(this.masterGain!);
        subOsc.start(noteTime);
        subOsc.stop(noteTime + noteDur);
        this.deathChimeGainNodes.push(subGain);
      }
    });

    // 3. Resonant low death toll resolving chord (D3 + A3 + D2 held as Link fades)
    const resolveTime = now + startDelay + CHIME_PITCHES.length * noteStep;
    const resolveDur = 0.85;

    [146.83, 220.0, 73.42].forEach((freq, idx) => {
      const rOsc = this.ctx!.createOscillator();
      const rGain = this.ctx!.createGain();
      rOsc.type = idx === 2 ? 'triangle' : 'square';
      rOsc.frequency.setValueAtTime(freq, resolveTime);

      rGain.gain.setValueAtTime(idx === 2 ? 0.35 : 0.18, resolveTime);
      rGain.gain.exponentialRampToValueAtTime(0.001, resolveTime + resolveDur);

      rOsc.connect(rGain);
      rGain.connect(this.masterGain!);
      rOsc.start(resolveTime);
      rOsc.stop(resolveTime + resolveDur);
      this.deathChimeGainNodes.push(rGain);
    });
  }

  /**
   * Fatal blow impact strike: Sudden diminished triad chime chord (B5 + F5 + D5)
   * sounding the instant player health reaches zero.
   */
  public playDeathChimeStrike() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Diminished triad frequencies for intense dramatic shock
    const strikeFreqs = [
      { freq: 987.77, type: 'square' as const, vol: 0.22 }, // B5
      { freq: 698.46, type: 'square' as const, vol: 0.18 }, // F5
      { freq: 349.23, type: 'triangle' as const, vol: 0.25 }, // F4
    ];

    strikeFreqs.forEach(({ freq, type, vol }) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + 0.16);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.16);

      this.deathChimeGainNodes.push(gain);
    });

    // Brief sharp metallic noise transient
    this.playNoiseBurst(0.05, 0.22, 1400);
  }

  /**
   * Player death spin: 16-step descending chromatic 8-bit death chime arpeggio,
   * tightly synchronized with each 4-frame rotation step of the spinning animation.
   * Features dual 2A03 square waves (fundamental + octave overtone) and sub-ping.
   */
  public playPlayerDeathSpin(step: number = 0) {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 16-step descending chromatic/harmonic death chime scale
    const SPIN_CHIME_TABLE = [
      { lead: 783.99, overtone: 1567.98, sub: 392.0 }, // G5 (Step 0)
      { lead: 739.99, overtone: 1479.98, sub: 369.99 }, // F#5 (Step 1)
      { lead: 698.46, overtone: 1396.91, sub: 349.23 }, // F5 (Step 2)
      { lead: 659.25, overtone: 1318.51, sub: 329.63 }, // E5 (Step 3)
      { lead: 622.25, overtone: 1244.51, sub: 311.13 }, // Eb5 (Step 4)
      { lead: 587.33, overtone: 1174.66, sub: 293.66 }, // D5 (Step 5)
      { lead: 554.37, overtone: 1108.73, sub: 277.18 }, // C#5 (Step 6)
      { lead: 523.25, overtone: 1046.5, sub: 261.63 }, // C5 (Step 7)
      { lead: 493.88, overtone: 987.77, sub: 246.94 }, // B4 (Step 8)
      { lead: 466.16, overtone: 932.33, sub: 233.08 }, // Bb4 (Step 9)
      { lead: 440.0, overtone: 880.0, sub: 220.0 }, // A4 (Step 10)
      { lead: 415.3, overtone: 830.61, sub: 207.65 }, // Ab4 (Step 11)
      { lead: 392.0, overtone: 783.99, sub: 196.0 }, // G4 (Step 12)
      { lead: 369.99, overtone: 739.99, sub: 185.0 }, // F#4 (Step 13)
      { lead: 349.23, overtone: 698.46, sub: 174.61 }, // F4 (Step 14)
      { lead: 329.63, overtone: 659.25, sub: 164.81 }, // E4 (Step 15)
    ];

    const entry = SPIN_CHIME_TABLE[step % SPIN_CHIME_TABLE.length];
    const dur = 0.058;

    // Voice 1: Primary 2A03 Pulse wave (melodic bell chime lead)
    const leadOsc = this.ctx.createOscillator();
    const leadGain = this.ctx.createGain();
    leadOsc.type = 'square';
    leadOsc.frequency.setValueAtTime(entry.lead, now);
    leadOsc.frequency.exponentialRampToValueAtTime(entry.lead * 0.94, now + dur);

    leadGain.gain.setValueAtTime(0.24, now);
    leadGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    leadOsc.connect(leadGain);
    leadGain.connect(this.masterGain);
    leadOsc.start(now);
    leadOsc.stop(now + dur);
    this.deathChimeGainNodes.push(leadGain);

    // Voice 2: Octave overtone square (adds crystalline 8-bit sparkle)
    const overtoneOsc = this.ctx.createOscillator();
    const overtoneGain = this.ctx.createGain();
    overtoneOsc.type = 'square';
    overtoneOsc.frequency.setValueAtTime(entry.overtone, now);
    overtoneOsc.frequency.exponentialRampToValueAtTime(entry.overtone * 0.92, now + dur * 0.7);

    overtoneGain.gain.setValueAtTime(0.08, now);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.7);

    overtoneOsc.connect(overtoneGain);
    overtoneGain.connect(this.masterGain);
    overtoneOsc.start(now);
    overtoneOsc.stop(now + dur * 0.7);
    this.deathChimeGainNodes.push(overtoneGain);

    // Voice 3: Triangle sub-ping for authentic low-end weight
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(entry.sub, now);
    subGain.gain.setValueAtTime(0.18, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + dur);
    this.deathChimeGainNodes.push(subGain);
  }

  /**
   * Player death explosion: Synchronized climactic 8-bit noise blast,
   * heavy sub-bass downward slide, crystalline shattered heart chimes,
   * and a 5-note solemn requiem death cadence resolving into the fade to black.
   */
  public playPlayerDeathExplosion() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 1. Dual-Stage 15-bit LFSR filtered noise explosion (crunchy NES detonation)
    this.playNoiseBurst(0.46, 0.48, 360);
    const t1 = window.setTimeout(() => {
      this.playNoiseBurst(0.36, 0.38, 220);
    }, 60);
    this.deathChimeTimeouts.push(t1);

    // 2. Heavy sub-bass downward slide
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bassOsc.type = 'triangle';
    bassOsc.frequency.setValueAtTime(160, now);
    bassOsc.frequency.exponentialRampToValueAtTime(30, now + 0.65);

    bassGain.gain.setValueAtTime(0.42, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    bassOsc.connect(bassGain);
    bassGain.connect(this.masterGain);
    bassOsc.start(now);
    bassOsc.stop(now + 0.65);
    this.deathChimeGainNodes.push(bassGain);

    // 3. Crystalline Heart Shatter Chimes: 4 rapid high-frequency square pings
    // representing Link's heart containers and sword shattering into particles
    const shatterPings = [
      { freq: 2093.0, delay: 0.02, dur: 0.08, vol: 0.14 }, // C7
      { freq: 1760.0, delay: 0.06, dur: 0.09, vol: 0.15 }, // A6
      { freq: 1396.91, delay: 0.11, dur: 0.11, vol: 0.16 }, // F6
      { freq: 1046.5, delay: 0.17, dur: 0.13, vol: 0.18 }, // C6
    ];

    shatterPings.forEach(({ freq, delay, dur, vol }) => {
      if (!this.ctx || !this.masterGain) return;
      const pingOsc = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();
      pingOsc.type = 'square';
      pingOsc.frequency.setValueAtTime(freq, now + delay);
      pingOsc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + delay + dur);

      pingGain.gain.setValueAtTime(vol, now + delay);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);

      pingOsc.connect(pingGain);
      pingGain.connect(this.masterGain);
      pingOsc.start(now + delay);
      pingOsc.stop(now + delay + dur);
      this.deathChimeGainNodes.push(pingGain);
    });

    // 4. Mournful Requiem Death Chime (5-Note solemn NES death cadence)
    // Synchronized to unfold as smoke drifts and spirit wisps ascend into the black fade
    const requiemNotes = [
      { lead: 220.0, harmony: 329.63, sub: 110.0, time: 0.28, dur: 0.28, vol: 0.2 }, // A3 + E4
      { lead: 196.0, harmony: 293.66, sub: 98.0, time: 0.58, dur: 0.28, vol: 0.2 }, // G3 + D4
      { lead: 185.0, harmony: 277.18, sub: 92.5, time: 0.88, dur: 0.32, vol: 0.21 }, // F#3 + C#4
      { lead: 155.56, harmony: 233.08, sub: 77.78, time: 1.2, dur: 0.38, vol: 0.22 }, // Eb3 + Bb3
      { lead: 146.83, harmony: 220.0, sub: 73.42, time: 1.58, dur: 0.65, vol: 0.24 }, // D3 + A3 (Final solemn toll)
    ];

    requiemNotes.forEach(({ lead, harmony, sub, time, dur, vol }) => {
      if (!this.ctx || !this.masterGain) return;
      const noteTime = now + time;

      // Lead Pulse Wave
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(lead, noteTime);

      gain1.gain.setValueAtTime(vol, noteTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, noteTime + dur);

      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(noteTime);
      osc1.stop(noteTime + dur);
      this.deathChimeGainNodes.push(gain1);

      // Harmony Pulse Wave (for rich authentic NES polyphony)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(harmony, noteTime);

      gain2.gain.setValueAtTime(vol * 0.45, noteTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, noteTime + dur);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(noteTime);
      osc2.stop(noteTime + dur);
      this.deathChimeGainNodes.push(gain2);

      // Warm Triangle Sub-Bass Body
      const osc3 = this.ctx.createOscillator();
      const gain3 = this.ctx.createGain();
      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(sub, noteTime);

      gain3.gain.setValueAtTime(vol * 0.7, noteTime);
      gain3.gain.exponentialRampToValueAtTime(0.001, noteTime + dur);

      osc3.connect(gain3);
      gain3.connect(this.masterGain);
      osc3.start(noteTime);
      osc3.stop(noteTime + dur);
      this.deathChimeGainNodes.push(gain3);
    });
  }

  /**
   * Rupee pickup: High crystalline ping (B5 -> E6)
   */
  public playRupee() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.04); // E6

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Heart pickup: Warm pure chime
   */
  public playHeart() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1046.50, now); // C6
    osc.frequency.setValueAtTime(1318.51, now + 0.05); // E6
    osc.frequency.setValueAtTime(1567.98, now + 0.1); // G6

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Key pickup
   */
  public playKey() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1174.66, now); // D6
    osc.frequency.setValueAtTime(1760.00, now + 0.06); // A6

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Item poof appearance sound: Crisp upward 8-bit pop + soft noise burst
   */
  public playItemPoof() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.04); // E6
    osc.frequency.exponentialRampToValueAtTime(1760.00, now + 0.08); // A6

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);

    // Subtle 8-bit noise puff
    this.playNoiseBurst(0.12, 0.06, 1200);
  }

  /**
   * Sword strikes a wall.
   * If normal wall: sharp high-frequency metallic ping/clink.
   * If secret hollow wall: resonant dual-harmonic echoing chime indicating a discovery!
   */
  public playSwordWallClink(isHollowSecret: boolean = false) {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    if (isHollowSecret) {
      // Distinctive hollow resonant chime (D6 + A6 harmony)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'square';

      osc1.frequency.setValueAtTime(1174.66, now); // D6
      osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.16); // Decay
      osc2.frequency.setValueAtTime(1760.00, now); // A6
      osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.14);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.18);
      osc2.stop(now + 0.18);

      // Light resonant click
      this.playNoiseBurst(0.04, 0.1, 1600);
    } else {
      // Solid stone/wall metallic clink
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1480, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.05);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.05);

      this.playNoiseBurst(0.03, 0.12, 2200);
    }
  }

  /**
   * Bomb dropped (thud/hiss)
   */
  public playBombDrop() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.1);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Bomb explosion: Deep roaring noise + rumble
   */
  public playBombExplosion() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Low rumble
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.45);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.45);

    // Deep noise burst
    this.playNoiseBurst(0.4, 0.45, 300);
  }

  /**
   * Boomerang flying whir
   */
  public playBoomerang() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(450, now + 0.04);
    osc.frequency.linearRampToValueAtTime(300, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Shield deflect
   */
  public playShieldDeflect() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.setValueAtTime(800, now + 0.02);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Secret found jingle: The immortal 8-note Zelda discovery chime!
   * G4, F#4, D#4, A3, G#3, E4, G#4, C5
   */
  public playSecret() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    // Authentic NES Ricoh 2A03 frequencies and tempo (~105ms per note with held resolution)
    const notes = [
      { f: 392.00, d: 0.10 }, // G4
      { f: 369.99, d: 0.10 }, // F#4
      { f: 311.13, d: 0.10 }, // D#4
      { f: 220.00, d: 0.10 }, // A3
      { f: 207.65, d: 0.10 }, // G#3
      { f: 329.63, d: 0.10 }, // E4
      { f: 415.30, d: 0.10 }, // G#4
      { f: 523.25, d: 0.45 }, // C5 (held victory resolution)
    ];

    let t = this.ctx.currentTime;
    notes.forEach((n, idx) => {
      const isLast = idx === notes.length - 1;
      // Primary 50% square wave (Lead pulse channel)
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(n.f, t);

      const volume = isLast ? 0.38 : 0.32;
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.d - (isLast ? 0.03 : 0.01));

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + n.d);

      // Secondary pulse with gentle detune for rich NES chorus timbre
      const osc2 = this.ctx!.createOscillator();
      const gain2 = this.ctx!.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(n.f * 1.002, t);

      gain2.gain.setValueAtTime(volume * 0.35, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + n.d - 0.01);

      osc2.connect(gain2);
      gain2.connect(this.masterGain!);
      osc2.start(t);
      osc2.stop(t + n.d);

      t += n.d;
    });
  }

  /**
   * Hidden sound effect trigger: Plays the iconic 8-note 'secret found' chime
   * when discovering secrets, including when pushing a bombable wall to reveal passages.
   */
  public playSecretFoundChime() {
    this.playSecret();
  }

  /**
   * Dedicated 2A03 Chiptune Sound Effect:
   * Triggered when Link discovers a secret subterranean staircase under a bush or boulder.
   * Synthesizes authentic Ricoh 2A03 APU channels:
   * - Phase 1: Physical uncover sound:
   *   - Boulder: Low grating stone-slide triangle rumble + 15-bit LFSR friction crunch
   *   - Bush: Crackling thermal combustion / airy rustle swoosh + warm earth thud
   * - Phase 2: Ascending ancient mystery flourish (Pulse 1 lead + Pulse 2 chorus shimmer)
   * - Phase 3: Descending subterranean staircase chime cadence stepping down into the dark
   * - Phase 4: Low stepped triangle pedal bass & echoing subterranean chime decay
   */
  public playSecretStaircaseReveal(source: 'bush' | 'boulder' = 'boulder') {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;

    // 1. Phase 1: Physical Dislodgement / Combustion Transient (0.00s - 0.22s)
    if (source === 'boulder') {
      // Heavy stone sliding rumble: Low Triangle pitch glide 140Hz -> 48Hz
      const stoneOsc = this.ctx.createOscillator();
      const stoneGain = this.ctx.createGain();
      stoneOsc.type = 'triangle';
      stoneOsc.frequency.setValueAtTime(140, now);
      stoneOsc.frequency.exponentialRampToValueAtTime(48, now + 0.22);
      stoneGain.gain.setValueAtTime(0.35, now);
      stoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      stoneOsc.connect(stoneGain);
      stoneGain.connect(this.masterGain);
      stoneOsc.start(now);
      stoneOsc.stop(now + 0.22);

      // Heavy abrasive stone-friction noise sweep
      this.playNoiseBurst(0.18, 0.26, 450);
    } else {
      // Bush incinerated/cut: Foliage crackle + airy combustion sweep
      const bushOsc = this.ctx.createOscillator();
      const bushGain = this.ctx.createGain();
      bushOsc.type = 'triangle';
      bushOsc.frequency.setValueAtTime(220, now);
      bushOsc.frequency.exponentialRampToValueAtTime(70, now + 0.16);
      bushGain.gain.setValueAtTime(0.28, now);
      bushGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      bushOsc.connect(bushGain);
      bushGain.connect(this.masterGain);
      bushOsc.start(now);
      bushOsc.stop(now + 0.16);

      // Airy ember whoosh
      this.playNoiseBurst(0.14, 0.20, 2400);
    }

    // 2. Phase 2: Ascending Discovery Shimmer Arpeggio (0.08s - 0.32s)
    // 7 rapid rising pulses uncovering the subterranean entrance
    const upwardNotes = [
      { f: 261.63, d: 0.035 }, // C4
      { f: 329.63, d: 0.035 }, // E4
      { f: 392.00, d: 0.035 }, // G4
      { f: 523.25, d: 0.035 }, // C5
      { f: 659.25, d: 0.035 }, // E5
      { f: 783.99, d: 0.050 }, // G5
      { f: 1046.50, d: 0.070 }, // C6 (crystal pinnacle glint)
    ];

    let upTime = now + 0.06;
    upwardNotes.forEach((n, idx) => {
      const isTop = idx === upwardNotes.length - 1;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(n.f, upTime);

      const vol = isTop ? 0.34 : 0.22;
      gain.gain.setValueAtTime(vol, upTime);
      gain.gain.exponentialRampToValueAtTime(0.001, upTime + n.d);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(upTime);
      osc.stop(upTime + n.d);

      upTime += n.d * 0.75;
    });

    // 3. Phase 3: The Descending Subterranean Staircase Cadence (0.34s - 1.15s)
    // Authentic 8-step staircase descent motif with dual 2A03 pulse channels and stepping triangle bass
    const staircaseNotes = [
      { f: 880.00, d: 0.085, bass: 130.81 }, // A5 & C3
      { f: 783.99, d: 0.085, bass: 110.00 }, // G5 & A2
      { f: 698.46, d: 0.085, bass: 98.00 },  // F5 & G2
      { f: 622.25, d: 0.085, bass: 87.31 },  // Eb5 & F2
      { f: 523.25, d: 0.085, bass: 82.41 },  // C5 & E2
      { f: 440.00, d: 0.085, bass: 73.42 },  // A4 & D2
      { f: 392.00, d: 0.095, bass: 65.41 },  // G4 & C2
      { f: 523.25, d: 0.520, bass: 130.81 }, // C5 held triumphant resolution!
    ];

    let t = upTime + 0.04;
    staircaseNotes.forEach((n, idx) => {
      const isLast = idx === staircaseNotes.length - 1;

      // Pulse 1: Lead Square Wave (50% duty cycle)
      const osc1 = this.ctx!.createOscillator();
      const gain1 = this.ctx!.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(n.f, t);

      const vol1 = isLast ? 0.38 : 0.30;
      gain1.gain.setValueAtTime(vol1, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + n.d - (isLast ? 0.04 : 0.01));

      osc1.connect(gain1);
      gain1.connect(this.masterGain!);
      osc1.start(t);
      osc1.stop(t + n.d);

      // Pulse 2: Harmony Square Wave (25% duty cycle, octave/third overtone)
      const osc2 = this.ctx!.createOscillator();
      const gain2 = this.ctx!.createGain();
      osc2.type = 'square';
      const harmFreq = isLast ? n.f * 1.5 : n.f * 1.003;
      osc2.frequency.setValueAtTime(harmFreq, t);

      gain2.gain.setValueAtTime(vol1 * 0.4, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + n.d - 0.015);

      osc2.connect(gain2);
      gain2.connect(this.masterGain!);
      osc2.start(t);
      osc2.stop(t + n.d);

      // Triangle Bass: Stepping down subterranean pedal tone
      const triOsc = this.ctx!.createOscillator();
      const triGain = this.ctx!.createGain();
      triOsc.type = 'triangle';
      triOsc.frequency.setValueAtTime(n.bass, t);

      const triVol = isLast ? 0.36 : 0.28;
      triGain.gain.setValueAtTime(triVol, t);
      triGain.gain.exponentialRampToValueAtTime(0.001, t + n.d * (isLast ? 1.2 : 0.95));

      triOsc.connect(triGain);
      triGain.connect(this.masterGain!);
      triOsc.start(t);
      triOsc.stop(t + n.d * (isLast ? 1.2 : 0.95));

      t += n.d;
    });

    // 4. Phase 4: Subterranean Stone Echo Ping (1.10s - 1.45s)
    const echoTime = t + 0.06;
    const echoOsc = this.ctx.createOscillator();
    const echoGain = this.ctx.createGain();
    echoOsc.type = 'square';
    echoOsc.frequency.setValueAtTime(1046.50, echoTime); // C6 bell echo
    echoGain.gain.setValueAtTime(0.12, echoTime);
    echoGain.gain.exponentialRampToValueAtTime(0.001, echoTime + 0.32);
    echoOsc.connect(echoGain);
    echoGain.connect(this.masterGain);
    echoOsc.start(echoTime);
    echoOsc.stop(echoTime + 0.32);
  }

  /**
   * 8-Bit Text Engine Typing Sound:
   * Authentic NES dialogue blip for character-by-character typewriter reveal.
   */
  public playTextChar() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.024);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.024);
  }

  /**
   * Item Get / Triforce fanfare
   */
  public playItemFanfare() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    // Pause background music during fanfare
    const prevBgm = this.currentBgm;
    this.stopBgm();

    const notes = [
      { f: 622.25, d: 0.15 }, // D#5
      { f: 659.25, d: 0.15 }, // E5
      { f: 698.46, d: 0.15 }, // F5
      { f: 783.99, d: 0.45 }, // G5
      { f: 783.99, d: 0.15 }, // G5
      { f: 830.61, d: 0.15 }, // G#5
      { f: 880.00, d: 0.15 }, // A5
      { f: 987.77, d: 0.60 }, // B5
    ];

    let t = this.ctx.currentTime;
    notes.forEach((n) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(n.f, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + n.d - 0.02);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + n.d);
      t += n.d;
    });

    if (prevBgm) {
      setTimeout(() => {
        if (!this.currentBgm) {
          this.playBgm(prevBgm as 'overworld' | 'dungeon' | 'cave');
        }
      }, 2100);
    }
  }

  /**
   * Iconic 6-note NES Recorder / Whistle fanfare:
   * D5 -> B4 -> G#4 -> D4 -> G#4 -> B4 with rapid trill
   */
  public playWhistle() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const notes = [
      { f: 587.33, d: 0.12 }, // D5
      { f: 493.88, d: 0.12 }, // B4
      { f: 415.30, d: 0.12 }, // G#4
      { f: 293.66, d: 0.14 }, // D4
      { f: 415.30, d: 0.14 }, // G#4
      { f: 493.88, d: 0.45 }, // B4 held
    ];

    let t = this.ctx.currentTime;
    notes.forEach((n, idx) => {
      const isLast = idx === notes.length - 1;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle'; // Pure flute/recorder timbre
      osc.frequency.setValueAtTime(n.f, t);

      // Add gentle vibrato
      if (isLast) {
        osc.frequency.setValueAtTime(n.f, t);
        osc.frequency.linearRampToValueAtTime(n.f + 6, t + 0.15);
        osc.frequency.linearRampToValueAtTime(n.f - 6, t + 0.30);
      }

      gain.gain.setValueAtTime(0.38, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + n.d - (isLast ? 0.04 : 0.01));

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + n.d);

      t += n.d;
    });
  }

  /**
   * Arrow shoot: 2A03 pitch bent noise click & pop
   */
  public playArrowShoot() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Octorok rock spit sound: Fast low-frequency square wave thud
   */
  public playRockSpit() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.07);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Melee enemy lunge / charge whoosh sound
   */
  public playMeleeLunge() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Stalfos hopping bone rattle sound: Staccato dual-pitch pulse jump
   */
  public playStalfosJump() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(560, now + 0.03);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Tektite springy leaping hop sound: Bouncy frequency-swept pulse jump
   */
  public playTektiteHop() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Keese wing flap flutter: Soft staccato wing beat
   */
  public playKeeseFlap() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Keese aerial swoop dive: High-to-low sweeping dive chirp
   */
  public playKeeseSwoop() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.14);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Leever emerging from ground: earthy rising triangle-wave rumble
   */
  public playLeeverEmerge() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.14);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Leever burrowing back underground: descending sand-sink pulse
   */
  public playLeeverBurrow() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Peahat propeller takeoff spin: rising flutter whirr
   */
  public playPeahatSpin() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(420, now + 0.16);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Wizzrobe teleport shimmer: etheric ascending triangle sweep
   */
  public playWizzrobeWarp() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.12);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Wizzrobe magic wave spell cast: resonant descending square pulse
   */
  public playWizzrobeCast() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.16);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Ghini awakening from graveyard statue: eerie warbling spectral glide
   */
  public playGhiniAwaken() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.linearRampToValueAtTime(340, now + 0.08);
    osc.frequency.linearRampToValueAtTime(240, now + 0.16);
    osc.frequency.linearRampToValueAtTime(480, now + 0.24);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  /**
   * Like Like engulf & shield consumption: low gulping sawtooth crunch
   */
  public playLikeLikeEat() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.14);
    osc.frequency.setValueAtTime(210, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.28);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  /**
   * Candle flame burst crackle
   */
  public playFlame() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.16);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Life Potion drinking recovery jingle: Ascending arpeggio
   */
  public playHealPotion() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    let t = this.ctx.currentTime;
    notes.forEach((f) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.08);
      t += 0.06;
    });
  }

  /**
   * Shop transaction / purchase cash sound
   */
  public playShopBuy() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * Dodongo bomb swallow thud
   */
  public playDodongoSwallow() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.25);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // --- Authentic Screen Transition & Room-Switching Audio ---

  /**
   * Room-switching screen scroll start sound:
   * Emulates the classic NES 2A03 hardware sweep and PPU nametable shifting audio.
   * Features a pitch-descending/ascending square wave pulse with filtered noise sweep.
   */
  public playScreenScrollStart(dir?: string) {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // NES 2A03 Pulse 1 downward/upward pitch sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    const startFreq = dir === 'UP' || dir === 'LEFT' ? 185 : 240;
    const endFreq = dir === 'UP' || dir === 'LEFT' ? 115 : 150;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.13);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.13);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);

    // Subtle 2A03 triangle sub-bass undertone
    const tri = this.ctx.createOscillator();
    const triGain = this.ctx.createGain();
    tri.type = 'triangle';
    tri.frequency.setValueAtTime(startFreq * 0.5, now);
    tri.frequency.exponentialRampToValueAtTime(endFreq * 0.5, now + 0.11);
    triGain.gain.setValueAtTime(0.22, now);
    triGain.gain.exponentialRampToValueAtTime(0.005, now + 0.11);
    tri.connect(triGain);
    triGain.connect(this.masterGain);
    tri.start(now);
    tri.stop(now + 0.11);

    // NES low-pass noise burst simulating screen panning
    this.playNoiseBurst(0.12, 0.16, 950);
  }

  /**
   * Rhythmic screen-scroll tile step tick:
   * Crisp 8-bit pulse click indicating scrolling progress across map boundaries.
   * Fires rhythmically as the camera slides across tile columns or rows.
   */
  public playScreenScrollTick(progress: number = 0.5) {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    const pitch = 200 + Math.round(progress * 140);
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.65, now + 0.028);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.028);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.028);

    // Gentle noise tap
    this.playNoiseBurst(0.02, 0.09, 1350);
  }

  /**
   * Screen scroll complete / room lock latch chime:
   * Crisp 8-bit latch tone confirming Link has successfully locked into the new screen.
   */
  public playScreenScrollEnd() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(329.63, now); // E4
    osc.frequency.exponentialRampToValueAtTime(164.81, now + 0.07); // E3

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.07);

    this.playNoiseBurst(0.035, 0.12, 1700);
  }

  /**
   * Authentic NES Zelda descending stairs chiptune sound:
   * Rapid downward 7-note staccato arpeggio (G5 down to C#4).
   * Played when Link enters a cave, secret staircase, or dungeon basement.
   */
  public playStairsDown() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    // 7 descending staccato square notes, ~38ms spacing
    const freqs = [
      783.99, // G5
      659.25, // E5
      554.37, // C#5
      466.16, // A#4
      392.00, // G4
      329.63, // E4
      277.18, // C#4
    ];

    const noteDur = 0.032;
    const interval = 0.038;
    let t = this.ctx.currentTime;

    freqs.forEach((f) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + noteDur);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + noteDur);

      t += interval;
    });
  }

  /**
   * Authentic NES Zelda ascending stairs chiptune sound:
   * Rapid upward 7-note staccato arpeggio (C#4 up to G5).
   * Played when Link emerges from a cave or cellar back to the surface.
   */
  public playStairsUp() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const freqs = [
      277.18, // C#4
      329.63, // E4
      392.00, // G4
      466.16, // A#4
      554.37, // C#5
      659.25, // E5
      783.99, // G5
    ];

    const noteDur = 0.032;
    const interval = 0.038;
    let t = this.ctx.currentTime;

    freqs.forEach((f) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + noteDur);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + noteDur);

      t += interval;
    });
  }

  /**
   * Doorway / Shutter passage sound:
   * Emulates stone sliding shutter and doorway transition.
   */
  public playDoorTransition() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);

    this.playNoiseBurst(0.12, 0.22, 650);
  }

  /**
   * Generic room-switching audio trigger (used during room transition animations)
   */
  public playRoomSwitch(dir?: string) {
    this.playScreenScrollStart(dir);
  }

  /**
   * Ambient weather rain audio generator:
   * Generates continuous filtered NES LFSR noise that smoothly adjusts in volume and frequency
   * depending on rain intensity (light rain vs heavy downpour) without overpowering the BGM.
   */
  public updateRainAmbience(active: boolean, intensity: number = 0.5) {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) {
      if (this.rainGain) {
        this.rainGain.gain.setValueAtTime(0, this.ctx ? this.ctx.currentTime : 0);
      }
      return;
    }

    const now = this.ctx.currentTime;

    if (!active || intensity <= 0) {
      if (this.rainGain && this.isRainAudioPlaying) {
        this.rainGain.gain.setTargetAtTime(0, now, 0.2);
        setTimeout(() => {
          if (!this.isRainAudioPlaying && this.rainSource) {
            try {
              this.rainSource.stop();
              this.rainSource.disconnect();
            } catch {
              // Ignore already stopped source
            }
            this.rainSource = null;
          }
        }, 300);
        this.isRainAudioPlaying = false;
      }
      return;
    }

    // If not already playing, initialize the looping rain noise buffer
    if (!this.isRainAudioPlaying || !this.rainSource) {
      try {
        const bufferDuration = 2.0;
        const bufferSize = Math.floor(this.ctx.sampleRate * bufferDuration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // 15-bit shift register pseudo-random NES noise simulation
        let reg = 0x4000;
        for (let i = 0; i < bufferSize; i++) {
          const bit = ((reg & 1) ^ ((reg >> 1) & 1));
          reg = (reg >> 1) | (bit << 14);
          // Soften baseline amplitude for background atmosphere
          data[i] = (bit ? 0.35 : -0.35);
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800 + intensity * 450, now);
        filter.Q.setValueAtTime(0.7, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        const targetVol = Math.min(0.065, Math.max(0.015, intensity * 0.055));
        gain.gain.exponentialRampToValueAtTime(targetVol, now + 0.3);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        source.start(now);
        this.rainSource = source;
        this.rainFilter = filter;
        this.rainGain = gain;
        this.isRainAudioPlaying = true;
      } catch (err) {
        console.warn('Error starting rain ambience:', err);
      }
    } else {
      // Adjust frequency and volume smoothly with intensity changes
      if (this.rainFilter && this.rainGain) {
        this.rainFilter.frequency.setTargetAtTime(800 + intensity * 450, now, 0.2);
        const targetVol = Math.min(0.065, Math.max(0.015, intensity * 0.055));
        this.rainGain.gain.setTargetAtTime(targetVol, now, 0.2);
      }
    }
  }

  /**
   * Distant thunderstorm rumble:
   * Authentic NES noise burst sweeping down into low sub-bass triangle boom.
   */
  public playThunder() {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 1. Heavy low-pass noise rumble
    const duration = 1.1;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let reg = 0x4000;
    for (let i = 0; i < bufferSize; i++) {
      const bit = ((reg & 1) ^ ((reg >> 1) & 1));
      reg = (reg >> 1) | (bit << 14);
      data[i] = (bit ? 1 : -1) * 0.6;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(75, now + duration);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.005, now + duration);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseSource.start(now);
    noiseSource.stop(now + duration);

    // 2. Sub-bass triangle drop
    const tri = this.ctx.createOscillator();
    const triGain = this.ctx.createGain();
    tri.type = 'triangle';
    tri.frequency.setValueAtTime(110, now);
    tri.frequency.exponentialRampToValueAtTime(32, now + 0.9);

    triGain.gain.setValueAtTime(0.38, now);
    triGain.gain.exponentialRampToValueAtTime(0.005, now + 0.9);

    tri.connect(triGain);
    triGain.connect(this.masterGain);
    tri.start(now);
    tri.stop(now + 0.9);
  }

  /**
   * Helper: NES-style LFSR filtered noise generator
   */
  private playNoiseBurst(duration: number, volume: number, cutoff: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // 15-bit shift register simulation for authentic NES metallic noise
    let reg = 0x4000;
    for (let i = 0; i < bufferSize; i++) {
      const bit = ((reg & 1) ^ ((reg >> 1) & 1));
      reg = (reg >> 1) | (bit << 14);
      data[i] = (bit ? 1 : -1) * 0.5;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noiseSource.start(now);
    noiseSource.stop(now + duration);
  }

  // --- Background Music System ---

  public playBgm(type: 'overworld' | 'dungeon' | 'cave' | 'title' | 'game_over') {
    this.resume();
    if (this.currentBgm === type) return;
    this.stopBgm();
    this.currentBgm = type;

    if (type === 'overworld') {
      this.startOverworldSequence();
    } else if (type === 'dungeon') {
      this.startDungeonSequence();
    } else if (type === 'cave') {
      this.startCaveSequence();
    } else if (type === 'title') {
      this.startTitleSequence();
    } else if (type === 'game_over') {
      this.startGameOverSequence();
    }
  }

  public playGameOverTheme() {
    this.playBgm('game_over');
  }

  public stopGameOverTheme() {
    if (this.currentBgm === 'game_over') {
      this.stopBgm();
    }
  }

  public stopBgm() {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.activeVoices.forEach((v) => {
      try {
        (v as OscillatorNode).stop?.();
        v.disconnect();
      } catch {}
    });
    this.activeVoices = [];
    this.currentBgm = null;
    this.bgmStep = 0;
  }

  /**
   * Overworld Theme: The immortal Koji Kondo anthem
   * 150 BPM, 16th notes = ~100ms per step
   */
  private startOverworldSequence() {
    const stepDuration = 0.125; // 120 BPM 16th note
    this.bgmStep = 0;

    // Frequencies (Hz)
    const Bb3 = 233.08, F3 = 174.61, C4 = 261.63, D4 = 293.66, Eb4 = 311.13, F4 = 349.23;
    const G4 = 392.00, A4 = 440.00, Bb4 = 466.16, C5 = 523.25, D5 = 587.33, Eb5 = 622.25, F5 = 698.46;
    const Bb2 = 116.54, F2 = 87.31, C3 = 130.81, D3 = 146.83, Eb3 = 155.56;

    // 32-step loop for the iconic main melody
    const melody: Array<{ f: number; dur: number } | null> = [
      // Bar 1: Bb4, rest, F4, Bb4
      { f: Bb4, dur: 0.35 }, null, null, { f: F4, dur: 0.1 },
      { f: Bb4, dur: 0.12 }, { f: Bb4, dur: 0.12 }, { f: C5, dur: 0.12 }, { f: D5, dur: 0.12 },
      // Bar 2: Eb5, F5, rest, F5
      { f: Eb5, dur: 0.35 }, { f: F5, dur: 0.35 }, null, null,
      { f: F5, dur: 0.12 }, { f: F5, dur: 0.12 }, { f: F5, dur: 0.12 }, { f: Gb(F5), dur: 0.12 },
      // Bar 3: Ab5, Bb5, rest, Bb5
      { f: 830.61, dur: 0.35 }, { f: 932.33, dur: 0.35 }, null, null,
      { f: 932.33, dur: 0.12 }, { f: 932.33, dur: 0.12 }, { f: 830.61, dur: 0.12 }, { f: 739.99, dur: 0.12 },
      // Bar 4: F5 resolves
      { f: F5, dur: 0.45 }, null, null, null,
      { f: F4, dur: 0.12 }, { f: G4, dur: 0.12 }, { f: A4, dur: 0.12 }, { f: Bb4, dur: 0.12 },
    ];

    function Gb(f: number) { return f * 0.94387; }

    // Triangle bassline (syncopated)
    const bass: Array<number | null> = [
      Bb2, null, Bb2, Bb2, Bb2, null, Bb2, null,
      Eb3, null, Eb3, Eb3, F2, null, F2, null,
      Bb2, null, Bb2, Bb2, Bb2, null, Bb2, null,
      F2, null, F2, F2, F2, F2, F2, F2,
    ];

    const tick = () => {
      if (!this.ctx || !this.masterGain || this.isMuted) return;
      const now = this.ctx.currentTime;
      const step = this.bgmStep % melody.length;

      // Pulse 1 Lead
      const melNote = melody[step];
      if (melNote) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(melNote.f, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + melNote.dur);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + melNote.dur);
      }

      // Triangle Bass
      const bassNote = bass[step];
      if (bassNote) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassNote, now);

        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration * 0.9);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + stepDuration * 0.9);
      }

      // Noise percussion on backbeat
      if (step % 4 === 2) {
        this.playNoiseBurst(0.04, 0.12, 1200); // Snare
      } else if (step % 2 === 0) {
        this.playNoiseBurst(0.02, 0.06, 3000); // Hi-hat
      }

      this.bgmStep++;
    };

    this.bgmTimer = window.setInterval(tick, stepDuration * 1000);
  }

  /**
   * Dungeon Underworld Theme:
   * Eerie chromatic descending motifs + pulsing triangle bass
   */
  private startDungeonSequence() {
    const stepDuration = 0.16; // Slower, menacing pace
    this.bgmStep = 0;

    const notes = [
      220, 207.65, 196, 185, 196, 207.65, 220, 246.94, // A3 -> G#3 -> G3 -> F#3
      220, 261.63, 293.66, 311.13, 293.66, 261.63, 220, null
    ];

    const bass = [
      110, null, 110, null, 103.83, null, 103.83, null,
      98, null, 98, null, 92.5, null, 92.5, null
    ];

    const tick = () => {
      if (!this.ctx || !this.masterGain || this.isMuted) return;
      const now = this.ctx.currentTime;
      const step = this.bgmStep % notes.length;

      const melNote = notes[step];
      if (melNote) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(melNote, now);

        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration * 0.85);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + stepDuration * 0.85);
      }

      const bassNote = bass[step];
      if (bassNote) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassNote, now);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration * 0.95);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + stepDuration * 0.95);
      }

      if (step % 8 === 0) {
        this.playNoiseBurst(0.03, 0.08, 600);
      }

      this.bgmStep++;
    };

    this.bgmTimer = window.setInterval(tick, stepDuration * 1000);
  }

  /**
   * Cave Theme: Warm ancient mystic room
   */
  private startCaveSequence() {
    const stepDuration = 0.22;
    this.bgmStep = 0;

    const notes = [
      329.63, 392.00, 493.88, 587.33, 493.88, 392.00,
      293.66, 369.99, 440.00, 554.37, 440.00, 369.99
    ];

    const tick = () => {
      if (!this.ctx || !this.masterGain || this.isMuted) return;
      const now = this.ctx.currentTime;
      const step = this.bgmStep % notes.length;
      const f = notes[step];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration * 0.9);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + stepDuration * 0.9);

      this.bgmStep++;
    };

    this.bgmTimer = window.setInterval(tick, stepDuration * 1000);
  }

  /**
   * Title Theme: Grand opening
   */
  private startTitleSequence() {
    this.startOverworldSequence();
  }

  /**
   * 2A03 Game Over Theme: The iconic solemn NES Zelda game-over requiem.
   * Features authentic Pulse 1 melody, Pulse 2 counterpoint, and Triangle bass.
   */
  private startGameOverSequence() {
    const stepDuration = 0.145; // ~104 BPM
    this.bgmStep = 0;

    // Frequencies (Hz)
    const D3 = 146.83, F3 = 174.61, G3 = 196.00, Ab3 = 207.65, A3 = 220.00, Bb3 = 233.08, B3 = 246.94;
    const C4 = 261.63, Db4 = 277.18, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, Ab4 = 415.30, A4 = 440.00, Bb4 = 466.16, B4 = 493.88;
    const C5 = 523.25, Db5 = 554.37, D5 = 587.33;

    // Authentic NES Zelda Game Over melody (Pulse 1)
    const melody: Array<{ f: number; dur: number } | null> = [
      // Bar 1: D4, F4, Ab4, B4
      { f: D4, dur: 0.22 }, null,
      { f: F4, dur: 0.22 }, null,
      { f: Ab4, dur: 0.22 }, null,
      { f: B4, dur: 0.32 }, null, null,
      // Bar 2: D5, Db5, C5, B4
      { f: D5, dur: 0.35 }, null, null,
      { f: Db5, dur: 0.22 }, null,
      { f: C5, dur: 0.22 }, null,
      { f: B4, dur: 0.42 }, null, null, null,
      // Bar 3: Bb4, A4, Ab4, G4
      { f: Bb4, dur: 0.22 }, null,
      { f: A4, dur: 0.22 }, null,
      { f: Ab4, dur: 0.22 }, null,
      { f: 392.00, dur: 0.40 }, null, null, null, // G4
      // Bar 4: F4, D4, Db4, D4 resolve
      { f: F4, dur: 0.26 }, null,
      { f: D4, dur: 0.32 }, null, null,
      { f: Db4, dur: 0.32 }, null, null,
      { f: D4, dur: 0.70 }, null, null, null, null, null,
    ];

    // Harmony (Pulse 2)
    const harmony: Array<{ f: number; dur: number } | null> = [
      { f: A3, dur: 0.22 }, null,
      { f: D4, dur: 0.22 }, null,
      { f: F4, dur: 0.22 }, null,
      { f: Ab4, dur: 0.32 }, null, null,

      { f: B4, dur: 0.35 }, null, null,
      { f: Bb4, dur: 0.22 }, null,
      { f: A4, dur: 0.22 }, null,
      { f: Ab4, dur: 0.42 }, null, null, null,

      { f: G4, dur: 0.22 }, null,
      { f: F4, dur: 0.22 }, null,
      { f: E4, dur: 0.22 }, null,
      { f: 311.13, dur: 0.40 }, null, null, null, // Eb4

      { f: D4, dur: 0.26 }, null,
      { f: Bb3, dur: 0.32 }, null, null,
      { f: A3, dur: 0.32 }, null, null,
      { f: A3, dur: 0.70 }, null, null, null, null, null,
    ];

    // Triangle Bass
    const bass: Array<number | null> = [
      73.42, null, 73.42, null, 103.83, null, 123.47, null, null,
      146.83, null, null, 138.59, null, 130.81, null, 123.47, null, null, null,
      116.54, null, 110.00, null, 103.83, null, 98.00, null, null, null,
      87.31, null, 73.42, null, null, 69.30, null, null, 73.42, null, null, null, null, null,
    ];

    const tick = () => {
      if (!this.ctx || !this.masterGain || this.isMuted) return;
      const now = this.ctx.currentTime;
      const step = this.bgmStep % melody.length;

      // Pulse 1 Lead
      const melNote = melody[step];
      if (melNote) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(melNote.f, now);

        gain.gain.setValueAtTime(0.20, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + melNote.dur);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + melNote.dur);
        this.activeVoices.push(osc);
      }

      // Pulse 2 Harmony
      const harmNote = harmony[step];
      if (harmNote) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(harmNote.f, now);

        gain.gain.setValueAtTime(0.10, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + harmNote.dur);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + harmNote.dur);
        this.activeVoices.push(osc);
      }

      // Triangle Bass
      const bassNote = bass[step];
      if (bassNote) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassNote, now);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 1.8);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + stepDuration * 1.8);
        this.activeVoices.push(osc);
      }

      this.bgmStep++;
    };

    tick();
    this.bgmTimer = window.setInterval(tick, stepDuration * 1000);
  }
}

export const chiptune = new ChiptuneEngine();
