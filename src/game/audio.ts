import { DEFAULT_ADVENTURE_CONTROLS } from './adventureCatalog';
import type { GameSettings, PowerUpType } from './types';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private roadOsc: OscillatorNode | null = null;
  private roadFilter: BiquadFilterNode | null = null;
  private roadGain: GainNode | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private isPlayingLoop = false;
  private lastBrakeTime = 0;
  private settings: GameSettings = {
    musicVolume: 0.45,
    sfxVolume: 0.7,
    muted: false,
    sensitivity: 1.0,
    adventureControls: { ...DEFAULT_ADVENTURE_CONTROLS },
  };

  public applySettings(settings: GameSettings): void {
    this.settings = { ...settings };
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const mVol = settings.muted ? 0 : settings.musicVolume * 0.35;
    const sVol = settings.muted ? 0 : settings.sfxVolume;
    this.musicGain?.gain.setTargetAtTime(mVol, now, 0.04);
    this.sfxGain?.gain.setTargetAtTime(sVol, now, 0.04);
  }

  private gestureUnlocked = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const markGesture = () => {
        this.gestureUnlocked = true;
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        window.removeEventListener('pointerdown', markGesture);
        window.removeEventListener('keydown', markGesture);
      };
      window.addEventListener('pointerdown', markGesture, { once: true });
      window.addEventListener('keydown', markGesture, { once: true });
    }
  }

  public unlock(): void {
    if (typeof window === 'undefined' || !this.gestureUnlocked) return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);

      // Continuous subtle tire/chain hum modulated by riding speed
      this.roadOsc = this.ctx.createOscillator();
      this.roadOsc.type = 'triangle';
      this.roadOsc.frequency.value = 72;

      this.roadFilter = this.ctx.createBiquadFilter();
      this.roadFilter.type = 'lowpass';
      this.roadFilter.frequency.value = 180;

      this.roadGain = this.ctx.createGain();
      this.roadGain.gain.value = 0;

      this.roadOsc.connect(this.roadFilter);
      this.roadFilter.connect(this.roadGain);
      this.roadGain.connect(this.sfxGain);
      this.roadOsc.start();

      this.applySettings(this.settings);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setPlayingState(playing: boolean): void {
    if (playing && !this.isPlayingLoop) {
      this.unlock();
      this.isPlayingLoop = true;
      this.startMusicLoop();
    } else if (!playing && this.isPlayingLoop) {
      this.isPlayingLoop = false;
      this.stopMusicLoop();
      this.updateSpeedHum(0, false);
    }
  }

  public updateSpeedHum(speedMps: number, grounded: boolean): void {
    if (!this.ctx || !this.roadOsc || !this.roadGain || !this.roadFilter) return;
    const now = this.ctx.currentTime;
    if (!this.isPlayingLoop || speedMps <= 0.1) {
      this.roadGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }
    const norm = Math.min(1, speedMps / 24);
    const freq = 58 + norm * 96;
    const cutoff = grounded ? 160 + norm * 320 : 95;
    const vol = grounded ? 0.03 + norm * 0.055 : 0.01;
    this.roadOsc.frequency.setTargetAtTime(freq, now, 0.06);
    this.roadFilter.frequency.setTargetAtTime(cutoff, now, 0.06);
    this.roadGain.gain.setTargetAtTime(vol, now, 0.06);
  }

  private startMusicLoop(): void {
    if (this.musicTimer !== null || typeof window === 'undefined') return;
    const bassNotes = [55, 55, 65.41, 73.42, 55, 55, 82.41, 73.42];
    const arpNotes = [220, 261.63, 329.63, 440, 392, 329.63, 293.66, 261.63];

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || !this.isPlayingLoop) return;
      if (this.settings.muted || this.settings.musicVolume <= 0.01) return;
      const now = this.ctx.currentTime;
      const step = this.musicStep % 8;
      this.musicStep++;

      // Driving bass pulse
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(bassNotes[step], now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(340, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 0.16);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.18);

      // Subtle offbeat melodic pluck
      if (step % 2 === 1) {
        const lead = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        lead.type = 'triangle';
        lead.frequency.setValueAtTime(arpNotes[step], now);
        leadGain.gain.setValueAtTime(0.08, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        lead.connect(leadGain);
        leadGain.connect(this.musicGain);
        lead.onended = () => {
          lead.disconnect();
          leadGain.disconnect();
        };
        lead.start(now);
        lead.stop(now + 0.16);
      }
    }, 185);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public playCoin(streak = 0): void {
    this.playTone(760 + Math.min(8, streak) * 45, 1180, 0.11, 'sine', 0.16);
  }

  public playJump(): void {
    this.playTone(190, 460, 0.16, 'triangle', 0.18);
  }

  public playLand(): void {
    this.playTone(130, 58, 0.1, 'sine', 0.16);
  }

  public playBrake(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    if (this.settings.sfxVolume <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastBrakeTime < 280) return;
    this.lastBrakeTime = nowMs;
    this.playTone(320, 145, 0.12, 'sawtooth', 0.08);
  }

  public playNearMiss(): void {
    this.playTone(420, 840, 0.14, 'sawtooth', 0.08);
  }

  public playPowerUp(kind: PowerUpType | boolean = false): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    if (this.settings.sfxVolume <= 0.01) return;

    const noteMap: Record<PowerUpType, number[]> = {
      shield: [392, 523.25, 659.25],
      speed_boost: [330, 440, 659.25, 880],
      magnet: [440, 554.37, 659.25, 830.61],
      double_score: [523.25, 659.25, 783.99, 1046.5],
      super_jump: [293.66, 440, 587.33, 880],
      slow_motion: [659.25, 523.25, 392, 293.66],
    };

    const resolvedKey: PowerUpType =
      typeof kind === 'boolean' ? (kind ? 'speed_boost' : 'double_score') : kind;
    const notes = noteMap[resolvedKey];

    notes.forEach((freq, idx) => {
      const now = this.ctx!.currentTime + idx * 0.055;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = resolvedKey === 'slow_motion' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.2);
    });
  }

  public playShieldSave(): void {
    this.playTone(640, 220, 0.28, 'sawtooth', 0.2);
  }

  public playCrash(): void {
    this.playTone(170, 42, 0.34, 'sawtooth', 0.3);
  }

  public playNewRecord(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    if (this.settings.sfxVolume <= 0.01) return;
    const fanfare = [523.25, 659.25, 783.99, 1046.5];
    fanfare.forEach((freq, idx) => {
      const now = this.ctx!.currentTime + idx * 0.08;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  public playStuntChime(comboCount = 1): void {
    const base = 520 + Math.min(6, comboCount) * 75;
    this.playTone(base, base * 1.38, 0.16, 'triangle', 0.14);
  }

  public playComboBank(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    if (this.settings.sfxVolume <= 0.01) return;
    const notes = [587.33, 739.99, 880, 1174.66];
    notes.forEach((freq, idx) => {
      const now = this.ctx!.currentTime + idx * 0.045;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.24);
    });
  }

  public playCheckpoint(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    if (this.settings.sfxVolume <= 0.01) return;
    const notes = [440, 659.25];
    notes.forEach((freq, idx) => {
      const now = this.ctx!.currentTime + idx * 0.09;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.26);
    });
  }

  public updateAdventureSurfaceSound(
    speedMps: number,
    surface: 'dirt' | 'rock' | 'mud' | 'wood' | 'ice' | 'concrete',
    grounded: boolean,
  ): void {
    if (!this.ctx || !this.roadOsc || !this.roadGain || !this.roadFilter) return;
    const now = this.ctx.currentTime;
    if (!this.isPlayingLoop || speedMps <= 0.2) {
      this.roadGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }
    const norm = Math.min(1, speedMps / 26);
    const freqMap = {
      dirt: 64,
      rock: 82,
      mud: 48,
      wood: 92,
      ice: 118,
      concrete: 76,
    } as const;
    const cutoff = !grounded
      ? 240 + norm * 380 // wind rush when flying
      : surface === 'ice'
        ? 420 + norm * 480
        : surface === 'mud'
          ? 140 + norm * 160
          : 200 + norm * 320;
    const vol = !grounded ? 0.025 + norm * 0.04 : 0.035 + norm * 0.06;
    this.roadOsc.frequency.setTargetAtTime(freqMap[surface] + norm * 75, now, 0.06);
    this.roadFilter.frequency.setTargetAtTime(cutoff, now, 0.06);
    this.roadGain.gain.setTargetAtTime(vol, now, 0.06);
  }

  private playTone(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    peakGain: number,
  ): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    if (this.settings.sfxVolume <= 0.01) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public dispose(): void {
    this.stopMusicLoop();
    try {
      this.roadOsc?.stop();
      this.roadOsc?.disconnect();
      this.roadFilter?.disconnect();
      this.roadGain?.disconnect();
      this.musicGain?.disconnect();
      this.sfxGain?.disconnect();
    } catch {
      // ignore
    }
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
