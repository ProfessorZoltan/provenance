// All music is generated live from JSON scores by Tone.js. One AudioContext, started on the first
// user gesture. Battle music follows the party's Tempo gauge (BPM and layer thresholds) and Entropy.

import * as Tone from 'tone';
import type { EraDef, ScoreDef, ScoreLayer } from '../types/content';

type Pitched = Tone.Synth | Tone.FMSynth;

interface LiveLayer {
  def: ScoreLayer;
  gain: Tone.Gain;
  synth: Pitched | Tone.MembraneSynth | Tone.NoiseSynth | Tone.PolySynth;
  pitched: boolean;
  motifPos: number;
  motifWait: number;
  extra?: Tone.ToneAudioNode[];
}

export class AudioEngine {
  private started = false;
  private music = new Tone.Gain(0.7);
  private sfxBus = new Tone.Gain(0.8);
  private echoSend = new Tone.Gain(0);
  private delay: Tone.FeedbackDelay | null = null;
  private layers: LiveLayer[] = [];
  private score: ScoreDef | null = null;
  private era: EraDef | null = null;
  private loopId: number | null = null;
  private nextStepTime = 0;
  private step = 0;
  private tempo = 0;
  private entropy = 0;
  private sfxSynths: { sine: Tone.Synth; membrane: Tone.MembraneSynth; noise: Tone.NoiseSynth; fm: Tone.FMSynth } | null = null;
  private sfxLast = 0;
  private lastCents = -1;
  private layerOn = new Map<string, boolean>();
  private pendingScore: { score: ScoreDef; era: EraDef } | null = null;

  isStarted(): boolean {
    return this.started;
  }

  async start(): Promise<void> {
    if (this.started) return;
    try {
      await Tone.start();
      this.started = true;
      this.music.connect(Tone.getDestination());
      this.sfxBus.connect(Tone.getDestination());
      this.delay = new Tone.FeedbackDelay('8n.', 0.55);
      this.echoSend.connect(this.delay);
      this.delay.connect(this.music);
      this.sfxSynths = {
        sine: new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.2 } }).connect(this.sfxBus),
        membrane: new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 5 }).connect(this.sfxBus),
        noise: new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } }).connect(this.sfxBus),
        fm: new Tone.FMSynth({ harmonicity: 3, modulationIndex: 8, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.3 } }).connect(this.sfxBus),
      };
      if (this.pendingScore) {
        const p = this.pendingScore;
        this.pendingScore = null;
        this.play(p.score, p.era);
      }
    } catch (e) {
      console.warn('[audio] could not start', e);
    }
  }

  setVolumes(music: number, sfx: number): void {
    this.music.gain.rampTo(music, 0.2);
    this.sfxBus.gain.rampTo(sfx, 0.2);
  }

  /** Switch to a score. Safe to call before start(): it is queued. */
  play(score: ScoreDef, era: EraDef): void {
    if (!this.started) { this.pendingScore = { score, era }; return; }
    if (this.score?.id === score.id) return;
    this.stop();
    this.score = score;
    this.era = era;
    this.step = 0;
    this.lastCents = -1;
    this.layerOn.clear();
    for (const def of score.layers) this.layers.push(this.buildLayer(def, era));
    // A lookahead scheduler on Tone's worker clock. The Transport's BPM is never automated:
    // its tick parameter keeps every automation event forever and scans them on each lookup,
    // which is what froze long 2148 battles. Tempo changes simply change the next step length.
    this.nextStepTime = Tone.now() + 0.1;
    this.loopId = Tone.getContext().setInterval(() => this.schedule(), 0.04);
    this.applyTempo();
    this.applyEntropy();
  }

  private stepSeconds(): number {
    if (!this.score) return 0.25;
    const bpm = this.score.baseBpm + 1.5 * Math.min(40, Math.max(0, this.tempo));
    return 30 / bpm; // one eighth note
  }

  private schedule(): void {
    if (!this.score) return;
    const horizon = Tone.now() + 0.2;
    let guard = 0;
    while (this.nextStepTime < horizon && guard++ < 8) {
      const dur = this.stepSeconds() * (this.tempo >= 40 ? 2 : 1);
      const swing = this.step % 2 === 1 ? this.score.swing * dur * 0.5 : 0;
      this.tick(this.nextStepTime + swing);
      this.nextStepTime += dur;
    }
  }

  stop(): void {
    if (this.loopId !== null) Tone.getContext().clearInterval(this.loopId);
    this.loopId = null;
    for (const l of this.layers) {
      l.synth.dispose();
      l.gain.dispose();
      l.extra?.forEach((n) => n.dispose());
    }
    this.layers = [];
    this.score = null;
  }

  setTempo(t: number): void {
    this.tempo = t;
    this.applyTempo();
  }

  setEntropy(e: number): void {
    this.entropy = e;
    this.applyEntropy();
  }

  private applyTempo(): void {
    if (!this.score || !this.started) return;
    for (const l of this.layers) {
      const on = this.tempo >= l.def.minTempo;
      if (this.layerOn.get(l.def.id) === on) continue;
      this.layerOn.set(l.def.id, on);
      l.gain.gain.rampTo(on ? l.def.gain : 0, 0.8);
    }
  }

  private applyEntropy(): void {
    if (!this.started) return;
    const over = Math.max(0, this.entropy - 70) / 30;
    const cents = Math.round(over * 50);
    if (cents === this.lastCents) return;
    this.lastCents = cents;
    for (const l of this.layers) {
      if (!l.pitched) continue;
      const s = l.synth as Pitched | Tone.PolySynth;
      if ('detune' in s && s.detune) s.detune.rampTo(cents, 0.5);
      else if (s instanceof Tone.PolySynth) s.set({ detune: cents });
    }
    this.echoSend.gain.rampTo(over > 0 ? 0.35 * over + 0.1 : 0, 0.5);
  }

  private freq(degree: number, octave = 0): number {
    if (!this.score || !this.era) return 220;
    const scale = this.score.scale;
    const edo = this.era.tuning.edo;
    const len = scale.length;
    const oct = Math.floor(degree / len) + octave;
    const idx = ((degree % len) + len) % len;
    return this.era.tuning.root * Math.pow(2, (scale[idx] + oct * edo) / edo);
  }

  private buildLayer(def: ScoreLayer, era: EraDef): LiveLayer {
    const gain = new Tone.Gain(0).connect(this.music);
    const extra: Tone.ToneAudioNode[] = [];
    let synth: LiveLayer['synth'];
    let pitched = true;
    switch (def.instrument) {
      case 'sine':
        synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.4, decay: 0.3, sustain: 0.6, release: 2.5 } }).connect(gain);
        break;
      case 'sinepluck':
        synth = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.2 } }).connect(gain);
        break;
      case 'fm':
        synth = new Tone.FMSynth({ harmonicity: 2.5, modulationIndex: 6, envelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 1.2 }, modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.6 } }).connect(gain);
        break;
      case 'granular': {
        // A still, dark swell. An earlier version swept this filter with an LFO, which read as a
        // siren under the 19-tone motif; the sweep is gone and the texture stays where it belongs.
        const filter = new Tone.Filter(480, 'lowpass').connect(gain);
        synth = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 3.5, decay: 1.5, sustain: 0.5, release: 4 } }).connect(filter);
        extra.push(filter);
        pitched = false;
        break;
      }
      case 'polysynth': {
        // Glossy and hard-edged: a bright saw through a fixed filter, quantised by the scheduler.
        const filter = new Tone.Filter(2600, 'lowpass').connect(gain);
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.005, decay: 0.22, sustain: 0.25, release: 0.5 },
        }).connect(filter);
        extra.push(filter);
        break;
      }
      case 'choirpad': {
        const chorus = new Tone.Chorus(1.2, 3.2, 0.45).start().connect(gain);
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.9, decay: 0.6, sustain: 0.75, release: 2.4 },
        }).connect(chorus);
        extra.push(chorus);
        break;
      }
      case 'gatedperc': {
        const hp = new Tone.Filter(1400, 'highpass').connect(gain);
        synth = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0 } }).connect(hp);
        extra.push(hp);
        pitched = false;
        break;
      }
      case 'membrane':
        synth = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6 }).connect(gain);
        pitched = false;
        break;
      case 'detuned': {
        const filter = new Tone.Filter(1400, 'lowpass').connect(gain);
        synth = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.9 } }).connect(filter);
        extra.push(filter);
        break;
      }
      case 'tape': {
        const vib = new Tone.Vibrato(3.5, 0.12).connect(gain);
        synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 2 } }).connect(vib);
        extra.push(vib);
        break;
      }
      case 'foundperc': {
        const bp = new Tone.Filter(900, 'bandpass').connect(gain);
        synth = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } }).connect(bp);
        extra.push(bp);
        pitched = false;
        break;
      }
      case 'static': {
        const hp = new Tone.Filter(3000, 'highpass').connect(gain);
        synth = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(hp);
        extra.push(hp);
        pitched = false;
        break;
      }
      default:
        synth = new Tone.Synth().connect(gain);
    }
    if (pitched && (def.pattern === 'motif' || def.pattern === 'motifInverted' || def.pattern === 'harmony')) {
      (synth as Tone.ToneAudioNode).connect(this.echoSend);
    }
    void era;
    return { def, gain, synth, pitched, motifPos: 0, motifWait: 0, extra };
  }

  private note(l: LiveLayer, f: number, dur: string, time: number): void {
    // Quarter-tone bends in 2148 are applied to the frequency itself, so no automation events pile up.
    const bend = this.era?.id === '2148' && l.pitched ? Math.pow(2, ((Math.random() - 0.5) * 100) / 1200) : 1;
    const s = l.synth;
    try {
      if (s instanceof Tone.PolySynth || s instanceof Tone.Synth || s instanceof Tone.FMSynth) s.triggerAttackRelease(f * bend, dur, time);
    } catch (e) {
      console.warn('[music]', e);
    }
  }

  /** Debug: automation event counts that must stay bounded during a long battle. */
  stats(): { bpmEvents: number; layers: number; step: number; gainEvents: number } {
    const bpm = Tone.getTransport().bpm as unknown as { _param?: { _events?: { length: number } } };
    const gains = this.layers.map((l) => (l.gain.gain as unknown as { _events?: { length: number } })._events?.length ?? 0);
    return { bpmEvents: bpm._param?._events?.length ?? -1, layers: this.layers.length, step: this.step, gainEvents: Math.max(0, ...gains) };
  }

  private tick(time: number): void {
    if (!this.score || !this.era) return;
    const step = this.step % 8;
    const bar = Math.floor(this.step / 8);
    const halfTime = this.tempo >= 40;
    this.step++;
    // 2148: tempo drifts ±6% on a slow cycle, done as note-time jitter rather than BPM automation;
    // a beat drops now and then.
    if (this.era.tuning.drift > 0) {
      const beat = this.stepSeconds() * 2;
      time += this.era.tuning.drift * beat * Math.sin((bar * 8 + step) / 40);
    }
    const dropped = this.era.tuning.drift > 0 && Math.random() < 0.06;
    const motif = this.score.motif;
    for (const l of this.layers) {
      if (l.gain.gain.value <= 0.001 && this.tempo < l.def.minTempo) continue;
      const s = l.synth;
      switch (l.def.pattern) {
        case 'bass':
          if ((step === 0 || step === 4) && !dropped) this.note(l, this.freq(0, -1), halfTime ? '2n' : '4n', time);
          break;
        case 'pad':
          if (step === 0 && bar % 2 === 0) {
            const chord = [0, 2, 4].map((d) => this.freq(d, 0));
            if (s instanceof Tone.PolySynth) s.triggerAttackRelease(chord, halfTime ? '2m' : '1m', time);
            else this.note(l, chord[0], '1m', time);
          }
          break;
        case 'perc':
          if (s instanceof Tone.MembraneSynth) {
            if (step === 0 || step === 4) s.triggerAttackRelease(this.era.id === '2312' ? 'A1' : 'C1', '8n', time);
            if (step === 6 && bar % 2 === 1) s.triggerAttackRelease('C2', '16n', time);
          } else if (s instanceof Tone.NoiseSynth) {
            if (step === 2 || step === 6 || (step === 3 && this.era.id === '2148')) s.triggerAttackRelease('16n', time);
          } else if (step === 2 || step === 6) this.note(l, this.freq(4, 1), '16n', time);
          break;
        case 'motif':
        case 'motifInverted':
        case 'harmony': {
          if (l.motifWait > 0) { l.motifWait--; break; }
          const i = l.motifPos % motif.length;
          const deg = l.def.pattern === 'motifInverted' ? -motif[i] : motif[i] + (l.def.pattern === 'harmony' ? 2 : 0);
          const durs = l.def.durations ?? motif.map(() => 2);
          const wait = durs[i % durs.length];
          if (!(l.def.pattern === 'harmony' && step === 0) && !dropped) this.note(l, this.freq(deg, l.def.pattern === 'harmony' ? 1 : 0), `${Math.max(1, wait)}*8n`, time);
          l.motifWait = Math.max(0, wait - 1);
          l.motifPos++;
          break;
        }
        case 'ornament':
          if (s instanceof Tone.NoiseSynth) {
            if (l.def.instrument === 'static') { if (Math.random() < 0.18) s.triggerAttackRelease('32n', time); }
            else if (step === 0 && bar % 4 === 0) s.triggerAttackRelease('2m', time);
          }
          break;
      }
    }
  }

  /** Era-flavored sound effects. 2312 hits are attackless sine bursts; 2148 hits are struck objects. */
  sfx(kind: 'hit' | 'heal' | 'tempo' | 'move' | 'confirm' | 'cancel' | 'warn' | 'chronal', era: string): void {
    if (!this.started || !this.sfxSynths) return;
    const s = this.sfxSynths;
    // Tone requires strictly increasing start times per voice; space rapid effects a few ms apart.
    const now = Math.max(Tone.now(), this.sfxLast + 0.03);
    this.sfxLast = now + 0.2;
    try {
      switch (kind) {
        case 'hit':
          if (era === '2312') { s.sine.envelope.attack = 0.05; s.sine.triggerAttackRelease(160, 0.15, now); }
          else { s.membrane.triggerAttackRelease('G1', '16n', now); s.noise.triggerAttackRelease('16n', now); }
          break;
        case 'chronal':
          s.fm.triggerAttackRelease(880, 0.25, now); s.fm.triggerAttackRelease(870, 0.25, now + 0.12);
          break;
        case 'heal':
          // Soft and low rather than a bell pair: two chimes over the music read as an alarm.
          s.sine.envelope.attack = 0.02; s.sine.triggerAttackRelease(392, 0.12, now); s.sine.triggerAttackRelease(523, 0.16, now + 0.1);
          break;
        case 'tempo':
          s.fm.triggerAttackRelease(440, 0.08, now); s.fm.triggerAttackRelease(660, 0.08, now + 0.07); s.fm.triggerAttackRelease(990, 0.12, now + 0.14);
          break;
        case 'move':
          s.sine.envelope.attack = 0.001; s.sine.triggerAttackRelease(era === '2312' ? 1320 : 440, 0.03, now);
          break;
        case 'confirm':
          s.sine.envelope.attack = 0.001; s.sine.triggerAttackRelease(660, 0.06, now); s.sine.triggerAttackRelease(990, 0.08, now + 0.05);
          break;
        case 'cancel':
          s.sine.envelope.attack = 0.001; s.sine.triggerAttackRelease(330, 0.08, now);
          break;
        case 'warn':
          s.fm.triggerAttackRelease(110, 0.4, now); s.noise.triggerAttackRelease('8n', now);
          break;
      }
    } catch (e) {
      console.warn('[sfx]', e);
    }
  }
}
