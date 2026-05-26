export class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private isMuted: boolean = false;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceGain: GainNode | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext(): void {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public async preload(name: string, url: string): Promise<void> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      // Temporary context to decode audio if the main one isn't initialized yet
      const decodeCtx = this.ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
      this.buffers.set(name, audioBuffer);
    } catch (error) {
      console.error(`Failed to preload audio: ${name} from ${url}`, error);
    }
  }

  public play(name: string, volume: number = 0.2): void {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    const buffer = this.buffers.get(name);
    if (!buffer) {
      console.warn(`Sound buffer not found: ${name}`);
      return;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    source.start(0);
  }

  public synthesize(name: string, type: string): void {
    this.initContext();
    if (!this.ctx) return;

    const sampleRate = this.ctx.sampleRate;
    let duration: number;
    let data: Float32Array;

    switch (type) {
      case "slime_aggro": {
        // Wet squelch: low frequency oscillation with pitch drop + filtered noise
        duration = 0.3;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 10) * (1 - t / duration);
          // Pitch drops from 120Hz to 80Hz
          const freq = 120 - (40 * t / duration);
          const phase = 2 * Math.PI * freq * t;
          const osc = Math.sin(phase) * 0.6;
          // Filtered noise (smoothed random)
          const noise = (Math.random() * 2 - 1) * 0.4 * Math.exp(-t * 8);
          data[i] = (osc + noise) * env;
        }
        break;
      }

      case "skeleton_aggro": {
        // Bone rattle: rapid high-frequency clicks with short decay
        duration = 0.4;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        const clickCount = 8;
        for (let c = 0; c < clickCount; c++) {
          const clickStart = Math.floor((c / clickCount) * len * 0.8);
          const clickLen = Math.floor(sampleRate * 0.02);
          const clickFreq = 800 + Math.random() * 1200;
          for (let i = 0; i < clickLen && clickStart + i < len; i++) {
            const t = i / sampleRate;
            const clickEnv = Math.exp(-t * 200);
            const sample = Math.sin(2 * Math.PI * clickFreq * t) * clickEnv * 0.5;
            data[clickStart + i] += sample;
          }
        }
        // Overall envelope fade
        for (let i = 0; i < len; i++) {
          data[i] *= 1 - (i / len) * 0.3;
        }
        break;
      }

      case "ghost_aggro": {
        // Eerie wail: sine 400->600Hz with vibrato, long decay
        duration = 0.8;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.sin(Math.PI * t / duration) * Math.exp(-t * 2);
          // Pitch slides from 400 to 600Hz
          const baseFreq = 400 + 200 * (t / duration);
          // Vibrato: 6Hz LFO with 20Hz depth
          const vibrato = Math.sin(2 * Math.PI * 6 * t) * 20;
          const freq = baseFreq + vibrato;
          phase += (2 * Math.PI * freq) / sampleRate;
          // Mix fundamental with soft harmonic for eeriness
          const sample = Math.sin(phase) * 0.7 + Math.sin(phase * 1.5) * 0.2;
          data[i] = sample * env;
        }
        break;
      }

      case "brute_aggro": {
        // Deep roar: low sawtooth-like wave with distortion
        duration = 0.6;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = (t < 0.05 ? t / 0.05 : 1) * Math.exp(-t * 3);
          // Frequency sweeps from 100 down to 60Hz
          const freq = 100 - 40 * (t / duration);
          phase += (2 * Math.PI * freq) / sampleRate;
          // Sawtooth approximation via harmonics
          let sample = 0;
          for (let h = 1; h <= 6; h++) {
            sample += Math.sin(phase * h) / h;
          }
          sample *= 0.5;
          // Hard clipping for distortion
          sample = Math.max(-0.6, Math.min(0.6, sample * 1.8));
          // Add sub-bass rumble
          sample += Math.sin(phase * 0.5) * 0.3 * env;
          data[i] = sample * env;
        }
        break;
      }

      case "runner_aggro": {
        // Fast snarl: short burst mid-frequency with rapid attack/decay
        duration = 0.2;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          // Very fast attack (5ms), rapid decay
          const attack = Math.min(1, t / 0.005);
          const env = attack * Math.exp(-t * 20);
          // Frequency sweeps 400 down to 200Hz
          const freq = 400 - 200 * (t / duration);
          const osc = Math.sin(2 * Math.PI * freq * t) * 0.6;
          // Add grit with noise burst
          const noise = (Math.random() * 2 - 1) * 0.3 * Math.exp(-t * 15);
          data[i] = (osc + noise) * env;
        }
        break;
      }

      case "coin_pickup": {
        // Metallic clink: high sine with quick pitch rise, very short
        duration = 0.1;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 30) * 0.7;
          // Pitch rises from 1200 to 2400Hz for sparkle
          const freq = 1200 + 1200 * (t / duration);
          phase += (2 * Math.PI * freq) / sampleRate;
          // Two harmonically related tones for metallic quality
          const sample = Math.sin(phase) * 0.6 + Math.sin(phase * 2.5) * 0.3;
          data[i] = sample * env;
        }
        break;
      }

      case "swing_light": {
        // High-frequency air swoosh: pitch slide + white noise mix
        duration = 0.15;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 28) * (1 - t / duration);
          const freq = 800 - 500 * (t / duration); // 800 -> 300
          phase += (2 * Math.PI * freq) / sampleRate;
          const osc = Math.sin(phase) * 0.4;
          const noise = (Math.random() * 2 - 1) * 0.4;
          data[i] = (osc * 0.5 + noise * 0.5) * env;
        }
        break;
      }

      case "swing_heavy": {
        // Metallic sweep: metallic ring resonance + whoosh noise
        duration = 0.25;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let phase1 = 0;
        let phase2 = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const attack = Math.min(1, t / 0.008);
          const env = attack * Math.exp(-t * 16) * (1 - t / duration);
          const freq = 600 - 450 * (t / duration); // 600 -> 150
          phase1 += (2 * Math.PI * freq) / sampleRate;
          phase2 += (2 * Math.PI * freq * 2.2) / sampleRate; // metallic harmonic
          const osc = Math.sin(phase1) * 0.4 + Math.sin(phase2) * 0.25;
          const noise = (Math.random() * 2 - 1) * 0.35;
          data[i] = (osc * 0.65 + noise * 0.35) * env * 1.2;
        }
        break;
      }

      case "swing_blunt": {
        // Blunt swoosh: low frequency oscillation + soft hum noise
        duration = 0.22;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let phase = 0;
        let lastNoise = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 14) * (1 - t / duration);
          const freq = 220 - 150 * (t / duration); // 220 -> 70
          phase += (2 * Math.PI * freq) / sampleRate;
          const osc = Math.sin(phase) * 0.65;
          // Filtered low rumble noise
          const white = Math.random() * 2 - 1;
          lastNoise += 0.1 * (white - lastNoise);
          data[i] = (osc * 0.7 + lastNoise * 0.3) * env * 1.3;
        }
        break;
      }

      case "spell_blast": {
        duration = 0.6;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let phase = 0;
        let lastNoise = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 8);
          // Freq sweeps down 250 -> 20Hz
          const freq = 250 - 230 * (t / duration);
          phase += (2 * Math.PI * freq) / sampleRate;
          const osc = Math.sin(phase) * 0.6;
          // lowpass filtered noise
          const white = Math.random() * 2 - 1;
          lastNoise += 0.05 * (white - lastNoise);
          data[i] = (osc + lastNoise * 0.4) * env;
        }
        break;
      }

      case "spell_fire": {
        duration = 0.4;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.sin(Math.PI * t / duration) * Math.exp(-t * 4);
          // Freq slides up 100 -> 600Hz
          const freq = 100 + 500 * (t / duration);
          phase += (2 * Math.PI * freq) / sampleRate;
          const osc = Math.sin(phase) * 0.5;
          // crackle spikes
          const crackle = Math.random() < 0.08 ? (Math.random() * 2 - 1) * 0.35 : 0;
          data[i] = (osc + crackle) * env;
        }
        break;
      }

      case "spell_poison": {
        duration = 0.5;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let phase = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 6);
          // Bubble modulation: freq modulated by square LFO at 24Hz
          const lfo = Math.sin(2 * Math.PI * 24 * t) > 0 ? 80 : -50;
          const freq = 200 + lfo;
          phase += (2 * Math.PI * freq) / sampleRate;
          const osc = Math.sin(phase) * 0.6;
          data[i] = osc * env;
        }
        break;
      }

      case "spell_frost": {
        duration = 0.7;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        // Sum of multiple decaying chime frequencies
        const freqs = [1000, 1250, 1500, 1850];
        const decays = [12, 18, 24, 30];
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          let sample = 0;
          for (let f = 0; f < freqs.length; f++) {
            sample += Math.sin(2 * Math.PI * freqs[f] * t) * Math.exp(-t * decays[f]) * 0.25;
          }
          data[i] = sample;
        }
        break;
      }

      case "ambience_grass": {
        duration = 2.0;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        // Low wind rumble
        let lastOut = 0;
        const alpha = 0.02;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          lastOut += alpha * (white - lastOut);
          data[i] = lastOut * 0.15;
        }
        // Crickets
        const numChirps = 3;
        for (let c = 0; c < numChirps; c++) {
          const chirpStart = Math.floor((c / numChirps) * len * 0.8) + Math.floor(Math.random() * 4000);
          const chirpLen = Math.floor(sampleRate * 0.12);
          for (let i = 0; i < chirpLen && chirpStart + i < len; i++) {
            const t = i / sampleRate;
            const amp = Math.exp(-t * 8) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 18 * t));
            data[chirpStart + i] += Math.sin(2 * Math.PI * 2600 * t) * amp * 0.02;
          }
        }
        break;
      }

      case "ambience_desert": {
        duration = 2.0;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let y1 = 0, y2 = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const centerFreq = 380 + Math.sin(2 * Math.PI * 0.2 * t) * 120;
          const f = 2 * Math.sin(Math.PI * centerFreq / sampleRate);
          const input = Math.random() * 2 - 1;
          const high = input - y1 - y2;
          const band = f * high + y1;
          y1 = band;
          const low = f * band + y2;
          y2 = low;
          data[i] = band * 0.035;
        }
        break;
      }

      case "ambience_tundra": {
        duration = 2.0;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let y1 = 0, y2 = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const centerFreq = 650 + Math.sin(2 * Math.PI * 0.55 * t) * 250;
          const f = 2 * Math.sin(Math.PI * centerFreq / sampleRate);
          const input = Math.random() * 2 - 1;
          const high = input - y1 - y2;
          const band = f * high + y1;
          y1 = band;
          const low = f * band + y2;
          y2 = low;
          data[i] = band * 0.03;
        }
        break;
      }

      case "ambience_lava": {
        duration = 2.0;
        const len = Math.floor(sampleRate * duration);
        data = new Float32Array(len);
        let lastOut = 0;
        const alpha = 0.008; // deep rumble
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          lastOut += alpha * (white - lastOut);
          data[i] = lastOut * 0.25;
        }
        // Bubble pops
        const numPops = 4;
        for (let p = 0; p < numPops; p++) {
          const popStart = Math.floor((p / numPops) * len * 0.8) + Math.floor(Math.random() * 6000);
          const popLen = Math.floor(sampleRate * 0.06);
          for (let i = 0; i < popLen && popStart + i < len; i++) {
            const t = i / sampleRate;
            const popEnv = Math.exp(-t * 25);
            const popFreq = 120 - 90 * (t / 0.06);
            data[popStart + i] += Math.sin(2 * Math.PI * popFreq * t) * popEnv * 0.04;
          }
        }
        break;
      }

      default:
        console.warn(`Unknown synthesize type: ${type}`);
        return;
    }

    const buffer = this.ctx.createBuffer(1, data.length, sampleRate);
    buffer.getChannelData(0).set(data);
    this.buffers.set(name, buffer);
  }

  public playAmbience(biome: string): void {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    this.stopAmbience();

    const bufferName = `ambience_${biome}`;
    if (!this.buffers.has(bufferName)) {
      this.synthesize(bufferName, bufferName);
    }

    const buffer = this.buffers.get(bufferName);
    if (!buffer) return;

    this.ambienceSource = this.ctx.createBufferSource();
    this.ambienceSource.buffer = buffer;
    this.ambienceSource.loop = true;

    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.value = 0.08; // ambient volume

    this.ambienceSource.connect(this.ambienceGain);
    this.ambienceGain.connect(this.ctx.destination);
    this.ambienceSource.start(0);
  }

  public stopAmbience(): void {
    if (this.ambienceSource) {
      try {
        this.ambienceSource.stop();
      } catch (e) {}
      this.ambienceSource.disconnect();
      this.ambienceSource = null;
    }
    if (this.ambienceGain) {
      this.ambienceGain.disconnect();
      this.ambienceGain = null;
    }
  }
}
