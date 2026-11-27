import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Mic,
  MicOff,
  Sparkles,
  Sliders,
  Trash2,
  LogIn,
  LogOut,
  Cpu,
  Cloud,
  Cable,
  LayoutDashboard,
} from "lucide-react";
import { auth, loginWithGoogle, logoutUser, loadRemoteConfig } from "./lib/firebase";
import { generateVoiceProfile } from "./lib/ai";
import { saveVoiceProfile, getUserProfiles, deleteVoiceProfile } from "./lib/db";
import { voiceEngine } from "./audio/engine";
import { measureBaselinePitch } from "./audio/pitch";
import { MOCK_PRESETS, type DspPreset, type VoiceProfile } from "./types/voice";

type Tab = "dashboard" | "studio" | "live" | "routing";

export default function App() {
  const [tab, setTab] = useState<Tab>("live");
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [experimentalFx, setExperimentalFx] = useState(true);

  // Live audio state
  const [active, setActive] = useState(false);
  const [preset, setPreset] = useState<DspPreset>(MOCK_PRESETS[1]);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Voice Studio state
  const [stylePrompt, setStylePrompt] = useState("");
  const [baselineHz, setBaselineHz] = useState(140);
  const [measuring, setMeasuring] = useState(false);
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<{ preset: DspPreset; source: "on-device" | "cloud" } | null>(
    null
  );

  useEffect(() => {
    loadRemoteConfig().then((cfg) => {
      setSystemPrompt(cfg.systemPrompt);
      setExperimentalFx(cfg.enableExperimentalFx);
    });

    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const saved = await getUserProfiles(u.uid);
        setProfiles(saved);
      } else {
        setProfiles([]);
      }
    });
  }, []);

  useEffect(() => {
    if (!active || tab !== "live") return;
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
  }, [active, tab]);

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

  const applyPreset = (next: DspPreset) => {
    setPreset(next);
    if (active) voiceEngine.applyPreset(next);
  };

  const handleMeasurePitch = async () => {
    setMeasuring(true);
    setError(null);
    try {
      const hz = await measureBaselinePitch(2500);
      setBaselineHz(hz);
    } catch {
      setError("Could not read microphone for pitch calibration.");
    } finally {
      setMeasuring(false);
    }
  };

  const handleGenerate = async () => {
    if (!stylePrompt.trim() || !consent) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generateVoiceProfile(stylePrompt, baselineHz, systemPrompt);
      setDraft({ preset: res.preset, source: res.inferenceSource });
      applyPreset(res.preset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!user || !draft) return;
    const saved = await saveVoiceProfile(user.uid, draft.preset, draft.source);
    setProfiles((prev) => [saved, ...prev]);
    setDraft(null);
    setStylePrompt("");
    setTab("live");
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteVoiceProfile(user.uid, id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  const allPresets: DspPreset[] = [...profiles, ...MOCK_PRESETS];

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "system-ui" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>VoxShift AI</h1>
          <small style={{ color: "#64748b" }}>
            Consent-Based Real-Time Voice Studio · Firebase AI Logic (Gemini Nano)
          </small>
        </div>

        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.9rem" }}>{user.displayName}</span>
            <button onClick={logoutUser} style={{ padding: "0.4rem 0.75rem", cursor: "pointer" }}>
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        ) : (
          <button onClick={loginWithGoogle} style={{ padding: "0.5rem 0.9rem", cursor: "pointer" }}>
            <LogIn size={14} /> Sign in with Google
          </button>
        )}
      </header>

      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {(
          [
            ["dashboard", "Dashboard", LayoutDashboard],
            ["studio", "AI Voice Studio", Sparkles],
            ["live", "Live Changer", Mic],
            ["routing", "Virtual Mic Guide", Cable],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "0.5rem 1rem",
              cursor: "pointer",
              fontWeight: tab === key ? 700 : 400,
              background: tab === key ? "#0f172a" : "#f1f5f9",
              color: tab === key ? "#fff" : "#0f172a",
              border: "none",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            padding: "0.75rem",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {tab === "dashboard" && (
        <section>
          <h2>Saved Voice Profiles ({profiles.length})</h2>
          {!user && <p>Sign in with Google to sync your AI-generated voice profiles to Firestore.</p>}
          {profiles.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "0.9rem",
                marginBottom: "0.75rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong>{p.profileName}</strong>{" "}
                <span style={{ fontSize: "0.75rem", color: "#0284c7" }}>
                  {p.inferenceSource === "on-device" ? (
                    <><Cpu size={12} /> Gemini Nano (On-Device)</>
                  ) : (
                    <><Cloud size={12} /> Cloud Fallback</>
                  )}
                </span>
                <p style={{ margin: "0.25rem 0 0", color: "#475569", fontSize: "0.9rem" }}>
                  {p.description}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => {
                    applyPreset(p);
                    setTab("live");
                  }}
                >
                  Load
                </button>
                <button onClick={() => handleDelete(p.id)} aria-label="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "studio" && (
        <section>
          <h2>AI Voice Studio</h2>
          <p style={{ color: "#475569" }}>
            Calibrate your baseline pitch, describe an authorized voice style, and let Gemini Nano
            generate live DSP parameters.
          </p>

          <div style={{ marginBottom: "1rem" }}>
            <button onClick={handleMeasurePitch} disabled={measuring}>
              {measuring ? "Listening (2.5s)..." : `Measure Baseline Pitch (${baselineHz} Hz)`}
            </button>
          </div>

          <textarea
            rows={3}
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            placeholder="e.g., Warm late-night FM radio host with deep bass and crisp highs"
            style={{ width: "100%", padding: "0.6rem", marginBottom: "0.75rem" }}
          />

          <label style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I confirm this voice profile uses my own voice or a consenting speaker's authorized style.
          </label>

          <button
            onClick={handleGenerate}
            disabled={generating || !consent || !stylePrompt.trim()}
            style={{ padding: "0.6rem 1.1rem", cursor: "pointer" }}
          >
            <Sparkles size={15} /> {generating ? "Generating with AI..." : "Generate DSP Profile"}
          </button>

          {draft && (
            <div
              style={{
                marginTop: "1.25rem",
                padding: "1rem",
                border: "1px solid #bae6fd",
                background: "#f0f9ff",
                borderRadius: 8,
              }}
            >
              <h3 style={{ marginTop: 0 }}>{draft.preset.profileName}</h3>
              <p>{draft.preset.description}</p>
              <pre style={{ fontSize: "0.8rem", overflowX: "auto" }}>
                {JSON.stringify(draft.preset, null, 2)}
              </pre>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button onClick={handleSaveDraft} disabled={!user}>
                  {user ? "Save to Firestore & Use Live" : "Sign in to Save"}
                </button>
                <small>
                  Executed via: <strong>{draft.source}</strong>
                </small>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "live" && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Live Voice Changer</h2>
            <button
              onClick={toggleMic}
              style={{
                padding: "0.6rem 1.2rem",
                background: active ? "#dc2626" : "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {active ? <><MicOff size={16} /> Stop Mic</> : <><Mic size={16} /> Start Live Changer</>}
            </button>
          </div>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            Use wired headphones to prevent acoustic feedback.
          </p>

          <canvas
            ref={canvasRef}
            width={760}
            height={120}
            style={{ width: "100%", borderRadius: 8, background: "#0f172a", marginBottom: "1rem" }}
          />

          <h3>Active Profile: {preset.profileName}</h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            {allPresets.map((p, idx) => (
              <button
                key={`${p.profileName}-${idx}`}
                onClick={() => applyPreset(p)}
                style={{
                  padding: "0.45rem 0.85rem",
                  fontWeight: preset.profileName === p.profileName ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {p.profileName}
              </button>
            ))}
          </div>

          <h3><Sliders size={16} /> Live DSP Controls</h3>
          <label style={{ display: "block", marginBottom: "0.6rem" }}>
            Pitch: {preset.pitchSemitones} semitones
            <input
              type="range"
              min={-6}
              max={6}
              step={0.5}
              value={preset.pitchSemitones}
              onChange={(e) => applyPreset({ ...preset, pitchSemitones: Number(e.target.value) })}
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ display: "block", marginBottom: "0.6rem" }}>
            Bass (Low): {preset.lowShelfGainDb} dB
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={preset.lowShelfGainDb}
              onChange={(e) => applyPreset({ ...preset, lowShelfGainDb: Number(e.target.value) })}
              style={{ width: "100%" }}
            />
          </label>
          {experimentalFx && (
            <label style={{ display: "block", marginBottom: "0.6rem" }}>
              Reverb Wet: {Math.round(preset.reverbWet * 100)}%
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.02}
                value={preset.reverbWet}
                onChange={(e) => applyPreset({ ...preset, reverbWet: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </label>
          )}
        </section>
      )}

      {tab === "routing" && (
        <section>
          <h2>Using VoxShift AI in WhatsApp Web & Free4Talk</h2>
          <p>
            Browsers sandbox microphone access per tab. To send your transformed voice into another
            Chrome tab, route this tab's audio output into a virtual microphone:
          </p>
          <ol>
            <li>
              <strong>Linux (PipeWire / CachyOS):</strong> Create a virtual null-sink with{" "}
              <code>pactl load-module module-null-sink sink_name=VoxShiftMic</code>, route Chrome's
              output to it in <code>pavucontrol</code>, and select <em>Monitor of VoxShiftMic</em>{" "}
              as your mic in WhatsApp/Free4Talk.
            </li>
            <li>
              <strong>Windows:</strong> Install <strong>VB-Cable</strong>, set Chrome's output to{" "}
              <em>CABLE Input</em>, and select <em>CABLE Output</em> as your mic in your calling tab.
            </li>
            <li>
              <strong>macOS:</strong> Install <strong>BlackHole 2ch</strong> and route browser output
              to BlackHole, then pick BlackHole as the input in your calling app.
            </li>
          </ol>
        </section>
      )}
    </div>
  );
}
