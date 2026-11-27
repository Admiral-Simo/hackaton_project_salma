import * as Tone from "tone";
import type { DspPreset } from "../types/voice";

class VoiceEngine {
  private mic: Tone.UserMedia | null = null;
  private pitchShift: Tone.PitchShift | null = null;
  private eq: Tone.EQ3 | null = null;
  private reverb: Tone.Reverb | null = null;
  private analyser: Tone.Analyser | null = null;
  private isRunning = false;

  async start(initialPreset: DspPreset): Promise<void> {
    if (this.isRunning) return;

    await Tone.start();

    this.mic = new Tone.UserMedia();
    this.pitchShift = new Tone.PitchShift({
      pitch: initialPreset.pitchSemitones,
      windowSize: 0.08, // Low latency for live speech
      delayTime: 0,
      feedback: 0,
    });

    this.eq = new Tone.EQ3({
      low: initialPreset.lowShelfGainDb,
      mid: initialPreset.midPeakGainDb,
      high: initialPreset.highShelfGainDb,
      lowFrequency: 250,
      highFrequency: 3000,
    });

    this.reverb = new Tone.Reverb({
      decay: 1.5,
      wet: initialPreset.reverbWet,
    });

    this.analyser = new Tone.Analyser("waveform", 256);

    // Chain: Mic -> PitchShift -> EQ3 -> Reverb -> Analyser -> Speakers
    this.mic.chain(
      this.pitchShift,
      this.eq,
      this.reverb,
      this.analyser,
      Tone.getDestination()
    );

    await this.mic.open();
    this.isRunning = true;
  }

  applyPreset(preset: DspPreset): void {
    if (!this.pitchShift || !this.eq || !this.reverb) return;

    this.pitchShift.pitch = preset.pitchSemitones;
    this.eq.low.rampTo(preset.lowShelfGainDb, 0.05);
    this.eq.mid.rampTo(preset.midPeakGainDb, 0.05);
    this.eq.high.rampTo(preset.highShelfGainDb, 0.05);
    this.reverb.wet.rampTo(preset.reverbWet, 0.05);
  }

  getWaveform(): Float32Array {
    if (!this.analyser) return new Float32Array(256);
    return this.analyser.getValue() as Float32Array;
  }

  stop(): void {
    if (!this.isRunning) return;
    this.mic?.close();
    this.mic?.dispose();
    this.pitchShift?.dispose();
    this.eq?.dispose();
    this.reverb?.dispose();
    this.analyser?.dispose();
    this.mic = null;
    this.pitchShift = null;
    this.eq = null;
    this.reverb = null;
    this.analyser = null;
    this.isRunning = false;
  }
}

export const voiceEngine = new VoiceEngine();
