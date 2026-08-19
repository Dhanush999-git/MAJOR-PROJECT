import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle, ShieldAlert, Brain, MessageCircleWarning, History, FileSearch, GitCompare, BadgeCheck, XCircle, HelpCircle, Newspaper, Landmark, Clock, Sparkles, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { AnalysisProgress } from "./AnalysisProgress";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface PropagandaTechnique { name: string; confidence: number; example: string }
interface ManipulationTactic { tactic: string; severity: "low" | "medium" | "high" }
interface FactCheck { claim: string; status: "supported" | "unverified" | "contradicted"; note?: string }
interface EventSummary { what?: string; when?: string; where?: string; who?: string; why?: string; latest?: string; context?: string }
interface Correction { needed?: boolean; inaccurateParts?: string[]; reasons?: string[]; correctedClaim?: string; whatActuallyHappened?: string }
interface TrustedSource { name: string; type?: string; note?: string }
interface LiveSource { title: string; url: string; source: string; group: string }
interface EvidenceItem { title: string; url: string; source?: string; stance?: "supports" | "refutes" | "context"; note?: string }
interface SourceCoverage { corroboratingOutlets?: number; contradictingOutlets?: number; socialOnly?: boolean; summary?: string }
type VerifiedVerdict = "Verified" | "False Information" | "Misleading" | "Partially True" | "Insufficient Evidence";
interface TextResult {
  isAuthentic: boolean;
  confidence: number;
  category: "authentic" | "suspicious" | "fake";
  verdict?: "Real" | "Misleading" | "Fake";
  verifiedVerdict?: VerifiedVerdict;
  probabilities?: { real: number; misleading: number; fake: number };
  analysis: string;
  indicators?: string[];
  scores?: {
    fakeNewsProbability: number; propagandaLevel: number; biasScore: number;
    sentimentManipulation: number; sourceCredibility: number; aiGeneratedProbability: number;
  };
  biasDirection?: string;
  propagandaTechniques?: PropagandaTechnique[];
  manipulationTactics?: ManipulationTactic[];
  factChecks?: FactCheck[];
  historicalContext?: string;
  inconsistencies?: string[];
  layerSignals?: { semantic: number; factCheck: number; historical: number; consistency: number; propaganda: number; sourceCredibility: number };
  aiExplanation?: string;
  eventSummary?: EventSummary;
  correction?: Correction;
  trustedSources?: TrustedSource[];
  liveSources?: LiveSource[];
  liveSearchUsed?: boolean;
  evidenceUsed?: EvidenceItem[];
  sourceCoverage?: SourceCoverage;
  verifiedAt?: string;
}

const STANCE_CLS: Record<string, string> = {
  supports: "text-success border-success/40 bg-success/10",
  refutes: "text-destructive border-destructive/40 bg-destructive/10",
  context: "text-muted-foreground border-border/50 bg-muted/20",
};

const SEVERITY_CLS: Record<string, string> = {
  low: "bg-muted/40 border-border/50 text-foreground",
  medium: "bg-warning/15 border-warning/40 text-warning",
  high: "bg-destructive/15 border-destructive/40 text-destructive",
};

const BIAS_COLORS: Record<string, string> = {
  left: "text-blue-500", "center-left": "text-sky-500", center: "text-success",
  "center-right": "text-orange-400", right: "text-red-500", unknown: "text-muted-foreground",
};

import { useAnalysis } from "@/contexts/AnalysisContext";

export const TextVerification = () => {
  const { textState, runTextAnalysis } = useAnalysis();
  const [text, setText] = useState(textState.input || "");

  const isAnalyzing = textState.isAnalyzing;
  const result = textState.result;

  const analyzeText = () => {
    if (!text.trim()) { toast.error("Please enter some text to analyze"); return; }
    runTextAnalysis(text);
  };

  const icon = (cat: string) => cat === "authentic" ? <ShieldCheck className="w-6 h-6 text-success" /> : cat === "suspicious" ? <AlertTriangle className="w-6 h-6 text-warning" /> : <ShieldAlert className="w-6 h-6 text-destructive" />;
  const catCls = (cat: string) => cat === "authentic" ? "bg-success/10" : cat === "suspicious" ? "bg-warning/10" : "bg-destructive/10";

  const VV_STYLE: Record<VerifiedVerdict, { cls: string; icon: JSX.Element; label: string }> = {
    "Verified":              { cls: "bg-success/15 border-success/50 text-success",           icon: <BadgeCheck className="w-6 h-6" />,   label: "VERIFIED" },
    "False Information":     { cls: "bg-destructive/15 border-destructive/50 text-destructive", icon: <XCircle className="w-6 h-6" />,    label: "FALSE INFORMATION" },
    "Misleading":            { cls: "bg-warning/15 border-warning/50 text-warning",           icon: <AlertTriangle className="w-6 h-6" />, label: "MISLEADING" },
    "Partially True":        { cls: "bg-warning/15 border-warning/50 text-warning",           icon: <AlertTriangle className="w-6 h-6" />, label: "PARTIALLY TRUE" },
    "Insufficient Evidence": { cls: "bg-muted/40 border-border/50 text-foreground",           icon: <HelpCircle className="w-6 h-6" />,   label: "INSUFFICIENT EVIDENCE" },
  };

  // Derive a clear top-line verdict tag: Real / AI-Generated / Fake News / Manipulated / Suspicious
  const deriveTag = (r: TextResult): { tag: string; metricLabel: string; metricValue: number; cls: string } => {
    // If the backend ensemble produced explicit Real/Misleading/Fake probabilities, trust them.
    if (r.probabilities && r.verdict) {
      const p = r.probabilities;
      if (r.verdict === "Real")
        return { tag: "REAL NEWS", metricLabel: "Real Probability", metricValue: p.real, cls: "bg-success/15 border-success/50 text-success" };
      if (r.verdict === "Misleading")
        return { tag: "MISLEADING", metricLabel: "Misleading Probability", metricValue: p.misleading, cls: "bg-warning/15 border-warning/50 text-warning" };
      return { tag: "FAKE NEWS", metricLabel: "Fake Probability", metricValue: p.fake, cls: "bg-destructive/15 border-destructive/50 text-destructive" };
    }
    const s = r.scores;
    const ai = s?.aiGeneratedProbability ?? 0;
    const fake = s?.fakeNewsProbability ?? 0;
    const prop = s?.propagandaLevel ?? 0;
    const manip = Math.max(prop, s?.sentimentManipulation ?? 0);
    if (r.category === "authentic" && ai < 60 && fake < 40)
      return { tag: "REAL CONTENT", metricLabel: "Authenticity Score", metricValue: r.confidence, cls: "bg-success/15 border-success/50 text-success" };
    if (ai >= 70)
      return { tag: "AI-GENERATED", metricLabel: "AI Generated Probability", metricValue: ai, cls: "bg-primary/15 border-primary/50 text-primary" };
    if (fake >= 65 || r.category === "fake")
      return { tag: "FAKE NEWS", metricLabel: "Fake News Probability", metricValue: Math.max(fake, r.confidence), cls: "bg-destructive/15 border-destructive/50 text-destructive" };
    if (manip >= 60)
      return { tag: "MANIPULATED", metricLabel: "Manipulation Probability", metricValue: manip, cls: "bg-warning/15 border-warning/50 text-warning" };
    return { tag: "SUSPICIOUS", metricLabel: "Risk Score", metricValue: r.confidence, cls: "bg-warning/15 border-warning/50 text-warning" };
  };

  return (
    <div className="space-y-6">
      <Card className="glass-panel p-6 animate-glass-fade">
        <div className="space-y-4">
          <Textarea placeholder="Paste the text you want to verify…" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[200px] resize-none glass-panel" />
          <Button onClick={analyzeText} disabled={isAnalyzing} className="w-full bg-gradient-primary animate-lift" size="lg">
            {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</> : "Verify Text"}
          </Button>
        </div>
      </Card>

      {isAnalyzing && (
        <Card className="glass-panel p-6 animate-glass-ripple space-y-4">
          <div className="text-center space-y-2">
            <div className="text-xl font-semibold">{textState.statusText || "Analyzing text..."}</div>
            <p className="text-sm text-muted-foreground">Cross-checking web evidence & fact-checkers</p>
          </div>
          <Progress value={textState.progress} className="h-3 glass-panel" />
          <div className="text-center text-xs font-medium">{textState.progress}%</div>
        </Card>
      )}

      {textState.error && !isAnalyzing && (
        <Card className="glass-panel p-4 border-destructive/40 text-destructive">
          {textState.error}
        </Card>
      )}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Unified Hero Verdict Card */}
            {(() => {
              const vv = result.verifiedVerdict || (result.category === "authentic" ? "Verified" : result.category === "fake" ? "False Information" : "Misleading");
              const s = VV_STYLE[vv] || VV_STYLE["Verified"];
              const conf = Math.round(result.confidence || 0);

              // Calculate genuine Content Credibility Score
              const credibilityScore = vv === "Verified"
                ? Math.max(85, conf)
                : vv === "False Information"
                ? Math.max(5, 100 - conf)
                : vv === "Misleading" || vv === "Partially True"
                ? Math.round(Math.max(20, Math.min(65, 100 - conf * 0.6)))
                : 50;

              return (
                <Card className={`glass-panel p-6 border-2 ${s.cls} animate-glass-ripple`}>
                  <div className="flex items-center justify-between gap-6 flex-wrap">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-background/40 backdrop-blur-md shadow-md">{s.icon}</div>
                      <div>
                        <p className="text-xs uppercase tracking-widest opacity-75 mb-1 font-semibold">Verified News Verdict</p>
                        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">{s.label}</h2>
                        {result.verifiedAt && (
                          <p className="text-[11px] opacity-75 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Scanned at {new Date(result.verifiedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center px-4 py-2 rounded-xl bg-background/20 backdrop-blur-sm border border-white/10">
                        <p className="text-[10px] uppercase tracking-widest opacity-75 font-semibold">Content Credibility</p>
                        <div className="text-3xl md:text-4xl font-extrabold tabular-nums">{credibilityScore}%</div>
                      </div>

                      <div className="text-center px-4 py-2 rounded-xl bg-background/20 backdrop-blur-sm border border-white/10">
                        <p className="text-[10px] uppercase tracking-widest opacity-75 font-semibold">Detection Confidence</p>
                        <div className="text-3xl md:text-4xl font-extrabold tabular-nums">{conf}%</div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })()}

            {/* Correction / What actually happened */}
            {result.correction?.needed && (
              <Card className="glass-panel p-5 border-2 border-primary/40 animate-glass-ripple">
                <div className="flex items-center gap-2 mb-3">
                  <PencilLine className="w-4 h-4 text-primary" />
                  <p className="text-xs uppercase tracking-widest text-primary font-semibold">Corrected Information</p>
                </div>
                {result.correction.correctedClaim && (
                  <div className="mb-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Corrected claim</p>
                    <p className="text-sm font-medium leading-relaxed">{result.correction.correctedClaim}</p>
                  </div>
                )}
                {result.correction.whatActuallyHappened && (
                  <div className="mb-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">What actually happened</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.correction.whatActuallyHappened}</p>
                  </div>
                )}
                {result.correction.inaccurateParts && result.correction.inaccurateParts.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Inaccurate or fabricated parts</p>
                    <ul className="space-y-1">
                      {result.correction.inaccurateParts.map((p, i) => (
                        <li key={i} className="text-sm text-destructive flex gap-2"><span className="mt-0.5">✗</span><span className="text-foreground/90">{p}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.correction.reasons && result.correction.reasons.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Why they're wrong</p>
                    <ul className="space-y-1">
                      {result.correction.reasons.map((p, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-warning mt-0.5">•</span><span>{p}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}

            {/* Event summary */}
            {result.eventSummary && Object.values(result.eventSummary).some(v => v && String(v).trim()) && (
              <Card className="glass-panel p-5 animate-glass-ripple">
                <div className="flex items-center gap-2 mb-3">
                  <Newspaper className="w-4 h-4 text-primary" />
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Event Summary</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([
                    ["What", result.eventSummary.what],
                    ["When", result.eventSummary.when],
                    ["Where", result.eventSummary.where],
                    ["Who", result.eventSummary.who],
                    ["Why", result.eventSummary.why],
                    ["Latest", result.eventSummary.latest],
                  ] as const).map(([label, val]) => (val && String(val).trim()) ? (
                    <div key={label} className="p-3 glass-panel rounded-lg">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                      <p className="text-sm">{val}</p>
                    </div>
                  ) : null)}
                </div>
                {result.eventSummary.context && result.eventSummary.context.trim() && (
                  <div className="mt-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Context</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.eventSummary.context}</p>
                  </div>
                )}
              </Card>
            )}

            {/* Trusted sources referenced */}
            {(result.liveSearchUsed || (result.evidenceUsed && result.evidenceUsed.length > 0)) && (
              <Card className="glass-panel p-5 animate-glass-ripple">
                <div className="flex items-center gap-2 mb-3">
                  <Newspaper className="w-4 h-4 text-primary" />
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                    Live Web &amp; Social Cross-Check
                  </p>
                </div>

                {result.sourceCoverage && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    <div className="p-3 rounded-lg glass-panel border border-success/40">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Corroborating</p>
                      <p className="text-2xl font-extrabold tabular-nums text-success">{result.sourceCoverage.corroboratingOutlets ?? 0}</p>
                    </div>
                    <div className="p-3 rounded-lg glass-panel border border-destructive/40">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Contradicting</p>
                      <p className="text-2xl font-extrabold tabular-nums text-destructive">{result.sourceCoverage.contradictingOutlets ?? 0}</p>
                    </div>
                    <div className="p-3 rounded-lg glass-panel border border-border/50">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Spread</p>
                      <p className="text-sm font-semibold mt-1">{result.sourceCoverage.socialOnly ? "Social media only" : "Reported by outlets"}</p>
                    </div>
                  </div>
                )}
                {result.sourceCoverage?.summary && (
                  <p className="text-sm text-muted-foreground mb-4">{result.sourceCoverage.summary}</p>
                )}

                {result.evidenceUsed && result.evidenceUsed.length > 0 && (
                  <div className="space-y-2">
                    {result.evidenceUsed.map((e, i) => (
                      <a
                        key={i}
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block p-3 rounded-lg border transition-all hover:-translate-y-0.5 ${STANCE_CLS[e.stance || "context"]}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground line-clamp-1">{e.title || e.url}</span>
                          <span className="text-[10px] uppercase tracking-wider shrink-0">{e.stance || "context"}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{e.source || e.url}</p>
                        {e.note && <p className="text-xs text-muted-foreground mt-1">{e.note}</p>}
                      </a>
                    ))}
                  </div>
                )}

                {result.liveSources && result.liveSources.length > 0 && (
                  <details className="mt-4">
                    <summary className="text-xs text-muted-foreground cursor-pointer">
                      All {result.liveSources.length} live results scanned (news, fact-checkers, X, Reddit, Facebook, Instagram, YouTube)
                    </summary>
                    <div className="mt-2 space-y-1">
                      {result.liveSources.map((s, i) => (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary">
                          <span className="px-1.5 py-0.5 rounded bg-muted/40 text-[10px] uppercase shrink-0">{s.group}</span>
                          <span className="truncate">{s.title || s.url}</span>
                          <span className="shrink-0 opacity-60">{s.source}</span>
                        </a>
                      ))}
                    </div>
                  </details>
                )}
              </Card>
            )}

            {result.trustedSources && result.trustedSources.length > 0 && (
              <Card className="glass-panel p-5 animate-glass-ripple">
                <div className="flex items-center gap-2 mb-3">
                  <Landmark className="w-4 h-4 text-primary" />
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Cross-referenced Trusted Sources</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.trustedSources.map((s, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg glass-panel border border-border/50 max-w-full">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-primary shrink-0" />
                        <span className="text-sm font-medium">{s.name}</span>
                        {s.type && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">· {s.type}</span>}
                      </div>
                      {s.note && <p className="text-xs text-muted-foreground mt-1">{s.note}</p>}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  Sources named from the model's trained knowledge of established news agencies, government bodies and fact-checkers. Always confirm with the outlet directly for breaking events.
                </p>
              </Card>
            )}

            {/* Real / Misleading / Fake probability breakdown */}
            {result.probabilities && (
              <Card className="glass-panel p-5 animate-glass-ripple">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Probability Breakdown</p>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    ["Real", result.probabilities.real, "success"],
                    ["Misleading", result.probabilities.misleading, "warning"],
                    ["Fake", result.probabilities.fake, "destructive"],
                  ] as const).map(([label, val, tone]) => (
                    <div key={label} className={`p-3 rounded-lg glass-panel border ${tone === "success" ? "border-success/40" : tone === "warning" ? "border-warning/40" : "border-destructive/40"}`}>
                      <p className={`text-xs font-medium ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive"}`}>{label}</p>
                      <p className="text-2xl font-extrabold tabular-nums mt-1">{val}%</p>
                      <Progress value={val} className="h-1.5 mt-2" />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  Final classification chosen by highest probability via ensemble of semantic, fact-check, historical and consistency layers.
                </p>
              </Card>
            )}

            {/* Detailed analysis — one section at a time via tabs */}
            {(() => {
              const tabs: { id: string; label: string; show: boolean }[] = [
                { id: "summary", label: "Summary", show: true },
                { id: "scores", label: "Threat Scores", show: !!result.scores },
                { id: "facts", label: "Fact Check", show: !!(result.factChecks && result.factChecks.length) },
                { id: "history", label: "History", show: !!(result.historicalContext && result.historicalContext.trim()) },
                { id: "incons", label: "Inconsistencies", show: !!(result.inconsistencies && result.inconsistencies.length) },
                { id: "propaganda", label: "Propaganda", show: !!(result.propagandaTechniques && result.propagandaTechniques.length) },
                { id: "tactics", label: "Tactics", show: !!(result.manipulationTactics && result.manipulationTactics.length) },
                { id: "explain", label: "Explanation", show: !!result.aiExplanation },
              ].filter(t => t.show);

              return (
                <Card className="glass-panel p-4 md:p-5 animate-glass-ripple">
                  <Tabs defaultValue={tabs[0].id} className="w-full">
                    <TabsList className="flex flex-wrap gap-1 h-auto bg-transparent p-0 mb-4 border-b border-border/40 rounded-none w-full justify-start">
                      {tabs.map(t => (
                        <TabsTrigger
                          key={t.id}
                          value={t.id}
                          className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-xs md:text-sm"
                        >
                          {t.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {/* Summary */}
                    <TabsContent value="summary" className="mt-0 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full glass-glow ${catCls(result.category)}`}>{icon(result.category)}</div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold capitalize">{result.category}</h3>
                          <p className="text-sm text-muted-foreground">Confidence: {result.confidence}%
                            {result.biasDirection && result.biasDirection !== "unknown" && <> · Bias: <span className={`font-medium capitalize ${BIAS_COLORS[result.biasDirection] || ""}`}>{result.biasDirection}</span></>}
                          </p>
                        </div>
                        <Progress value={result.confidence} className="h-3 w-1/3 glass-panel" />
                      </div>
                      <p className="text-sm text-muted-foreground border-t border-border/50 pt-4">{result.analysis}</p>
                      {!result.isAuthentic && (
                        <div className="p-4 glass-panel rounded-lg border-2 border-destructive glass-glow">
                          <p className="text-destructive font-bold text-lg">⚠ FAKE NEWS DETECTED</p>
                          <p className="text-sm text-muted-foreground mt-1">This content shows multiple signs of misinformation</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* Threat Scores */}
                    {result.scores && (
                      <TabsContent value="scores" className="mt-0">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {([
                            ["Fake News", result.scores.fakeNewsProbability],
                            ["Propaganda", result.scores.propagandaLevel],
                            ["Bias", result.scores.biasScore],
                            ["Sentiment Manipulation", result.scores.sentimentManipulation],
                            ["Source Credibility", result.scores.sourceCredibility],
                            ["AI-Generated", result.scores.aiGeneratedProbability],
                          ] as const).map(([label, val]) => (
                            <div key={label} className="p-3 glass-panel rounded-lg">
                              <p className="text-xs text-muted-foreground mb-2">{label}</p>
                              <Progress value={val} className="h-2" />
                              <p className="text-xs font-medium mt-1">{val}%</p>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    )}

                    {/* Fact Checks */}
                    {result.factChecks && result.factChecks.length > 0 && (
                      <TabsContent value="facts" className="mt-0">
                        <div className="flex items-center gap-2 mb-3">
                          <FileSearch className="h-4 w-4 text-primary" />
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Claim Fact-Check</p>
                        </div>
                        <div className="space-y-2">
                          {result.factChecks.map((fc, i) => {
                            const cls = fc.status === "supported"
                              ? "border-success/40 bg-success/10 text-success"
                              : fc.status === "contradicted"
                              ? "border-destructive/40 bg-destructive/10 text-destructive"
                              : "border-warning/40 bg-warning/10 text-warning";
                            return (
                              <div key={i} className="p-3 glass-panel rounded-lg">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <p className="text-sm font-medium flex-1">"{fc.claim}"</p>
                                  <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${cls}`}>{fc.status}</span>
                                </div>
                                {fc.note && <p className="text-xs text-muted-foreground">{fc.note}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </TabsContent>
                    )}

                    {/* History */}
                    {result.historicalContext && result.historicalContext.trim() && (
                      <TabsContent value="history" className="mt-0">
                        <div className="flex items-center gap-2 mb-2">
                          <History className="h-4 w-4 text-primary" />
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Historical Context</p>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{result.historicalContext}</p>
                      </TabsContent>
                    )}

                    {/* Inconsistencies */}
                    {result.inconsistencies && result.inconsistencies.length > 0 && (
                      <TabsContent value="incons" className="mt-0">
                        <div className="flex items-center gap-2 mb-3">
                          <GitCompare className="h-4 w-4 text-warning" />
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Inconsistencies & Unsupported Statements</p>
                        </div>
                        <ul className="space-y-1.5">
                          {result.inconsistencies.map((item, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex gap-2">
                              <span className="text-warning mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </TabsContent>
                    )}

                    {/* Propaganda */}
                    {result.propagandaTechniques && result.propagandaTechniques.length > 0 && (
                      <TabsContent value="propaganda" className="mt-0">
                        <div className="flex items-center gap-2 mb-3">
                          <MessageCircleWarning className="h-4 w-4 text-warning" />
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Propaganda Techniques</p>
                        </div>
                        <div className="space-y-2">
                          {result.propagandaTechniques.map((pt, i) => (
                            <div key={i} className="p-3 glass-panel rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">{pt.name}</span>
                                <span className="text-xs text-muted-foreground">{pt.confidence}%</span>
                              </div>
                              <p className="text-xs text-muted-foreground italic">"{pt.example}"</p>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    )}

                    {/* Tactics */}
                    {result.manipulationTactics && result.manipulationTactics.length > 0 && (
                      <TabsContent value="tactics" className="mt-0">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Manipulation Tactics</p>
                        <div className="flex flex-wrap gap-2">
                          {result.manipulationTactics.map((mt, i) => (
                            <span key={i} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${SEVERITY_CLS[mt.severity]}`}>{mt.tactic}</span>
                          ))}
                        </div>
                      </TabsContent>
                    )}

                    {/* AI Explanation */}
                    {result.aiExplanation && (
                      <TabsContent value="explain" className="mt-0">
                        <div className="flex items-center gap-2 mb-3">
                          <Brain className="h-4 w-4 text-primary" />
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">AI Expert Explanation</p>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{result.aiExplanation}</p>
                      </TabsContent>
                    )}
                  </Tabs>
                </Card>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
