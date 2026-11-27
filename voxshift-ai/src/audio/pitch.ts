export async function measureBaselinePitch(durationMs = 2500): Promise<number> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const buf = new Float32Array(analyser.fftSize);
  const samples: number[] = [];
  const end = Date.now() + durationMs;

  while (Date.now() < end) {
    analyser.getFloatTimeDomainData(buf);
    const hz = autoCorrelate(buf, ctx.sampleRate);
    if (hz > 75 && hz < 400) samples.push(hz);
    await new Promise((r) => setTimeout(r, 100));
  }

  stream.getTracks().forEach((t) => t.stop());
  await ctx.close();

  if (samples.length === 0) return 140; // Fallback average vocal pitch
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return Math.round(avg);
}

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / buf.length) < 0.015) return -1;

  let bestOffset = -1;
  let bestCorr = 0;
  for (let offset = 40; offset < 600; offset++) {
    let corr = 0;
    for (let i = 0; i < buf.length - offset; i++) {
      corr += buf[i] * buf[i + offset];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOffset = offset;
    }
  }
  return bestOffset > 0 ? sampleRate / bestOffset : -1;
}
