import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Sliders } from "lucide-react";
import { voiceEngine } from "./audio/engine";
import { MOCK_PRESETS, type DspPreset } from "./types/voice";

export default function App() {
  const [active, setActive] = useState(false);
  const [preset, setPreset] = useState<DspPreset>(MOCK_PRESETS[1]);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    let rafId = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const wave = voiceEngine.getWaveform();
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.beginPath();

        const slice = canvas.width / wave.length;
        for (let i = 0; i < wave.length; i++) {
          const x = i * slice;
          const y = ((wave[i] + 1) / 2) * canvas.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [active]);

  const toggleMic = async () => {
    setError(null);
    if (active) {
      voiceEngine.stop();
      setActive(false);
    } else {
      try {
        await voiceEngine.start(preset);
        setActive(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Microphone access failed");
      }
    }
  };

  const updatePreset = (next: DspPreset) => {
    setPreset(next);
    if (active) voiceEngine.applyPreset(next);
  };

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui", padding: "0 1rem" }}>
      <h1>VoxShift AI — Live Studio</h1>
      <p style={{ color: "#64748b" }}>Use wired headphones to prevent acoustic feedback.</p>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <button onClick={toggleMic} style={{ padding: "0.75rem 1.25rem", cursor: "pointer" }}>
          {active ? <><MicOff size={16} /> Stop Mic</> : <><Mic size={16} /> Start Live Changer</>}
        </button>
      </div>

      {error && <p style={{ color: "#ef4444" }}>{error}</p>}

      <canvas
        ref={canvasRef}
        width={600}
        height={120}
        style={{ width: "100%", borderRadius: 8, background: "#0f172a", marginBottom: "1.5rem" }}
      />

      <h3>Presets</h3>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {MOCK_PRESETS.map((p) => (
          <button
            key={p.profileName}
            onClick={() => updatePreset(p)}
            style={{
              padding: "0.5rem 0.9rem",
              fontWeight: preset.profileName === p.profileName ? 700 : 400,
            }}
          >
            {p.profileName}
          </button>
        ))}
      </div>

      <h3><Sliders size={16} /> Live DSP Controls</h3>
      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        Pitch: {preset.pitchSemitones} semitones
        <input
          type="range"
          min={-6}
          max={6}
          step={0.5}
          value={preset.pitchSemitones}
          onChange={(e) => updatePreset({ ...preset, pitchSemitones: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        Bass (Low): {preset.lowShelfGainDb} dB
        <input
          type="range"
          min={-12}
          max={12}
          step={1}
          value={preset.lowShelfGainDb}
          onChange={(e) => updatePreset({ ...preset, lowShelfGainDb: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        Reverb Wet: {Math.round(preset.reverbWet * 100)}%
        <input
          type="range"
          min={0}
          max={0.5}
          step={0.02}
          value={preset.reverbWet}
          onChange={(e) => updatePreset({ ...preset, reverbWet: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
      </label>
    </main>
  );
}
