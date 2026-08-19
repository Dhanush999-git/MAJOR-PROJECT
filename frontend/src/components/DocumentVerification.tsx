import { useState, useRef, useCallback, useEffect } from "react";
import { useScans, type Scan } from "@/hooks/useScans";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Upload, Loader2, ShieldCheck, ShieldAlert, AlertTriangle, Sparkles,
  FileText, Download, Share2, Eye, EyeOff, ScanLine, FileWarning,
} from "lucide-react";
import exifr from "exifr";
import { generateForensicReport } from "@/lib/forensicReport";
import type { DynamicRecord, SpeedMetrics } from "@/lib/analysisTypes";

interface Region { label: string; x: number; y: number; w: number; h: number; severity: "low" | "medium" | "high"; page?: number; }
interface MetadataFinding { field: string; value: string; risk: "low" | "medium" | "high"; note?: string; }
interface ExtractedField { label: string; value: string; }
interface DocResult {
  verdict: "Real" | "Suspicious" | "Fake";
  authenticityScore: number;
  confidence: number;
  documentType?: string;
  primaryMetric?: { label: string; value: number };
  verdictTag?: string;
  trustScore?: { level: "Low Risk" | "Medium Risk" | "High Risk"; score: number };
  plainExplanation?: string;
  whyItMatters?: string[];
  detectionBreakdown?: Record<string, number>;
  metadataFindings?: MetadataFinding[];
  extractedFields?: ExtractedField[];
  regions?: Region[];
  analysis?: string;
  speedMetrics?: SpeedMetrics;
  executionTimeMs?: number;
}

const ACCEPTED = ".pdf,.docx,.doc,.jpg,.jpeg,.png,.tif,.tiff";
const ACCEPT_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/jpeg", "image/png", "image/tiff",
];

const VERDICT_STYLES: Record<string, { ring: string; text: string; icon: JSX.Element; gradient: string }> = {
  Real:       { ring: "ring-success/40",     text: "text-success",     icon: <ShieldCheck className="w-7 h-7" />,  gradient: "from-success/30 to-success/5" },
  Suspicious: { ring: "ring-warning/40",     text: "text-warning",     icon: <AlertTriangle className="w-7 h-7" />, gradient: "from-warning/25 to-warning/5" },
  Fake:       { ring: "ring-destructive/50", text: "text-destructive", icon: <ShieldAlert className="w-7 h-7" />,  gradient: "from-destructive/30 to-destructive/5" },
};

const TRUST_STYLES: Record<string, string> = {
  "Low Risk":    "bg-success/15 text-success border-success/40",
  "Medium Risk": "bg-warning/15 text-warning border-warning/40",
  "High Risk":   "bg-destructive/15 text-destructive border-destructive/40",
};

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function extractPdfMeta(buf: ArrayBuffer): Promise<DynamicRecord> {
  try {
    const text = new TextDecoder("latin1").decode(new Uint8Array(buf).slice(0, 65536));
    const grab = (k: string) => {
      const m = text.match(new RegExp(`/${k}\\s*\\(([^)]+)\\)`));
      return m?.[1];
    };
    return {
      producer: grab("Producer"),
      creator: grab("Creator"),
      author: grab("Author"),
      title: grab("Title"),
      created: grab("CreationDate"),
      modified: grab("ModDate"),
      encrypted: /\/Encrypt\s/.test(text),
      signed: /\/Sig\s|\/ByteRange/.test(text),
    };
  } catch { return {}; }
}

import { useAnalysis } from "@/contexts/AnalysisContext";

export const DocumentVerification = () => {
  const { documentState, runDocumentAnalysis, clearAnalysis } = useAnalysis();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"image" | "pdf" | "other">("other");
  const [showRegions, setShowRegions] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { saveScan } = useScans();

  const isAnalyzing = documentState.isAnalyzing;
  const loaderProgress = documentState.progress;
  const result = documentState.result as DocResult | null;

  const runAnalysis = async (f: File) => {
    const buf = await f.arrayBuffer();
    const [dataUrl, sha256] = await Promise.all([readAsDataUrl(f), sha256Hex(buf)]);
    const pdfMeta = f.type === "application/pdf" ? await extractPdfMeta(buf) : undefined;
    const exif = f.type.startsWith("image/") ? await exifr.parse(f, true).catch(() => ({})) : undefined;
    const signals = {
      fileSize: f.size,
      sha256,
      pdfMeta,
      exif: exif ? {
        make: exif.Make, model: exif.Model, software: exif.Software,
        dateTime: exif.DateTimeOriginal?.toLocaleString?.() || exif.DateTimeOriginal,
      } : undefined,
    };
    runDocumentAnalysis(dataUrl, f.type, f.name, signals);
  };

  const acceptFile = useCallback(async (f: File) => {
    const okExt = /\.(pdf|docx?|jpe?g|png|tiff?)$/i.test(f.name);
    if (!ACCEPT_MIMES.includes(f.type) && !okExt) {
      toast.error("Unsupported file type. Use PDF, DOCX, JPG, PNG or TIFF.");
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setPreviewKind(f.type.startsWith("image/") ? "image" : f.type === "application/pdf" ? "pdf" : "other");
    runAnalysis(f);
  }, [user]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
  };

  const buildScanForReport = (): Scan | null => {
    if (!result || !file) return null;
    return {
      id: crypto.randomUUID(),
      user_id: user?.id ?? "anonymous",
      scan_type: "document",
      input_label: file.name,
      file_path: null,
      verdict: result.verdict,
      confidence: result.confidence ?? result.authenticityScore,
      source_type: result.documentType ?? null,
      details: {
        ...result,
        aiExplanation: result.plainExplanation || result.analysis,
        scores: result.detectionBreakdown,
      },
      effects: result.metadataFindings ?? [],
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
    const summary = `Verifact document check: ${result.verdictTag || result.verdict} · ${result.primaryMetric?.label ?? "Authenticity"} ${result.primaryMetric?.value ?? result.authenticityScore}%`;
    try {
      if (navigator.share) await navigator.share({ title: "Verifact document scan", text: summary });
      else { await navigator.clipboard.writeText(summary); toast.success("Summary copied"); }
    } catch { /* cancelled */ }
  };

  const regions = result?.regions ?? [];
  const vstyle = VERDICT_STYLES[result?.verdict ?? "Suspicious"];
  const primary = result?.primaryMetric ?? (result ? {
    label: result.verdict === "Real" ? "Authenticity Score" : "Forgery Probability",
    value: result.verdict === "Real" ? result.authenticityScore : 100 - result.authenticityScore,
  } : null);

  return (
    <div className="space-y-6">
      {/* Upload / Preview */}
      <Card className="glass-panel p-6 animate-glass-fade">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer glass-panel animate-lift overflow-hidden transition-all
            ${dragActive ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/50"}`}
        >
          {file && previewUrl ? (
            <div className="space-y-4">
              <div className="relative inline-block max-w-full">
                {previewKind === "image" && (
                  <img src={previewUrl} alt={file.name} className="max-h-[420px] mx-auto rounded-lg object-contain" />
                )}
                {previewKind === "pdf" && (
                  <iframe src={previewUrl} title={file.name} className="w-full max-w-3xl h-[420px] rounded-lg bg-background" />
                )}
                {previewKind === "other" && (
                  <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                    <FileText className="w-14 h-14" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs">Preview not available for this format</span>
                  </div>
                )}

                {showRegions && regions.length > 0 && previewKind === "image" && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
                    {regions.map((r, i) => (
                      <g key={i}>
                        <motion.rect
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                          x={r.x} y={r.y} width={r.w} height={r.h}
                          fill={r.severity === "high" ? "rgba(239,68,68,0.20)" : r.severity === "medium" ? "rgba(249,115,22,0.16)" : "rgba(234,179,8,0.14)"}
                          stroke={r.severity === "high" ? "#ef4444" : r.severity === "medium" ? "#f97316" : "#eab308"}
                          strokeWidth="0.005" rx="0.006"
                        />
                        <text x={r.x + 0.005} y={r.y + r.h - 0.008} fill="white" fontSize="0.022" fontWeight="600" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.85)" }}>
                          {r.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}

                {isAnalyzing && (
                  <motion.div
                    className="absolute inset-x-0 h-12 pointer-events-none rounded-lg"
                    style={{ background: "linear-gradient(180deg, transparent, hsl(var(--primary)/0.45), transparent)" }}
                    initial={{ top: "-10%" }} animate={{ top: ["-10%", "100%"] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </div>

              <div className="flex gap-2 justify-center flex-wrap">
                {regions.length > 0 && previewKind === "image" && (
                  <Button variant="outline" size="sm" className="glass-panel text-xs" onClick={(e) => { e.stopPropagation(); setShowRegions((v) => !v); }}>
                    {showRegions ? <><EyeOff className="mr-1 h-3 w-3" />Hide regions</> : <><Eye className="mr-1 h-3 w-3" />Show regions</>}
                  </Button>
                )}
                <Button variant="outline" className="glass-panel" onClick={(e) => { e.stopPropagation(); clearAnalysis("document"); setFile(null); setPreviewUrl(null); }}>
                  Remove
                </Button>
                <Button className="bg-gradient-primary" disabled={isAnalyzing} onClick={(e) => { e.stopPropagation(); if (file) runAnalysis(file); }}>
                  {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Re-verifying</> : <><Sparkles className="mr-2 h-4 w-4" />Re-verify</>}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-8">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Drag & drop or click to upload a document</p>
              <p className="text-xs text-muted-foreground">PDF, DOCX, JPG, PNG, TIFF — analysed with forensic AI</p>
            </div>
          )}
          <input
            ref={inputRef} type="file" accept={ACCEPTED} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
          />
        </div>
      </Card>

      {/* Loader */}
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
                <h3 className="text-lg font-bold tracking-tight">Verifying document</h3>
                <p className="text-xs text-muted-foreground">Reading text, layout, fonts, metadata & forgery signals…</p>
                <div className="max-w-md mx-auto">
                  <Progress value={loaderProgress} className="h-2" />
                  <p className="text-[11px] text-muted-foreground mt-2">{loaderProgress}%</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && !isAnalyzing && (
          <motion.div
            ref={resultsRef}
            key="results"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Hero */}
            <Card className={`glass-panel relative overflow-hidden ring-2 ${vstyle.ring}`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${vstyle.gradient} opacity-70 pointer-events-none`} />
              <div className="relative p-8 text-center space-y-4">
                <div className="absolute top-4 right-4 flex gap-2">
                  <Button variant="outline" size="sm" className="glass-panel" onClick={handleDownloadReport}>
                    <Download className="mr-1 h-3.5 w-3.5" />Report
                  </Button>
                  <Button variant="outline" size="sm" className="glass-panel" onClick={handleShare}>
                    <Share2 className="mr-1 h-3.5 w-3.5" />Share
                  </Button>
                </div>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel ${vstyle.text}`}>
                  {vstyle.icon}
                  <span className="text-sm font-bold tracking-wider uppercase">
                    {result.verdictTag || result.verdict} {result.documentType ? `· ${result.documentType}` : ""}
                  </span>
                </div>
                <div>
                  <div className={`text-6xl font-bold ${vstyle.text}`}>{primary?.value ?? 0}%</div>
                  <div className="text-sm text-muted-foreground mt-1">{primary?.label ?? "Score"}</div>
                </div>
                {result.trustScore && (
                  <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${TRUST_STYLES[result.trustScore.level]}`}>
                    {result.trustScore.level}
                  </span>
                )}
                {result.plainExplanation && (
                  <p className="text-sm text-muted-foreground max-w-2xl mx-auto pt-2 border-t border-border/40">{result.plainExplanation}</p>
                )}
              </div>
            </Card>

            {/* Tabs */}
            <Card className="glass-panel p-4">
              <Tabs defaultValue="breakdown">
                <TabsList className="glass-panel">
                  <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                  <TabsTrigger value="fields">Extracted</TabsTrigger>
                  <TabsTrigger value="why">Why it matters</TabsTrigger>
                  <TabsTrigger value="analysis">Forensic summary</TabsTrigger>
                </TabsList>

                <TabsContent value="breakdown" className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(result.detectionBreakdown ?? {}).map(([k, v]) => {
                      const label = k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
                      const val = Math.max(0, Math.min(100, Number(v) || 0));
                      const color = val >= 70 ? "bg-destructive" : val >= 40 ? "bg-warning" : "bg-success";
                      return (
                        <div key={k} className="glass-panel rounded-lg p-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{label}</span>
                            <span className="text-muted-foreground">{val}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full ${color}`} style={{ width: `${val}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {!result.detectionBreakdown && <p className="text-sm text-muted-foreground">No breakdown returned.</p>}
                  </div>
                </TabsContent>

                <TabsContent value="metadata" className="pt-4">
                  <div className="space-y-2">
                    {(result.metadataFindings ?? []).map((m, i) => (
                      <div key={i} className="glass-panel rounded-lg p-3 flex items-start gap-3">
                        <FileWarning className={`w-4 h-4 mt-0.5 ${m.risk === "high" ? "text-destructive" : m.risk === "medium" ? "text-warning" : "text-success"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold">{m.field}</div>
                          <div className="text-sm break-words">{m.value || "—"}</div>
                          {m.note && <div className="text-xs text-muted-foreground mt-1">{m.note}</div>}
                        </div>
                      </div>
                    ))}
                    {!result.metadataFindings?.length && <p className="text-sm text-muted-foreground">No metadata findings.</p>}
                  </div>
                </TabsContent>

                <TabsContent value="fields" className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(result.extractedFields ?? []).map((f, i) => (
                      <div key={i} className="glass-panel rounded-lg p-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{f.label}</div>
                        <div className="text-sm font-medium break-words">{f.value || "—"}</div>
                      </div>
                    ))}
                    {!result.extractedFields?.length && <p className="text-sm text-muted-foreground">No fields extracted.</p>}
                  </div>
                </TabsContent>

                <TabsContent value="why" className="pt-4">
                  <ul className="space-y-2">
                    {(result.whyItMatters ?? []).map((w, i) => (
                      <li key={i} className="glass-panel rounded-lg p-3 text-sm">• {w}</li>
                    ))}
                    {!result.whyItMatters?.length && <p className="text-sm text-muted-foreground">No impact notes.</p>}
                  </ul>
                </TabsContent>

                <TabsContent value="analysis" className="pt-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.analysis || "—"}</p>
                </TabsContent>
              </Tabs>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
