export interface DspPreset {
  profileName: string;
  description: string;
  pitchSemitones: number;   // -6 to +6
  lowShelfGainDb: number;   // -12 to +12
  midPeakGainDb: number;    // -12 to +12
  highShelfGainDb: number;  // -12 to +12
  reverbWet: number;        // 0 to 1
}

export interface VoiceProfile extends DspPreset {
  id: string;
  createdAt: number;
  consentConfirmed: boolean;
  inferenceSource: "on-device" | "cloud";
}

export const MOCK_PRESETS: DspPreset[] = [
  {
    profileName: "Natural (Bypass)",
    description: "Unprocessed microphone audio.",
    pitchSemitones: 0,
    lowShelfGainDb: 0,
    midPeakGainDb: 0,
    highShelfGainDb: 0,
    reverbWet: 0,
  },
  {
    profileName: "Midnight FM Host",
    description: "Deep broadcast tone with boosted warmth and crisp highs.",
    pitchSemitones: -3.5,
    lowShelfGainDb: 6,
    midPeakGainDb: -2,
    highShelfGainDb: 3,
    reverbWet: 0.08,
  },
  {
    profileName: "Helium Chipmunk",
    description: "High-pitched, bright vocal shift.",
    pitchSemitones: 5.5,
    lowShelfGainDb: -6,
    midPeakGainDb: 2,
    highShelfGainDb: 5,
    reverbWet: 0.05,
  },
];
