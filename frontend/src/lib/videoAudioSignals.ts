/**
 * Lightweight client-side audio forensics for video files.
 * Decodes the audio track using OfflineAudioContext and computes
 * scalar signals the backend uses to judge voice authenticity.
 */

export interface VideoAudioSignals {
  durationSec?: number;
  sampleRate?: number;
  rmsMean?: number;
  rmsStd?: number;
  zcrMean?: number;
  spectralFlatnessMean?: number;
  spectralCentroidMean?: number;
  silentRatio?: number;
  voicedRatio?: number;
  noiseFloorDb?: number;
  pitchStability?: number;
  hasAudio?: boolean;
}

function mean(arr: Float32Array | number[]): number {
  if (!arr.length) return 0;
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}
function std(arr: number[]): number {
  if (!arr.length) return 0;
  const m = mean(arr);
  let v = 0;
  for (let i = 0; i < arr.length; i++) v += (arr[i] - m) ** 2;
  return Math.sqrt(v / arr.length);
}

/** Tiny FFT (radix-2). Input length must be power of 2. Returns [re, im]. */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  // bit reversal
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    let m = n >> 1;
    while (m >= 1 && j >= m) { j -= m; m >>= 1; }
    j += m;
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const theta = (-2 * Math.PI) / size;
    const wpr = Math.cos(theta), wpi = Math.sin(theta);
    for (let i = 0; i < n; i += size) {
      let wr = 1, wi = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = wr * re[b] - wi * im[b];
        const ti = wr * im[b] + wi * re[b];
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nwr = wr * wpr - wi * wpi;
        wi = wr * wpi + wi * wpr;
        wr = nwr;
      }
    }
  }
}

export async function analyzeVideoAudio(file: File): Promise<VideoAudioSignals> {
  try {
    const arrayBuf = await file.arrayBuffer();
    const Ctx: typeof OfflineAudioContext =
      (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!Ctx) return { hasAudio: false };

    // Decode at a low sample rate to keep it fast.
    const targetRate = 16000;
    const tmp = new Ctx(1, targetRate * 1, targetRate);
    let audioBuf: AudioBuffer;
    try {
      audioBuf = await tmp.decodeAudioData(arrayBuf.slice(0));
    } catch {
      return { hasAudio: false };
    }
    if (!audioBuf || audioBuf.length === 0) return { hasAudio: false };

    // Mix down to mono Float32
    const len = audioBuf.length;
    const mono = new Float32Array(len);
    for (let ch = 0; ch < audioBuf.numberOfChannels; ch++) {
      const data = audioBuf.getChannelData(ch);
      for (let i = 0; i < len; i++) mono[i] += data[i];
    }
    if (audioBuf.numberOfChannels > 1) {
      for (let i = 0; i < len; i++) mono[i] /= audioBuf.numberOfChannels;
    }

    const sr = audioBuf.sampleRate;
    const frameSize = 1024;
    const hop = 512;
    const rmsList: number[] = [];
    const zcrList: number[] = [];
    const flatnessList: number[] = [];
    const centroidList: number[] = [];
    const dominantBinList: number[] = [];
    let silentFrames = 0;
    let voicedFrames = 0;
    const noiseFloorRms: number[] = [];

    const re = new Float32Array(frameSize);
    const im = new Float32Array(frameSize);
    const totalFrames = Math.max(0, Math.floor((len - frameSize) / hop));
    const stride = Math.max(1, Math.floor(totalFrames / 200)); // cap ~200 windows

    for (let f = 0; f < totalFrames; f += stride) {
      const off = f * hop;
      let sumSq = 0;
      let zc = 0;
      let prev = mono[off];
      for (let i = 0; i < frameSize; i++) {
        const v = mono[off + i];
        sumSq += v * v;
        if ((v >= 0) !== (prev >= 0)) zc++;
        prev = v;
        // Hann window into FFT buffer
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
        re[i] = v * w;
        im[i] = 0;
      }
      const rms = Math.sqrt(sumSq / frameSize);
      rmsList.push(rms);
      zcrList.push(zc / frameSize);

      if (rms < 0.005) {
        silentFrames++;
        noiseFloorRms.push(rms);
        continue;
      }
      if (rms > 0.02 && zc / frameSize < 0.3) voicedFrames++;

      fft(re, im);
      const half = frameSize >> 1;
      let geo = 0, arith = 0, weighted = 0, total = 0, maxMag = 0, maxBin = 0;
      let used = 0;
      for (let k = 1; k < half; k++) {
        const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]) + 1e-9;
        geo += Math.log(mag);
        arith += mag;
        const freq = (k * sr) / frameSize;
        weighted += freq * mag;
        total += mag;
        if (mag > maxMag) { maxMag = mag; maxBin = k; }
        used++;
      }
      const flatness = Math.exp(geo / used) / (arith / used);
      flatnessList.push(Math.min(1, Math.max(0, flatness)));
      centroidList.push(weighted / total);
      dominantBinList.push(maxBin);
    }

    const rmsMean = mean(rmsList);
    const rmsStd = std(rmsList);
    const zcrMean = mean(zcrList);
    const flatnessMean = mean(flatnessList);
    const centroidMean = mean(centroidList);
    const totalCounted = silentFrames + Math.max(1, rmsList.length - silentFrames);
    const silentRatio = silentFrames / Math.max(1, rmsList.length);
    const voicedRatio = voicedFrames / Math.max(1, rmsList.length);
    const noiseFloor = noiseFloorRms.length ? mean(noiseFloorRms) : Math.min(...rmsList);
    const noiseFloorDb = 20 * Math.log10(Math.max(1e-6, noiseFloor));

    // pitch stability: how steady the dominant bin is across voiced frames
    let pitchStability = 0;
    if (dominantBinList.length > 4) {
      const ds = std(dominantBinList);
      const dm = mean(dominantBinList) || 1;
      pitchStability = Math.max(0, Math.min(1, 1 - ds / dm));
    }

    return {
      hasAudio: true,
      durationSec: audioBuf.duration,
      sampleRate: sr,
      rmsMean: +rmsMean.toFixed(4),
      rmsStd: +rmsStd.toFixed(4),
      zcrMean: +zcrMean.toFixed(4),
      spectralFlatnessMean: +flatnessMean.toFixed(4),
      spectralCentroidMean: +centroidMean.toFixed(1),
      silentRatio: +silentRatio.toFixed(3),
      voicedRatio: +voicedRatio.toFixed(3),
      noiseFloorDb: +noiseFloorDb.toFixed(1),
      pitchStability: +pitchStability.toFixed(3),
    };
  } catch (err) {
    console.warn('audio analysis failed', err);
    return { hasAudio: false };
  }
}