import { useState, useRef, useEffect, useCallback } from "react";
import { useScans, type Scan } from "@/hooks/useScans";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Upload, Loader2, ShieldCheck, AlertTriangle, ShieldAlert, Sparkles,
  Download, Share2, ScanLine, Mic, Video as VideoIcon, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { analyzeVideoAudio, type VideoAudioSignals } from "@/lib/videoAudioSignals";
import { generateForensicReport } from "@/lib/forensicReport";
import { useAnalysis } from "@/contexts/AnalysisContext";

/* ── Types ─────────────────────────────────── */
interface DetectionScores {
  facialManipulation: number;
  lipSync: number;
  temporalConsistency: number;
  ganArtifacts: number;
  blinkRate?: number;
  lightingMismatch?: number;
  backgroundConsistency?: number;
  voiceAuthenticity?: number;
}
interface TimelineEvent {
  timestamp: number;
  type: "visual" | "audio" | "both";
  severity: "low" | "medium" | "high";
  label: string;
  note?: string;
}
interface VoiceSummary {
  score: number; // 0-100 authenticity
  verdict: "Real" | "Possibly AI-generated" | "Suspicious";
  summary: string;
}
interface VideoResult {
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "deepfake";
  verdict?: string;
  verdictTag?: "Original" | "Edited" | "Manipulated" | "AI-Generated" | "Deepfake Suspected";
  trustScore?: { level: "Low Risk" | "Medium Risk" | "High Risk"; score: number };
  primaryMetric?: { label: string; value: number };
  plainExplanation?: string;
  analysis: string;
  whyItMatters?: string[];
  detectionScores?: DetectionScores;
  voice?: VoiceSummary;
  timeline?: TimelineEvent[];
  frameFlags?: string[];
  speedMetrics?: any;
  executionTimeMs?: number;
}

/* ── Style maps ────────────────────────────── */
const TRUST_STYLES: Record<string, string> = {
  "Low Risk": "bg-success/15 text-success border-success/40",
  "Medium Risk": "bg-warning/15 text-warning border-warning/40",
  "High Risk": "bg-destructive/15 text-destructive border-destructive/40",
};

const VERDICT_STYLES: Record<string, { ring: string; text: string; icon: JSX.Element; gradient: string }> = {
  "Original":           { ring: "ring-success/40",     text: "text-success",     icon: <ShieldCheck className="w-7 h-7" />, gradient: "from-success/30 to-success/5" },
  "Edited":             { ring: "ring-warning/40",     text: "text-warning",     icon: <AlertTriangle className="w-7 h-7" />, gradient: "from-warning/25 to-warning/5" },
  "Manipulated":        { ring: "ring-destructive/40", text: "text-destructive", icon: <ShieldAlert className="w-7 h-7" />, gradient: "from-destructive/30 to-destructive/5" },
  "AI-Generated":       { ring: "ring-destructive/50", text: "text-destructive", icon: <Sparkles className="w-7 h-7" />,    gradient: "from-destructive/30 to-primary/10" },
  "Deepfake Suspected": { ring: "ring-destructive/50", text: "text-destructive", icon: <ShieldAlert className="w-7 h-7" />, gradient: "from-destructive/35 to-destructive/5" },
};

const VOICE_STYLES: Record<string, string> = {
  "Real":                  "bg-success/15 text-success border-success/40",
  "Possibly AI-generated": "bg-warning/15 text-warning border-warning/40",
  "Suspicious":            "bg-destructive/15 text-destructive border-destructive/40",
};

/* ── Helpers ───────────────────────────────── */
function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto"; v.muted = true; v.crossOrigin = "anonymous"; v.src = src;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error("Failed to load video"));
  });
}

async function captureFrames(src: string, count = 5, maxDim = 640): Promise<{ timestamp: number; dataUrl: string }[]> {
  const video = await loadVideo(src);
  const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
  const targets: number[] = [];
  for (let i = 0; i < count; i++) {
    // sample evenly, skip extreme edges
    targets.push(((i + 0.5) / count) * duration);
  }
  const canvas = document.createElement("canvas");
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) throw new Error("Unable to read video dimensions");
  const scale = Math.min(1, maxDim / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const out: { timestamp: number; dataUrl: string }[] = [];
  for (const t of targets) {
    await new Promise<void>((resolve) => {
      const onSeek = () => { video.removeEventListener("seeked", onSeek); resolve(); };
      video.addEventListener("seeked", onSeek);
      try { video.currentTime = Math.min(duration - 0.05, Math.max(0, t)); } catch { resolve(); }
    });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    out.push({ timestamp: video.currentTime, dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
  }
  return out;
}

/* ── Component ─────────────────────────────── */
export const VideoVerification = () => {
  const { videoState, runVideoAnalysis, clearAnalysis } = useAnalysis();
  const [localVideo, setLocalVideo] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loaderStage, setLoaderStage] = useState("Sampling frames…");
  const [duration, setDuration] = useState<number>(0);
  const [audioSignals, setAudioSignals] = useState<VideoAudioSignals | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { saveScan } = useScans();

  const selectedVideo = videoState.input?.src || localVideo;
  const isAnalyzing = videoState.isAnalyzing;
  const loaderProgress = videoState.progress;
  const result = videoState.result as VideoResult | null;

  const runAnalysis = async (file: File, src: string) => {
    setLocalVideo(src);
    setLoaderStage("Sampling frames…");
    const frames = await captureFrames(src, 5, 640);
    const audio = await analyzeVideoAudio(file);
    setAudioSignals(audio);
    const dur = videoRef.current?.duration || frames[frames.length - 1]?.timestamp || 0;
    setDuration(dur);
    runVideoAnalysis({ frames, audio, durationSec: dur, src });
  };

  const handleVideoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("Please upload a video file"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setLocalVideo(src);
      setVideoFile(file);
      setAudioSignals(null);
      runAnalysis(file, src);
    };
    reader.readAsDataURL(file);
  }, [user]);

  /* ── Share / PDF ───────────────────────────── */
  const buildScanForReport = (): Scan | null => {
    if (!result) return null;
    return {
      id: crypto.randomUUID(),
      user_id: user?.id ?? "anonymous",
      scan_type: "video",
      input_label: "Video scan",
      file_path: null,
      verdict: result.verdict || result.verdictTag || result.category,
      confidence: result.confidence,
      source_type: null,
      details: {
        ...result,
        aiExplanation: result.plainExplanation || result.analysis,
        scores: result.detectionScores,
      },
      effects: [],
      created_at: new Date().toISOString(),
    } as Scan;
  };
  const handleDownloadReport = () => {
    const scan = buildScanForReport();
    if (!scan) return;
    generateForensicReport(scan);
    toast.success("PDF report downloaded");
  };
  const handleShare = async () => {
    if (!result) return;
    const summary = `Verifact video result: ${result.verdictTag || result.verdict} · ${result.primaryMetric?.label ?? "Confidence"} ${result.primaryMetric?.value ?? result.confidence}%`;
    try {
      if (navigator.share) await navigator.share({ title: "Verifact scan", text: summary });
      else { await navigator.clipboard.writeText(summary); toast.success("Summary copied"); }
    } catch { /* user cancelled */ }
  };

  const verdictKey = (result?.verdictTag as string) || (
    result?.category === "authentic" ? "Original" :
    result?.category === "suspicious" ? "Edited" :
    "Deepfake Suspected"
  );
  const vstyle = VERDICT_STYLES[verdictKey] || VERDICT_STYLES["Edited"];
  const primary = result?.primaryMetric ?? (result ? {
    label: result.category === "authentic" ? "Authenticity Score" :
           result.verdictTag === "AI-Generated" ? "AI Generated Probability" :
           result.verdictTag === "Deepfake Suspected" ? "Deepfake Probability" :
           "Manipulation Probability",
    value: result.confidence,
  } : null);

  return (
    <div className="space-y-6">
      {/* ── Upload & Video Preview ────────────── */}
      <Card className="glass-panel p-6 animate-glass-fade">
        <div className="space-y-4">
          <div
            onClick={() => !selectedVideo && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed border-border/50 rounded-lg p-6 text-center transition-all glass-panel overflow-hidden ${selectedVideo ? "" : "hover:border-primary/50 cursor-pointer animate-lift"}`}
          >
            {selectedVideo ? (
              <div className="space-y-4">
                <div className="relative inline-block w-full">
                  <video
                    ref={videoRef}
                    src={selectedVideo}
                    controls
                    className="max-h-96 mx-auto rounded-lg w-full object-contain bg-black"
                  />
                  {isAnalyzing && (
                    <motion.div
                      className="absolute inset-x-0 h-12 pointer-events-none rounded-lg"
                      style={{ background: "linear-gradient(180deg, transparent, hsl(var(--primary)/0.45), transparent)" }}
                      initial={{ top: "-10%" }}
                      animate={{ top: ["-10%", "100%"] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </div>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button
                    variant="outline"
                    className="glass-panel"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAnalysis("video"); setLocalVideo(null); setVideoFile(null); setAudioSignals(null);
                    }}
                  >
                    Remove
                  </Button>
                  <Button
                    className="bg-gradient-primary"
                    disabled={isAnalyzing || !videoFile}
                    onClick={(e) => { e.stopPropagation(); if (videoFile && selectedVideo) runAnalysis(videoFile, selectedVideo); }}
                  >
                    {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Re-scanning</> : <><Sparkles className="mr-2 h-4 w-4" />Re-scan</>}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-6">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Drop or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MP4, MOV, WEBM — full forensic + voice authenticity scan
                  </p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
          </div>
        </div>
      </Card>

      {/* ── Premium Loading State ──────────────── */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div key="loader" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="glass-panel p-8 text-center space-y-4 overflow-hidden relative">
              <motion.div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ background: "radial-gradient(60% 50% at 50% 50%, hsl(var(--primary)/0.35), transparent)" }}
                animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}
              />
              <div className="relative space-y-3">
                <div className="flex items-center justify-center">
                  <motion.div
                    className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-2xl"
                    animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <ScanLine className="h-7 w-7 text-primary-foreground" />
                  </motion.div>
                </div>
                <h3 className="text-lg font-bold tracking-tight">Forensic video scan in progress</h3>
                <p className="text-xs text-muted-foreground">{loaderStage}</p>
                <div className="max-w-md mx-auto">
                  <Progress value={loaderProgress} className="h-2" />
                  <p className="text-[11px] text-muted-foreground mt-2">{loaderProgress}%</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Premium Results Page ───────────────── */}
      <AnimatePresence>
        {result && !isAnalyzing && (
          <motion.div
            key="results" ref={resultsRef}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="space-y-5"
          >
            {/* HERO */}
            <Card className={`glass-panel p-7 animate-glass-ripple ring-2 ${vstyle.ring} bg-gradient-to-br ${vstyle.gradient} relative overflow-hidden`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/60 backdrop-blur-md border ${vstyle.text}`}>
                      {vstyle.icon}
                      <span className="font-bold text-sm">{verdictKey}</span>
                    </div>
                    {result.trustScore && (
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${TRUST_STYLES[result.trustScore.level]}`}>
                        {result.trustScore.level}
                      </span>
                    )}
                    {result.voice && (
                      <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${VOICE_STYLES[result.voice.verdict]}`}>
                        <Mic className="w-3.5 h-3.5" /> Voice: {result.voice.verdict}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">{primary?.label}</p>
                    <div className="flex items-baseline gap-2">
                      <motion.span
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className={`text-6xl md:text-7xl font-extrabold tracking-tight tabular-nums ${vstyle.text}`}
                      >
                        {primary?.value ?? 0}
                      </motion.span>
                      <span className="text-2xl font-bold text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  <Button onClick={handleDownloadReport} className="bg-gradient-primary">
                    <Download className="mr-2 h-4 w-4" /> Download report
                  </Button>
                  <Button variant="outline" onClick={handleShare} className="glass-panel">
                    <Share2 className="mr-2 h-4 w-4" /> Share
                  </Button>
                </div>
              </div>
              {(result.plainExplanation || result.analysis) && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                  className="mt-5 text-base leading-relaxed text-foreground/90 border-t border-border/40 pt-4 max-w-3xl"
                >
                  {result.plainExplanation || result.analysis}
                </motion.p>
              )}
            </Card>

            {/* VOICE AUTHENTICITY CARD */}
            {result.voice && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                <Card className="glass-panel p-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                        <Mic className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Voice Authenticity Score</p>
                        <h3 className="text-2xl font-bold">{result.voice.score}<span className="text-sm font-medium text-muted-foreground">/100</span></h3>
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${VOICE_STYLES[result.voice.verdict]}`}>
                      {result.voice.verdict}
                    </span>
                  </div>
                  <Progress value={result.voice.score} className="h-2 mt-4" />
                  <p className="text-sm text-muted-foreground mt-3">{result.voice.summary}</p>
                  {audioSignals?.hasAudio === false && (
                    <p className="text-xs text-warning mt-2">No audio track detected — voice score is from visual cues only.</p>
                  )}
                </Card>
              </motion.div>
            )}

            {/* WHY THIS MATTERS */}
            {result.whyItMatters && result.whyItMatters.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Why this matters</h3>
                  </div>
                  <ul className="space-y-2">
                    {result.whyItMatters.map((w, i) => (
                      <motion.li
                        key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.35 + i * 0.06 }}
                        className="flex items-start gap-2 text-sm text-foreground/85"
                      >
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                        <span>{w}</span>
                      </motion.li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            )}

            {/* DETECTION BREAKDOWN */}
            {result.detectionScores && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card className="glass-panel p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4">Detection breakdown</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {([
                      ["Facial manipulation", result.detectionScores.facialManipulation],
                      ["Lip-sync", result.detectionScores.lipSync],
                      ["Temporal jumps", result.detectionScores.temporalConsistency],
                      ["GAN artifacts", result.detectionScores.ganArtifacts],
                      ...(result.detectionScores.blinkRate != null ? [["Blink rate", result.detectionScores.blinkRate] as const] : []),
                      ...(result.detectionScores.lightingMismatch != null ? [["Lighting mismatch", result.detectionScores.lightingMismatch] as const] : []),
                      ...(result.detectionScores.backgroundConsistency != null ? [["Background swap", result.detectionScores.backgroundConsistency] as const] : []),
                      ...(result.detectionScores.voiceAuthenticity != null ? [["Voice anomaly", result.detectionScores.voiceAuthenticity] as const] : []),
                    ] as const).map(([label, val], i) => (
                      <CircularStat key={label as string} label={label as string} value={val as number} delay={0.4 + i * 0.04} />
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* TIMELINE */}
            {result.timeline && result.timeline.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Suspicious frames timeline</h3>
                  </div>
                  <Timeline events={result.timeline} duration={duration ?? Math.max(...result.timeline.map(e => e.timestamp), 1)} />
                </Card>
              </motion.div>
            )}

            {/* FRAME FLAGS */}
            {result.frameFlags && result.frameFlags.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                <Card className="glass-panel p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">Detected issues</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.frameFlags.map((f, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-full border border-border/50 bg-muted/30 text-xs">{f}</span>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Sub-components ────────────────────────── */
function CircularStat({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const tone = v >= 65 ? "text-destructive" : v >= 35 ? "text-warning" : "text-success";
  const stroke = v >= 65 ? "hsl(var(--destructive))" : v >= 35 ? "hsl(var(--warning))" : "hsl(var(--success))";
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }}
      className="p-3 rounded-xl glass-panel border border-border/40 flex flex-col items-center gap-1.5"
    >
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r={r} stroke="hsl(var(--muted))" strokeWidth="6" fill="none" opacity="0.3" />
          <motion.circle
            cx="32" cy="32" r={r} stroke={stroke} strokeWidth="6" fill="none" strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (c * v) / 100 }}
            transition={{ duration: 0.9, delay, ease: "easeOut" }}
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums ${tone}`}>
          {v}
        </div>
      </div>
      <p className="text-[11px] text-center text-muted-foreground leading-tight">{label}</p>
    </motion.div>
  );
}

function Timeline({ events, duration }: { events: TimelineEvent[]; duration: number }) {
  const safeDur = Math.max(0.001, duration);
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const sevColor: Record<string, string> = {
    low: "bg-warning",
    medium: "bg-orange-400",
    high: "bg-destructive",
  };
  const typeIcon: Record<string, JSX.Element> = {
    visual: <VideoIcon className="w-3 h-3" />,
    audio: <Mic className="w-3 h-3" />,
    both: <ScanLine className="w-3 h-3" />,
  };
  return (
    <div className="space-y-4">
      {/* Track */}
      <div className="relative h-8 rounded-full bg-muted/40 border border-border/40">
        {sorted.map((e, i) => {
          const left = `${Math.min(100, Math.max(0, (e.timestamp / safeDur) * 100))}%`;
          return (
            <div key={i} className="absolute top-0 h-full -translate-x-1/2 group" style={{ left }}>
              <div className={`w-3 h-full rounded-full ${sevColor[e.severity]} shadow-md ring-2 ring-background`} />
              <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-background border border-border/60 rounded px-2 py-1 z-10">
                {e.timestamp.toFixed(1)}s · {e.label}
              </div>
            </div>
          );
        })}
        <div className="absolute -bottom-5 left-0 text-[10px] text-muted-foreground">0s</div>
        <div className="absolute -bottom-5 right-0 text-[10px] text-muted-foreground">{safeDur.toFixed(1)}s</div>
      </div>

      {/* List */}
      <ul className="space-y-2 pt-2">
        {sorted.map((e, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className={`mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sevColor[e.severity]} text-white`}>
              {typeIcon[e.type]} {e.timestamp.toFixed(1)}s
            </span>
            <div>
              <p className="font-medium text-foreground/90">{e.label}</p>
              {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
