import { getGenerativeModel, Schema } from "firebase/ai";
import { ai } from "./firebase";
import type { DspPreset } from "../types/voice";

const dspSchema = Schema.object({
  properties: {
    profileName: Schema.string(),
    description: Schema.string(),
    pitchSemitones: Schema.number(),
    lowShelfGainDb: Schema.number(),
    midPeakGainDb: Schema.number(),
    highShelfGainDb: Schema.number(),
    reverbWet: Schema.number(),
  },
});

const clamp = (val: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(val) ? val : 0));

export async function generateVoiceProfile(
  userPrompt: string,
  baselineHz: number,
  systemPrompt: string
): Promise<{ preset: DspPreset; inferenceSource: "on-device" | "cloud" }> {
  // Check if Chrome's built-in Gemini Nano is available for UI transparency
  let nanoAvailable = false;
  try {
    const lm = (window as unknown as { LanguageModel?: { availability: () => Promise<string> } })
      .LanguageModel;
    if (lm && (await lm.availability()) === "available") {
      nanoAvailable = true;
    }
  } catch {
    nanoAvailable = false;
  }

  const model = getGenerativeModel(ai, {
    mode: "prefer_on_device",
    inCloudParams: {
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: dspSchema,
      },
    },
  });

  const prompt = `${systemPrompt}
Return ONLY valid JSON with keys: profileName, description, pitchSemitones (-6 to 6), lowShelfGainDb (-12 to 12), midPeakGainDb (-12 to 12), highShelfGainDb (-12 to 12), reverbWet (0 to 0.5).
Speaker baseline pitch: ${baselineHz} Hz.
Requested voice style: "${userPrompt}"`;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text().replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(rawText) as Partial<DspPreset>;

  const preset: DspPreset = {
    profileName: parsed.profileName || "Custom AI Voice",
    description: parsed.description || "AI-generated DSP voice profile.",
    pitchSemitones: clamp(Number(parsed.pitchSemitones), -6, 6),
    lowShelfGainDb: clamp(Number(parsed.lowShelfGainDb), -12, 12),
    midPeakGainDb: clamp(Number(parsed.midPeakGainDb), -12, 12),
    highShelfGainDb: clamp(Number(parsed.highShelfGainDb), -12, 12),
    reverbWet: clamp(Number(parsed.reverbWet), 0, 0.5),
  };

  return {
    preset,
    inferenceSource: nanoAvailable ? "on-device" : "cloud",
  };
}
