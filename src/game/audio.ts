export class Synth {
  muted = false;
  private ctx: AudioContext | null = null;

  ensure() {
    if (typeof window === "undefined") return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, cutoff: number) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + dur);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.ctx.destination);
    src.start(t);
  }

  shoot() {
    this.tone(220, 0.05, "square", 0.04, 90);
    this.noise(0.04, 0.05, 1800);
  }

  boom() {
    this.noise(0.35, 0.18, 600);
    this.tone(90, 0.3, "sawtooth", 0.06, 40);
  }

  stealth() {
    this.tone(520, 0.12, "sine", 0.05, 180);
  }

  ambush() {
    this.boom();
    this.tone(330, 0.12, "square", 0.05);
    this.tone(440, 0.16, "square", 0.05);
  }

  level() {
    [523, 659, 784, 1046].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.12, "square", 0.05), i * 70);
    });
  }

  hurt() {
    this.tone(160, 0.1, "square", 0.05, 70);
  }

  pickup() {
    this.tone(880, 0.06, "square", 0.04);
  }

  pop() {
    this.tone(700, 0.2, "sine", 0.07, 80);
  }

  fanfare() {
    [392, 523, 659, 784].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.14, "triangle", 0.05), i * 90);
    });
  }

  moto() {
    this.noise(0.25, 0.06, 400);
    this.tone(70, 0.25, "sawtooth", 0.04, 40);
  }
}

export const synth = new Synth();
