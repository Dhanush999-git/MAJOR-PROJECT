import { useState, useRef, useCallback, useEffect } from "react";
import { type Scan } from "@/hooks/useScans";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Upload, Loader2, ShieldCheck, AlertTriangle, ShieldAlert, Sparkles,
  Camera, Info, Download, Share2, Eye, EyeOff, ScanLine, Zap,
  CheckCircle2, AlertCircle, Cpu, Layers, FileText, ChevronDown, ChevronUp, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import exifr from "exifr";
import { analyzeImageForensics, type ForensicBundle } from "@/lib/forensicSignals";
import { generateForensicReport } from "@/lib/forensicReport";
import type { SpeedMetrics } from "@/lib/analysisTypes";

/* ── Types ─────────────────────────────────── */
interface DetectedEffect { name: string; confidence: number; severity?: "subtle" | "moderate" | "strong"; }
interface Region { label: string; x: number; y: number; w: number; h: number; severity: "low" | "medium" | "high"; }
interface SpecialistModelResult {
  verdict?: string;
  confidence?: number;
  fake_probability?: number;
  real_probability?: number;
  model?: string;
}
interface DetectionBreakdown {
  deepfake: number; beautyFilter: number; faceEdit: number;
  backgroundReplacement: number; objectRemoval: number; lightingMismatch: number;
  metadataIssues: number; aiPattern: number;
}
interface ImageResult {
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "manipulated";
  classification?: string;
  verdict?: string;
  verdictTag?: "Original Photo" | "Lightly Edited" | "Edited" | "Heavily Manipulated" | "Deepfake Suspected" | "AI Generated";
  sourceType?: "camera" | "lightly-edited" | "heavily-edited" | "ai-generated";
  analysis: string;
  plainExplanation?: string;
  recommendedAction?: string;
  evidence?: string[];
  detectionMethods?: string[];
  limitations?: string[];
  detectors?: Array<{ id: string; name: string; score: number; weight: number; verdict: string; detail: string }>;
  modelDisagreement?: { hasDisagreement: boolean; description?: string; stdDeviation: number };
  whyItMatters?: string[];
  primaryMetric?: { label: string; value: number };
  trustScore?: { level: "Low Risk" | "Medium Risk" | "High Risk"; score: number };
  detectionScores?: {
  aiGeneration: number;
  splicing: number;
  lighting: number;
  metadata: number;
};

  fakeProbability?: number;
  realProbability?: number;
  model?: string;
  specialistModelResult?: SpecialistModelResult | null;
  detectionBreakdown?: DetectionBreakdown;
  effects?: DetectedEffect[];
  regions?: Region[];
  speedMetrics?: SpeedMetrics;
  executionTimeMs?: number;
}
interface ExifInfo {
  make?: string; model?: string; software?: string;
  dateTime?: string; gps?: boolean;
  width?: number; height?: number; iso?: number; focalLength?: number;
}
interface CompressionInfo {
  fileSize: number; megapixels: number; bytesPerPixel: number;
  anomaly: boolean; reason?: string;
}

/* ── EXIF + compression helpers ────────────── */
async function extractExif(file: File): Promise<ExifInfo> {
  try {
    const raw = await exifr.parse(file, true);
    if (!raw) return {};
    return {
      make: raw.Make, model: raw.Model, software: raw.Software,
      dateTime: raw.DateTimeOriginal?.toLocaleString?.() || raw.DateTimeOriginal,
      gps: !!(raw.latitude || raw.longitude),
      width: raw.ImageWidth || raw.ExifImageWidth,
      height: raw.ImageHeight || raw.ExifImageHeight,
      iso: raw.ISO, focalLength: raw.FocalLength,
    };
  } catch { return {}; }
}
function analyzeCompression(file: File, w: number, h: number): CompressionInfo {
  const mp = (w * h) / 1e6;
  const bpp = file.size / (w * h);
  let anomaly = false; let reason: string | undefined;
  if (bpp < 0.05 && file.type === "image/jpeg") { anomaly = true; reason = "Very low bytes-per-pixel — looks re-saved or heavily compressed."; }
  if (bpp > 8) { anomaly = true; reason = "Unusually high bytes-per-pixel — possible embedded data."; }
  return { fileSize: file.size, megapixels: mp, bytesPerPixel: bpp, anomaly, reason };
}

/* ── Trust badge style map ─────────────────── */
const TRUST_STYLES: Record<string, string> = {
  "Low Risk": "bg-success/15 text-success border-success/40",
  "Medium Risk": "bg-warning/15 text-warning border-warning/40",
  "High Risk": "bg-destructive/15 text-destructive border-destructive/40",
};

const VERDICT_STYLES: Record<string, { ring: string; text: string; icon: JSX.Element; gradient: string }> = {
  "Original Photo":     { ring: "ring-success/40",      text: "text-success",      icon: <ShieldCheck className="w-7 h-7" />, gradient: "from-success/30 to-success/5" },
  "Lightly Edited":     { ring: "ring-success/40",      text: "text-success",      icon: <ShieldCheck className="w-7 h-7" />, gradient: "from-success/20 to-warning/5" },
  "Edited":             { ring: "ring-warning/40",      text: "text-warning",      icon: <AlertTriangle className="w-7 h-7" />, gradient: "from-warning/25 to-warning/5" },
  "Heavily Manipulated":{ ring: "ring-destructive/40",  text: "text-destructive",  icon: <ShieldAlert className="w-7 h-7" />, gradient: "from-destructive/30 to-destructive/5" },
  "Deepfake Suspected": { ring: "ring-destructive/50",  text: "text-destructive",  icon: <ShieldAlert className="w-7 h-7" />, gradient: "from-destructive/35 to-destructive/5" },
  "AI Generated":       { ring: "ring-destructive/50",  text: "text-destructive",  icon: <Sparkles className="w-7 h-7" />,    gradient: "from-destructive/30 to-primary/10" },
};

const REGION_BORDER: Record<string, string> = {
  low: "border-warning/70",
  medium: "border-orange-400/80",
  high: "border-destructive/90",
};

const SEVERITY_CLS: Record<string, string> = {
  subtle: "bg-muted/40 border-border/50 text-foreground",
  moderate: "bg-warning/15 border-warning/40 text-warning",
  strong: "bg-destructive/15 border-destructive/40 text-destructive",
};

import { useAnalysis } from "@/contexts/AnalysisContext";

/* ── Component ─────────────────────────────── */
export const ImageVerification = () => {
  const { imageState, runImageAnalysis, clearAnalysis } = useAnalysis();
  const { user } = useAuth();
  const [localSelectedImage, setLocalSelectedImage] = useState<string | null>(null);
  const [exifData, setExifData] = useState<ExifInfo | null>(null);
  const [compression, setCompression] = useState<CompressionInfo | null>(null);
  const [forensics, setForensics] = useState<ForensicBundle | null>(null);
  // Clear the current image/results whenever leaving the Image Verification page
useEffect(() => {
  return () => {
    setLocalSelectedImage(null);
    setExifData(null);
    setCompression(null);
    setForensics(null);
    clearAnalysis("image");
  };
}, []);
  const [showRegions, setShowRegions] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const selectedImage = imageState.input || localSelectedImage;
  const isAnalyzing = imageState.isAnalyzing;
  const loaderProgress = imageState.progress;
  const result = imageState.result as ImageResult | null;

  const runAnalysis = useCallback(async (
    imageData: string,
    signals?: { exif?: ExifInfo; compression?: CompressionInfo; dimensions?: { width: number; height: number }; mime?: string },
    forensicBundle?: ForensicBundle | null,
  ) => {
    setLocalSelectedImage(imageData);
    runImageAnalysis(imageData, signals, forensicBundle);
  }, [runImageAnalysis]);

 const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  e.target.value = "";

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    toast.error("Please upload a PNG, JPG, or WEBP image");
    return;
  }

  const exifPromise = extractExif(file);

  const reader = new FileReader();

  reader.onload = async (ev) => {
    try {
      const dataUrl = typeof ev.target?.result === "string" ? ev.target.result : "";
      if (!dataUrl) {
        throw new Error("The selected image could not be read.");
      }

      setLocalSelectedImage(dataUrl);

    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();

      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };

      img.onerror = () => {
        resolve({
          width: 0,
          height: 0,
        });
      };

      img.src = dataUrl;
    });

    const comp = analyzeCompression(
      file,
      dims.width,
      dims.height
    );

    setCompression(comp);

    const exif = await exifPromise;
    setExifData(exif);

    const forensicBundle = await analyzeImageForensics(dataUrl);
    setForensics(forensicBundle);

      runAnalysis(
        dataUrl,
        {
          exif,
          compression: comp,
          dimensions: dims,
          mime: file.type,
        },
        forensicBundle
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The selected image could not be processed.";
      toast.error(message);
    }
  };

  reader.onerror = () => {
    toast.error("The selected image could not be read.");
  };

  reader.readAsDataURL(file);
}, [runAnalysis]);

  /* ── Share / PDF ───────────────────────────── */
  const buildScanForReport = (): Scan | null => {
    if (!result) return null;
    return {
      id: crypto.randomUUID(),
      user_id: user?.id ?? "anonymous",
      scan_type: "image",
      input_label: "Image scan",
      file_path: null,
      verdict: result.verdict || result.verdictTag || result.category,
      confidence: result.confidence,
      source_type: result.sourceType ?? null,
      details: {
        ...result,
        aiExplanation: result.plainExplanation || result.analysis,
        scores: result.detectionBreakdown,
      },
      effects: result.effects || [],
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
    const summary = `Verifact result: ${result.verdictTag || result.verdict} · ${result.primaryMetric?.label ?? "Confidence"} ${result.primaryMetric?.value ?? result.confidence}%`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Verifact scan", text: summary });
      } else {
        await navigator.clipboard.writeText(summary);
        toast.success("Summary copied to clipboard");
      }
    } catch { /* user cancelled */ }
  };

  const regions = result?.regions ?? [];
  const specialist = result?.specialistModelResult;
  const specialistVerdict = String(specialist?.verdict ?? "").trim().toUpperCase();
  const specialistIsFake = specialistVerdict === "FAKE" || specialistVerdict === "AI-GENERATED" || specialistVerdict === "AI_GENERATED";
  const specialistConfidence = Number.isFinite(Number(specialist?.confidence)) ? Number(specialist?.confidence) : 0;
  const specialistFakeProbability = specialist
    ? (Number.isFinite(Number(specialist.fake_probability))
      ? Number(specialist.fake_probability)
      : specialistIsFake ? specialistConfidence : 100 - specialistConfidence)
    : null;
  const verdictKey = result?.verdictTag || (result?.category === "authentic" ? "Original Photo" : result?.category === "suspicious" ? "Edited" : "Heavily Manipulated");
  const vstyle = VERDICT_STYLES[verdictKey] || VERDICT_STYLES["Edited"];
  const primary = result
    ? {
        label: specialist
          ? "AI Generated Probability"
          : result.primaryMetric?.label ?? (result.category === "authentic" ? "Authenticity Score" : "Manipulation Probability"),
        value: specialist
          ? specialistFakeProbability ?? 0
          : result.primaryMetric?.value ?? Number(result.confidence ?? 0),
      }
    : null;

  return (
    <div className="space-y-6">
      {/* ── Upload & Image Preview ────────────── */}
      <Card className="glass-panel p-6 animate-glass-fade">
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/50 transition-all cursor-pointer glass-panel animate-lift overflow-hidden"
          >
            {selectedImage ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img ref={imgRef} src={selectedImage} alt="Selected for analysis" className="max-h-96 mx-auto rounded-lg object-contain" />

                  {/* Region overlays */}
                  {showRegions && regions.length > 0 && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
                      {regions.map((r, i) => (
                        <g key={i}>
                          <motion.rect
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                            x={r.x} y={r.y} width={r.w} height={r.h}
                            fill={r.severity === "high" ? "rgba(239,68,68,0.18)" : r.severity === "medium" ? "rgba(249,115,22,0.14)" : "rgba(234,179,8,0.12)"}
                            stroke={r.severity === "high" ? "#ef4444" : r.severity === "medium" ? "#f97316" : "#eab308"}
                            strokeWidth="0.004" rx="0.006"
                          />
                          <text x={r.x + 0.005} y={r.y + r.h - 0.008} fill="white" fontSize="0.022" fontWeight="600"
                            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.85)" }}>
                            {r.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  )}

                  {/* Scan-line animation while analyzing */}
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
                  {regions.length > 0 && (
                    <Button variant="outline" size="sm" className="glass-panel text-xs" onClick={(e) => { e.stopPropagation(); setShowRegions(!showRegions); }}>
                      {showRegions ? <><EyeOff className="mr-1 h-3 w-3" />Hide regions</> : <><Eye className="mr-1 h-3 w-3" />Show regions</>}
                    </Button>
                  )}
                  <Button variant="outline" className="glass-panel" onClick={(e) => { e.stopPropagation(); clearAnalysis("image"); setLocalSelectedImage(null); setExifData(null); setCompression(null); setForensics(null); }}>
                    Remove
                  </Button>
                  <Button className="bg-gradient-primary" disabled={isAnalyzing} onClick={(e) => { e.stopPropagation(); if (selectedImage) runAnalysis(selectedImage, undefined, forensics); }}>
                    {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Re-scanning</> : <><Sparkles className="mr-2 h-4 w-4" />Re-scan</>}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-6">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Drop or click to upload</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — analysed instantly with premium AI forensics</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} className="hidden" />
          </div>
        </div>
      </Card>

      {imageState.error && !isAnalyzing && (
        <Card className="glass-panel p-4 border-destructive/40 text-destructive">
          {imageState.error}
        </Card>
      )}

      {/* ── Premium Loading State ──────────────── */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            key="loader"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          >
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
                <h3 className="text-lg font-bold tracking-tight">Forensic analysis in progress</h3>
                <p className="text-xs text-muted-foreground">Checking faces, lighting, metadata, and AI patterns…</p>
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
            {/* HERO: Classification + Confidence % + Trust level + Speed metrics */}
            <Card className={`glass-panel p-7 animate-glass-ripple ring-2 ${vstyle.ring} bg-gradient-to-br ${vstyle.gradient} relative overflow-hidden`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative">
                <div className="space-y-3 flex flex-col items-center text-center md:items-start md:text-left">
                  <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/60 backdrop-blur-md border ${vstyle.text}`}>
                      {vstyle.icon}
                      <span className="font-bold text-sm">{result.classification || verdictKey}</span>
                    </div>
                    {result.trustScore && (
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${TRUST_STYLES[result.trustScore.level]}`}>
                        {result.trustScore.level}
                      </span>
                    )}
                    {result.speedMetrics && (
                      <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/30">
                        <Zap className="h-3 w-3" />
                        {result.speedMetrics.isCached ? "⚡ Instant (Cached)" : `Processed in ${result.executionTimeMs || result.speedMetrics.totalMs}ms`}
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">{primary?.label}</p>
                    <div className="flex items-baseline justify-center md:justify-start gap-2">
                      <motion.span
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className={`text-6xl md:text-7xl font-extrabold tracking-tight tabular-nums ${vstyle.text}`}
                      >
                        {primary?.value ?? result.confidence ?? 0}
                      </motion.span>
                      <span className="text-2xl font-bold text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 md:items-end md:absolute md:right-0 md:top-0">
                  <Button onClick={handleDownloadReport} className="bg-gradient-primary">
                    <Download className="mr-2 h-4 w-4" /> Download report
                  </Button>
                  <Button variant="outline" onClick={handleShare} className="glass-panel">
                    <Share2 className="mr-2 h-4 w-4" /> Share
                  </Button>
                </div>
              </div>

              {/* Recommended Action Banner */}
              {result.recommendedAction && (
                <div className="mt-4 p-3 rounded-lg bg-background/50 border border-border/50 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground uppercase tracking-wider text-[10px] block">Recommended Action</span>
                    <span className="text-muted-foreground">{result.recommendedAction}</span>
                  </div>
                </div>
              )}

              {/* Plain explanation */}
              {(result.plainExplanation || result.analysis) && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                  className="mt-4 text-base leading-relaxed text-foreground/90 border-t border-border/40 pt-4 max-w-3xl"
                >
                  {result.plainExplanation || result.analysis}
                </motion.p>
              )}
            </Card>

            {/* FORENSIC EVIDENCE SUMMARY */}
            {result.evidence && result.evidence.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                <Card className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Forensic Evidence Summary</h3>
                  </div>
                  <ul className="space-y-2">
                    {result.evidence.map((ev: string, i: number) => (
                      <motion.li
                        key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.05 }}
                        className="flex items-start gap-2 text-sm text-foreground/85"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        <span>{ev}</span>
                      </motion.li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            )}

            {/* MULTI-MODEL ENSEMBLE BREAKDOWN */}
            {result.detectors && result.detectors.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
                <Card className="glass-panel p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold uppercase tracking-wider">Multi-Model Ensemble Breakdown</h3>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">Weighted Fusion v2.4</span>
                  </div>

                  {/* Disagreement alert if present */}
                  {result.modelDisagreement?.hasDisagreement && (
                    <div className="p-3 rounded-lg bg-warning/15 border border-warning/40 text-xs text-warning space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Model Disagreement Detected</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{result.modelDisagreement.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {result.detectors.map((det, i: number) => (
                      <div key={det.id || i} className="p-3 rounded-xl glass-panel border border-border/40 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold truncate">{det.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            det.verdict === "AI-Generated" || det.verdict === "Manipulated"
                              ? "bg-destructive/20 text-destructive"
                              : det.verdict === "Suspicious"
                              ? "bg-warning/20 text-warning"
                              : "bg-success/20 text-success"
                          }`}>
                            {det.verdict}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-extrabold tabular-nums">{det.score}%</span>
                          <span className="text-[10px] text-muted-foreground">Weight: {(det.weight * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{det.detail}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* DETECTION METHODS USED */}
            {result.detectionMethods && result.detectionMethods.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
                <Card className="glass-panel p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider">Detection Methods Active</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.detectionMethods.map((m: string, i: number) => (
                      <span key={i} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted/50 border border-border/50 text-foreground/80">
                        {m}
                      </span>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* LIMITATIONS IF CONFIDENCE IS LOW OR COMPRESSION HIGH */}
            {result.limitations && result.limitations.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <div className="p-3.5 rounded-xl glass-panel border border-border/50 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                    <Info className="h-3.5 w-3.5" />
                    <span>Analysis Limitations & Notes</span>
                  </div>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 text-[11px]">
                    {result.limitations.map((lim: string, i: number) => (
                      <li key={i}>{lim}</li>
                    ))}
                  </ul>
                </div>
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

            {/* DETECTION BREAKDOWN — circular progress style cards */}
            {result.detectionBreakdown && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card className="glass-panel p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4">Detection breakdown</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {([
                      ["Deepfake", result.detectionBreakdown.deepfake],
                      ["Beauty filter", result.detectionBreakdown.beautyFilter],
                      ["Face edit", result.detectionBreakdown.faceEdit],
                      ["Background swap", result.detectionBreakdown.backgroundReplacement],
                      ["Object removal", result.detectionBreakdown.objectRemoval],
                      ["Lighting mismatch", result.detectionBreakdown.lightingMismatch],
                      ["Metadata issues", result.detectionBreakdown.metadataIssues],
                      ["AI pattern", result.detectionBreakdown.aiPattern],
                    ] as const).map(([label, val], i) => (
                      <CircularStat key={label} label={label} value={val} delay={0.4 + i * 0.04} />
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* SUSPICIOUS REGIONS */}
            {regions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card className="glass-panel p-5">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Suspicious regions ({regions.length})</h3>
                    <Button size="sm" variant="ghost" onClick={() => setShowRegions(!showRegions)} className="text-xs h-7">
                      {showRegions ? "Hide overlay" : "Show overlay"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {regions.map((r, i) => (
                      <span key={i} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${REGION_BORDER[r.severity]} bg-background/50`}>
                        {r.label} <span className="ml-1 opacity-60 capitalize">· {r.severity}</span>
                      </span>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* DETECTED EFFECTS */}
            {result.effects && result.effects.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                <Card className="glass-panel p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">Detected edits & effects</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.effects.map((eff, i) => (
                      <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${SEVERITY_CLS[eff.severity || "subtle"]}`}>
                        <span className="font-medium">{eff.name}</span>
                        <span className="opacity-70">{eff.confidence}%</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* METADATA */}
            {(exifData || compression) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <Card className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Metadata</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {exifData?.make && <MetaItem label="Camera" value={`${exifData.make} ${exifData.model || ""}`} />}
                    {exifData?.software && <MetaItem label="Software" value={exifData.software} />}
                    {exifData?.dateTime && <MetaItem label="Date taken" value={exifData.dateTime} />}
                    {exifData?.iso && <MetaItem label="ISO" value={String(exifData.iso)} />}
                    {exifData?.focalLength && <MetaItem label="Focal length" value={`${exifData.focalLength}mm`} />}
                    {exifData?.gps !== undefined && <MetaItem label="GPS" value={exifData.gps ? "Present" : "None"} />}
                    {compression && <MetaItem label="File size" value={`${(compression.fileSize / 1024).toFixed(0)} KB`} />}
                    {compression && <MetaItem label="Resolution" value={`${compression.megapixels.toFixed(1)} MP`} />}
                  </div>
                  {compression?.anomaly && (
                    <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">{compression.reason}</p>
                    </div>
                  )}
                  {exifData && !exifData.make && !exifData.software && !exifData.dateTime && (
                    <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                      <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">No camera metadata found — common for screenshots and AI-generated images.</p>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Small components ──────────────────────── */
function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg glass-panel">
      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}

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
