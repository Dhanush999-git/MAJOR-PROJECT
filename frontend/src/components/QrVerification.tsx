import { useState, useRef, useCallback } from "react";
import { useScans, type Scan } from "@/hooks/useScans";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  QrCode, Upload, Loader2, ShieldCheck, AlertTriangle, ShieldAlert, Sparkles,
  Download, Share2, ScanLine, Zap, CheckCircle2, AlertCircle, Copy, ExternalLink,
  Shield, Globe, DollarSign, Wifi, Lock, Cpu, Eye, Layers, FileCode
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { type QrForensicReport } from "@/lib/qrForensics";
import { generateForensicReport } from "@/lib/forensicReport";

const RISK_STYLES: Record<string, { ring: string; text: string; bg: string; icon: JSX.Element; gradient: string }> = {
  "Safe":          { ring: "ring-success/40",      text: "text-success",      bg: "bg-success/15 border-success/40",      icon: <ShieldCheck className="w-7 h-7" />, gradient: "from-success/30 to-success/5" },
  "Low Risk":      { ring: "ring-success/40",      text: "text-success",      bg: "bg-success/15 border-success/40",      icon: <ShieldCheck className="w-7 h-7" />, gradient: "from-success/20 to-warning/5" },
  "Medium Risk":   { ring: "ring-warning/40",      text: "text-warning",      bg: "bg-warning/15 border-warning/40",      icon: <AlertTriangle className="w-7 h-7" />, gradient: "from-warning/25 to-warning/5" },
  "High Risk":     { ring: "ring-destructive/40",  text: "text-destructive",  bg: "bg-destructive/15 border-destructive/40",  icon: <ShieldAlert className="w-7 h-7" />, gradient: "from-destructive/30 to-destructive/5" },
  "Critical Risk": { ring: "ring-destructive/60",  text: "text-destructive",  bg: "bg-destructive/20 border-destructive/60",  icon: <ShieldAlert className="w-7 h-7" />, gradient: "from-destructive/40 to-primary/10" },
};

const SAMPLE_QRS = [
  {
    label: "Valid HTTPS Site",
    type: "Safe URL",
    content: "https://verifact.ai/official-verification-portal",
  },
  {
    label: "Phishing Brand Impersonation",
    type: "Phishing Scam",
    content: "http://paypa1-security-login.top/account/verify-credentials",
  },
  {
    label: "UPI Refund Fraud Trap",
    type: "Fake Payment",
    content: "upi://pay?pa=scam-collector@ybl&pn=CustomerSupport&am=2500&tn=Cashback%20Refund%20Reward",
  },
  {
    label: "Shortened Malware APK Link",
    type: "Malware Download",
    content: "https://bit.ly/3xMalwareUpdateApp.apk",
  },
];

export const QrVerification = () => {
  const { qrState, runQrAnalysis, clearAnalysis } = useAnalysis();
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [manualPayload, setManualPayload] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAnalyzing = qrState.isAnalyzing;
  const loaderProgress = qrState.progress;
  const result = qrState.result as QrForensicReport | null;

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a QR code image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setSelectedImage(dataUrl);
      runQrAnalysis(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCopyPayload = () => {
    if (!result?.decodedPayload) return;
    navigator.clipboard.writeText(result.decodedPayload);
    toast.success("Decoded payload copied to clipboard");
  };

  const handleDownloadReport = () => {
    if (!result) return;
    const scan: Scan = {
      id: crypto.randomUUID(),
      user_id: user?.id ?? "anonymous",
      scan_type: "qr",
      input_label: `QR Scan (${result.payloadType})`,
      file_path: null,
      verdict: result.verdict,
      confidence: result.securityScore,
      source_type: null,
      details: {
        ...result,
        aiExplanation: result.plainExplanation,
      },
      effects: [],
      created_at: new Date().toISOString(),
    };

    generateForensicReport(scan);
    toast.success("QR forensic report downloaded");
  };

  const rstyle = RISK_STYLES[result?.riskLevel || "Medium Risk"] || RISK_STYLES["Medium Risk"];

  return (
    <div className="space-y-6">
      {/* ── Upload & Scan Dropzone ──────────────── */}
      <Card className="glass-panel p-6 animate-glass-fade">
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/50 transition-all cursor-pointer glass-panel animate-lift overflow-hidden"
          >
            {selectedImage ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img src={selectedImage} alt="Uploaded QR Code" className="max-h-64 mx-auto rounded-lg object-contain bg-white/80 p-3 shadow-md" />
                  {isAnalyzing && (
                    <motion.div
                      className="absolute inset-x-0 h-10 pointer-events-none rounded-lg"
                      style={{ background: "linear-gradient(180deg, transparent, hsl(var(--primary)/0.5), transparent)" }}
                      initial={{ top: "0%" }}
                      animate={{ top: ["0%", "100%"] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </div>

                <div className="flex gap-2 justify-center flex-wrap">
                  <Button variant="outline" className="glass-panel" onClick={(e) => { e.stopPropagation(); clearAnalysis("qr"); setSelectedImage(null); setManualPayload(""); }}>
                    Remove
                  </Button>
                  <Button className="bg-gradient-primary" disabled={isAnalyzing} onClick={(e) => { e.stopPropagation(); if (selectedImage) runQrAnalysis(selectedImage); }}>
                    {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scanning...</> : <><QrCode className="mr-2 h-4 w-4" />Re-analyze</>}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-6">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg">
                  <QrCode className="h-9 w-9 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Drop QR image or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP — Instant physical overlay inspection & AI scam threat scan</p>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </div>

          {/* Quick Test Samples */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Test Sample Scenarios:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SAMPLE_QRS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    setManualPayload(s.content);
                    setSelectedImage(null);
                    runQrAnalysis(s.content, s.content);
                  }}
                  className="p-2.5 rounded-lg glass-panel border border-border/40 hover:border-primary/50 text-left transition-all text-xs flex flex-col justify-between"
                >
                  <span className="font-semibold truncate text-foreground">{s.label}</span>
                  <span className="text-[10px] text-primary font-mono mt-1">{s.type}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Progressive Loading Indicator ──────── */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="glass-panel p-8 text-center space-y-4 relative overflow-hidden">
              <motion.div
                className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-2xl mx-auto"
                animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <ScanLine className="h-7 w-7 text-primary-foreground" />
              </motion.div>
              <h3 className="text-lg font-bold tracking-tight">QR Security & Scam Threat Scan</h3>
              <p className="text-xs text-muted-foreground">{qrState.statusText || "De-obfuscating payload & checking domain reputation..."}</p>
              <div className="max-w-md mx-auto">
                <Progress value={loaderProgress} className="h-2" />
                <p className="text-[11px] text-muted-foreground mt-2">{loaderProgress}%</p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results Dashboard ──────────────────── */}
      <AnimatePresence>
        {result && !isAnalyzing && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
            {/* HERO: Security Score + Verdict + Action */}
            <Card className={`glass-panel p-7 animate-glass-ripple ring-2 ${rstyle.ring} bg-gradient-to-br ${rstyle.gradient} relative overflow-hidden`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative">
                <div className="space-y-3 flex flex-col items-center text-center md:items-start md:text-left">
                  <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/60 backdrop-blur-md border ${rstyle.text}`}>
                      {rstyle.icon}
                      <span className="font-bold text-sm">{result.verdict}</span>
                    </div>

                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${rstyle.bg}`}>
                      {result.riskLevel}
                    </span>

                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/30">
                      Type: {result.payloadType}
                    </span>

                    {result.speedMetrics && (
                      <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/30">
                        <Zap className="h-3 w-3" />
                        {result.speedMetrics.isCached ? "⚡ Instant (Cached)" : `Processed in ${result.executionTimeMs || result.speedMetrics.totalMs}ms`}
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">QR Security Score</p>
                    <div className="flex items-baseline justify-center md:justify-start gap-2">
                      <motion.span
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className={`text-6xl md:text-7xl font-extrabold tracking-tight tabular-nums ${rstyle.text}`}
                      >
                        {result.securityScore}
                      </motion.span>
                      <span className="text-2xl font-bold text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:items-end md:absolute md:right-0 md:top-0">
                  <Button onClick={handleDownloadReport} className="bg-gradient-primary">
                    <Download className="mr-2 h-4 w-4" /> Download report
                  </Button>
                </div>
              </div>

              {/* Recommended Action Banner */}
              <div className="mt-5 p-4 rounded-xl bg-background/60 backdrop-blur-md border border-border/50 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-foreground text-xs uppercase tracking-wider block">Recommended Action</span>
                  <span className="text-sm font-semibold text-primary">{result.recommendedAction}</span>
                </div>
              </div>

              {/* Plain English AI Explanation */}
              <p className="mt-4 text-base leading-relaxed text-foreground/90 border-t border-border/40 pt-4 max-w-3xl">
                {result.plainExplanation}
              </p>
            </Card>

            {/* DECODED PAYLOAD & TYPE CARD */}
            <Card className="glass-panel p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider">Decoded Content Payload</h3>
                </div>
                <div className="flex items-center gap-2">
                  {result.wasObfuscated && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-warning/20 text-warning border border-warning/30">
                      Obfuscation Detected ({result.obfuscationType})
                    </span>
                  )}
                  <Button size="sm" variant="outline" onClick={handleCopyPayload} className="h-7 text-xs">
                    <Copy className="h-3 w-3 mr-1" /> Copy Payload
                  </Button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 font-mono text-xs text-foreground break-all border border-border/40">
                {result.decodedPayload}
              </div>
            </Card>

            {/* DOMAIN & REDIRECT INTELLIGENCE */}
            {result.domainInfo && (
              <Card className="glass-panel p-5 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider">Domain & Redirect Analysis</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg glass-panel">
                    <p className="text-muted-foreground text-[10px] uppercase">Destination Domain</p>
                    <p className="font-bold truncate">{result.domainInfo.domain}</p>
                  </div>
                  <div className="p-3 rounded-lg glass-panel">
                    <p className="text-muted-foreground text-[10px] uppercase">SSL Security</p>
                    <p className={`font-bold ${result.domainInfo.isHttps ? "text-success" : "text-destructive"}`}>
                      {result.domainInfo.isHttps ? "HTTPS Encrypted" : "Insecure HTTP"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg glass-panel">
                    <p className="text-muted-foreground text-[10px] uppercase">URL Shortener</p>
                    <p className="font-bold">{result.domainInfo.isShortened ? "Shortened URL" : "Direct Link"}</p>
                  </div>
                  <div className="p-3 rounded-lg glass-panel">
                    <p className="text-muted-foreground text-[10px] uppercase">TLD Risk</p>
                    <p className={`font-bold ${result.domainInfo.suspiciousTld ? "text-warning" : "text-success"}`}>
                      .{result.domainInfo.tld} {result.domainInfo.suspiciousTld ? "(High Risk)" : "(Standard)"}
                    </p>
                  </div>
                </div>

                {result.domainInfo.isTyposquatting && (
                  <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/40 text-xs text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Brand Impersonation Warning: Domain mimics legitimate brand ({result.domainInfo.impersonatedBrand}).</span>
                  </div>
                )}
              </Card>
            )}

            {/* UPI PAYMENT FRAUD CARD */}
            {result.paymentInfo && (
              <Card className="glass-panel p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-warning" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">UPI Payment Details</h3>
                  </div>
                  {result.paymentInfo.isPayTrap && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-destructive text-destructive-foreground animate-pulse">
                      PAYMENT SCAM TRAP DETECTED
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg glass-panel">
                    <p className="text-muted-foreground text-[10px] uppercase">Payee VPA</p>
                    <p className="font-bold truncate">{result.paymentInfo.vpa || "Unknown"}</p>
                  </div>
                  <div className="p-3 rounded-lg glass-panel">
                    <p className="text-muted-foreground text-[10px] uppercase">Payee Name</p>
                    <p className="font-bold truncate">{result.paymentInfo.payeeName || "Not specified"}</p>
                  </div>
                  <div className="p-3 rounded-lg glass-panel">
                    <p className="text-muted-foreground text-[10px] uppercase">Amount</p>
                    <p className="font-bold">{result.paymentInfo.amount ? `₹${result.paymentInfo.amount}` : "User specified"}</p>
                  </div>
                  <div className="p-3 rounded-lg glass-panel">
                    <p className="text-muted-foreground text-[10px] uppercase">Transaction Note</p>
                    <p className="font-bold truncate">{result.paymentInfo.transactionNote || "None"}</p>
                  </div>
                </div>

                {result.paymentInfo.isPayTrap && (
                  <div className="p-3 rounded-lg bg-destructive/20 border border-destructive/60 text-xs text-destructive space-y-1">
                    <p className="font-bold uppercase tracking-wider">⚠️ CRITICAL UPI REFUND TRAP</p>
                    <p className="leading-relaxed">{result.paymentInfo.payTrapWarning}</p>
                  </div>
                )}
              </Card>
            )}

            {/* PHYSICAL STICKER OVERLAY CARD */}
            <Card className="glass-panel p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider">Physical Overlay & Sticker Replacement Check</h3>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                  result.physicalTampering.isStickerOverlay
                    ? "bg-destructive/20 text-destructive border border-destructive/40"
                    : "bg-success/20 text-success border border-success/40"
                }`}>
                  {result.physicalTampering.isStickerOverlay ? "Physical Sticker Detected" : "Original Matrix Pattern"}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg glass-panel">
                  <p className="text-muted-foreground text-[10px] uppercase">Overlay Confidence</p>
                  <p className="font-bold tabular-nums">{result.physicalTampering.overlayConfidence}%</p>
                </div>
                <div className="p-3 rounded-lg glass-panel">
                  <p className="text-muted-foreground text-[10px] uppercase">Alignment Score</p>
                  <p className="font-bold tabular-nums">{result.physicalTampering.alignmentConsistency}%</p>
                </div>
                <div className="p-3 rounded-lg glass-panel">
                  <p className="text-muted-foreground text-[10px] uppercase">Border Noise Variance</p>
                  <p className="font-bold tabular-nums">{result.physicalTampering.boundaryNoiseStd}</p>
                </div>
              </div>
            </Card>

            {/* THREAT WARNINGS LIST */}
            {result.threatList && result.threatList.length > 0 && (
              <Card className="glass-panel p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider">Identified Security Threat Warnings ({result.threatList.length})</h3>
                </div>

                <ul className="space-y-2">
                  {result.threatList.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground/90 p-2.5 rounded-lg bg-muted/20 border border-border/40">
                      <span className="h-2 w-2 rounded-full bg-warning shrink-0 mt-1" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
