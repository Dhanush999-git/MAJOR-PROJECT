import { useState } from "react";
import { useScans } from "@/hooks/useScans";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle, ShieldAlert, Globe, Lock, Clock, Bug } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { AnalysisProgress } from "./AnalysisProgress";
import { motion, AnimatePresence } from "framer-motion";

interface RiskFlag { flag: string; severity: "low" | "medium" | "high" | "critical" }
interface UrlResult {
  isCredible: boolean;
  confidence: number;
  category: "credible" | "questionable" | "misinformation";
  analysis: string;
  credibilityScores?: { sourceCredibility: number; factVerification: number; domainReputation: number; citationQuality: number };
  securityScores?: { phishingRisk: number; malwareSuspicion: number; sslTrust: number; domainAgeTrust: number };
  domainInfo?: { age: string; registrar: string; sslValid: boolean | null; sslIssuer: string };
  safeBrowsingThreats?: string[];
  riskFlags?: RiskFlag[];
  speedMetrics?: any;
  executionTimeMs?: number;
}

const FLAG_CLS: Record<string, string> = {
  low: "bg-muted/40 border-border/50 text-foreground",
  medium: "bg-warning/15 border-warning/40 text-warning",
  high: "bg-destructive/15 border-destructive/40 text-destructive",
  critical: "bg-destructive/25 border-destructive/60 text-destructive font-bold",
};

import { useAnalysis } from "@/contexts/AnalysisContext";

export const UrlVerification = () => {
  const { urlState, runUrlAnalysis } = useAnalysis();
  const [url, setUrl] = useState(urlState.input || "");
  const { user } = useAuth();
  const { saveScan } = useScans();

  const isAnalyzing = urlState.isAnalyzing;
  const result = urlState.result as UrlResult | null;

  const analyzeUrl = () => {
    if (!url.trim()) { toast.error("Please enter a URL to analyze"); return; }
    try { new URL(url); } catch { toast.error("Please enter a valid URL"); return; }
    runUrlAnalysis(url);
  };

  const icon = (cat: string) => cat === "credible" ? <ShieldCheck className="w-6 h-6 text-success" /> : cat === "questionable" ? <AlertTriangle className="w-6 h-6 text-warning" /> : <ShieldAlert className="w-6 h-6 text-destructive" />;
  const catCls = (cat: string) => cat === "credible" ? "bg-success/10" : cat === "questionable" ? "bg-warning/10" : "bg-destructive/10";

  // Derive top-line verdict tag for URLs
  const deriveTag = (r: UrlResult): { tag: string; metricLabel: string; metricValue: number; cls: string } => {
    const phishing = r.securityScores?.phishingRisk ?? 0;
    const malware = r.securityScores?.malwareSuspicion ?? 0;
    const credibility = r.credibilityScores?.sourceCredibility ?? r.confidence;
    if (r.safeBrowsingThreats && r.safeBrowsingThreats.length > 0)
      return { tag: "DANGEROUS / MALICIOUS", metricLabel: "Threat Level", metricValue: Math.max(phishing, malware, 90), cls: "bg-destructive/15 border-destructive/50 text-destructive" };
    if (phishing >= 65 || malware >= 65)
      return { tag: "PHISHING / SCAM", metricLabel: "Phishing Risk", metricValue: Math.max(phishing, malware), cls: "bg-destructive/15 border-destructive/50 text-destructive" };
    if (r.category === "misinformation")
      return { tag: "FAKE NEWS / MISINFORMATION", metricLabel: "Misinformation Probability", metricValue: r.confidence, cls: "bg-destructive/15 border-destructive/50 text-destructive" };
    if (r.category === "questionable")
      return { tag: "SUSPICIOUS SOURCE", metricLabel: "Risk Score", metricValue: r.confidence, cls: "bg-warning/15 border-warning/50 text-warning" };
    return { tag: "REAL / CREDIBLE", metricLabel: "Credibility Score", metricValue: credibility, cls: "bg-success/15 border-success/50 text-success" };
  };

  return (
    <div className="space-y-6">
      <Card className="glass-panel p-6 animate-glass-fade">
        <div className="space-y-4">
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input type="url" placeholder="https://example.com/article" value={url} onChange={(e) => setUrl(e.target.value)} className="pl-10 glass-panel" />
          </div>
          <Button onClick={analyzeUrl} disabled={isAnalyzing} className="w-full bg-gradient-primary animate-lift" size="lg">
            {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</> : "Verify URL"}
          </Button>
        </div>
      </Card>

      {isAnalyzing && (
        <Card className="glass-panel p-6 animate-glass-ripple space-y-4">
          <div className="text-center space-y-2">
            <div className="text-xl font-semibold">{urlState.statusText || "Analyzing URL..."}</div>
            <p className="text-sm text-muted-foreground">Checking domain WHOIS, SSL & Safe Browsing database</p>
          </div>
          <Progress value={urlState.progress} className="h-3 glass-panel" />
          <div className="text-center text-xs font-medium">{urlState.progress}%</div>
        </Card>
      )}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Hero verdict tag */}
            {(() => {
              const t = deriveTag(result);
              return (
                <Card className={`glass-panel p-6 border-2 ${t.cls} animate-glass-ripple`}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest opacity-70 mb-1 font-semibold">URL Fact-Check Verdict</p>
                      <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">{t.tag}</h2>
                      <p className="text-xs opacity-70 mt-1">{t.metricLabel}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl md:text-5xl font-extrabold tabular-nums">{Math.round(t.metricValue)}%</div>
                    </div>
                  </div>
                </Card>
              );
            })()}

            {/* Verdict */}
            <Card className="glass-panel p-6 animate-glass-ripple">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full glass-glow ${catCls(result.category)}`}>{icon(result.category)}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold capitalize">{result.category}</h3>
                    <p className="text-sm text-muted-foreground">Confidence: {result.confidence}%</p>
                  </div>
                  <Progress value={result.confidence} className="h-3 w-1/3 glass-panel" />
                </div>
                <p className="text-sm text-muted-foreground border-t border-border/50 pt-4">{result.analysis}</p>

                {!result.isCredible && (
                  <div className="p-4 glass-panel rounded-lg border-2 border-destructive glass-glow">
                    <p className="text-destructive font-bold text-lg">⚠ MISINFORMATION SOURCE</p>
                    <p className="text-sm text-muted-foreground mt-1">This website shows multiple credibility issues</p>
                  </div>
                )}

                {/* Safe Browsing threats */}
                {result.safeBrowsingThreats && result.safeBrowsingThreats.length > 0 && (
                  <div className="p-4 glass-panel rounded-lg border-2 border-destructive/80 bg-destructive/10">
                    <div className="flex items-center gap-2 mb-1">
                      <Bug className="h-4 w-4 text-destructive" />
                      <p className="text-sm font-bold text-destructive">Google Safe Browsing Alert</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Threats detected: {result.safeBrowsingThreats.join(", ")}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Domain info */}
            {result.domainInfo && (
              <Card className="glass-panel p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Domain Intelligence</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <DomainItem icon={<Clock className="h-3 w-3" />} label="Domain Age" value={result.domainInfo.age} />
                  <DomainItem icon={<Globe className="h-3 w-3" />} label="Registrar" value={result.domainInfo.registrar} />
                  <DomainItem icon={<Lock className="h-3 w-3" />} label="SSL Valid" value={result.domainInfo.sslValid === true ? "✅ Yes" : result.domainInfo.sslValid === false ? "❌ No" : "Unknown"} />
                  <DomainItem icon={<Lock className="h-3 w-3" />} label="SSL Issuer" value={result.domainInfo.sslIssuer} />
                </div>
              </Card>
            )}

            {/* Credibility scores */}
            {result.credibilityScores && (
              <Card className="glass-panel p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Credibility Scores</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["Source Credibility", result.credibilityScores.sourceCredibility],
                    ["Fact Verification", result.credibilityScores.factVerification],
                    ["Domain Reputation", result.credibilityScores.domainReputation],
                    ["Citation Quality", result.credibilityScores.citationQuality],
                  ] as const).map(([label, val]) => (
                    <div key={label} className="p-3 glass-panel rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">{label}</p>
                      <Progress value={val} className="h-2" />
                      <p className="text-xs font-medium mt-1">{val}%</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Security scores */}
            {result.securityScores && (
              <Card className="glass-panel p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Security Scores</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["Phishing Risk", result.securityScores.phishingRisk],
                    ["Malware Suspicion", result.securityScores.malwareSuspicion],
                    ["SSL Trust", result.securityScores.sslTrust],
                    ["Domain Age Trust", result.securityScores.domainAgeTrust],
                  ] as const).map(([label, val]) => (
                    <div key={label} className="p-3 glass-panel rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">{label}</p>
                      <Progress value={val} className="h-2" />
                      <p className="text-xs font-medium mt-1">{val}%</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Risk flags */}
            {result.riskFlags && result.riskFlags.length > 0 && (
              <Card className="glass-panel p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Risk Flags</p>
                <div className="flex flex-wrap gap-2">
                  {result.riskFlags.map((rf, i) => (
                    <span key={i} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${FLAG_CLS[rf.severity]}`}>
                      {rf.flag} <span className="opacity-60 capitalize ml-1">{rf.severity}</span>
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function DomainItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg glass-panel">
      <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1">{icon}{label}</div>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}