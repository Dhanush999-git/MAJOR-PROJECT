import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Brain,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  HelpCircle,
  Loader2,
  Newspaper,
  Scale,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

import { useAnalysis } from "@/contexts/AnalysisContext";


/* ============================================================
   TYPES
   ============================================================ */

interface ClassifierResult {
  label?: string;
  raw_label?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  model?: string;
  device?: string;
}

interface FactCheckItem {
  claim?: string;
  publisher?: string;
  publisher_site?: string;
  title?: string;
  url?: string;
  review_date?: string;
  rating?: string;
  normalized_rating?: string;
  language_code?: string;
  relevance_score?: number;
  publisher_quality?: number;
  relevant?: boolean;
}

interface WebEvidenceItem {
  title?: string;
  publisher?: string;
  google_news_url?: string;
  publisher_url?: string;
  article_url?: string;
  published?: string;
  description?: string;
  article_text?: string;
  evidence_text?: string;
  evidence_type?: string;
  resolved?: boolean;
  extracted?: boolean;
}

interface EvidenceResult {
  evidence?: string;
  proposition_relationship?: string;
  proposition_confidence?: number;

  claim_relation?: {
    relation?: string;
    subject?: string;
    object?: string;
    negated?: boolean;
  };

  evidence_relation?: {
    relation?: string;
    subject?: string;
    object?: string;
    negated?: boolean;
  } | null;

  nli_verdict?: string;
  nli_confidence?: number;

  final_evidence_verdict?: string;
  correction_reason?: string;

  evidence_score?: number;
  similarity?: number;
  keyword_overlap?: number;
  concept_overlap?: number;
  directness?: number;
  usefulness?: number;

  source?: string;
  source_quality?: number;
  evidence_type?: string;
  title?: string;
  url?: string;
  published?: string;
}

interface SourceResult {
  source?: string;
  source_quality?: number;
  verdict?: string;
  strength?: number;
  evidence_count?: number;
  best_evidence?: string;
}

interface EvidenceVerification {
  claim?: string;

  final_verdict?: string;
  confidence?: number;

  scores?: {
    supports?: number;
    refutes?: number;
    neutral?: number;
  };

  source_summary?: {
    total_sources?: number;
    supporting_sources?: number;
    refuting_sources?: number;
    neutral_sources?: number;
    conflicting_sources?: number;
  };

  source_results?: SourceResult[];

  evidence_count?: number;
  evidence_results?: EvidenceResult[];
}

interface TextVerificationResult {
  text?: string;

  verdict?: "REAL" | "FAKE" | "UNVERIFIED";
  confidence?: number;
  reason?: string;

  factcheck_used?: boolean;
  factcheck_similarity?: number | null;

  classifier?: ClassifierResult;

  fact_checks?: FactCheckItem[];
  web_evidence?: WebEvidenceItem[];

  evidence_verification?: EvidenceVerification;

  executionTimeMs?: number;
  speedMetrics?: {
    totalMs?: number;
    throughputLabel?: string;
  };
}


/* ============================================================
   HELPERS
   ============================================================ */

const formatPercent = (value?: number) => {
  if (!Number.isFinite(Number(value))) {
    return "0.00%";
  }

  return `${(Number(value) * 100).toFixed(2)}%`;
};

const formatScorePercent = (value?: number) => {
  if (!Number.isFinite(Number(value))) {
    return "0.0%";
  }

  return `${(Number(value) * 100).toFixed(1)}%`;
};

const verdictConfig = {
  REAL: {
    label: "REAL",
    description: "The available evidence supports this claim.",
    className:
      "border-success/40 bg-success/10 text-success",
    icon: ShieldCheck,
  },

  FAKE: {
    label: "FAKE",
    description: "The available evidence contradicts this claim.",
    className:
      "border-destructive/40 bg-destructive/10 text-destructive",
    icon: ShieldAlert,
  },

  UNVERIFIED: {
    label: "UNVERIFIED",
    description:
      "There is not enough reliable evidence to verify this claim.",
    className:
      "border-warning/40 bg-warning/10 text-warning",
    icon: HelpCircle,
  },
} as const;


/* ============================================================
   COMPONENT
   ============================================================ */

export const TextVerification = () => {
  const {
    textState,
    runTextAnalysis,
  } = useAnalysis();

  const [text, setText] = useState(
    textState.input || ""
  );

  const result =
    textState.result as TextVerificationResult | null;

  const isAnalyzing =
    textState.isAnalyzing;


  /* ==========================================================
     ANALYZE
     ========================================================== */

  const analyzeText = async () => {
    const trimmedText = text.trim();

    if (!trimmedText) {
      toast.error(
        "Please enter a claim or statement to verify."
      );
      return;
    }

    if (trimmedText.length > 10000) {
      toast.error(
        "Text is too long. Maximum length is 10,000 characters."
      );
      return;
    }

    await runTextAnalysis(trimmedText);
  };


  /* ==========================================================
     CLEAR
     ========================================================== */

  const clearText = () => {
    setText("");
  };


  /* ==========================================================
     DERIVED DATA
     ========================================================== */

  const verdict =
    result?.verdict || "UNVERIFIED";

  const config =
    verdictConfig[
      verdict as keyof typeof verdictConfig
    ] || verdictConfig.UNVERIFIED;

  const VerdictIcon = config.icon;

  const finalConfidence =
    Number(result?.confidence || 0);

  const classifier =
    result?.classifier;

  const classifierConfidence =
    Number(classifier?.confidence || 0);

  const classifierProbabilities =
    classifier?.probabilities || {};

  const realProbability =
    Number(
      classifierProbabilities.LABEL_0 ??
        classifierProbabilities["0"] ??
        0
    );

  const fakeProbability =
    Number(
      classifierProbabilities.LABEL_1 ??
        classifierProbabilities["1"] ??
        0
    );

  const evidenceVerification =
    result?.evidence_verification;

  const evidenceResults =
    evidenceVerification?.evidence_results || [];

  const sourceResults =
    evidenceVerification?.source_results || [];

  const factChecks =
    result?.fact_checks || [];

  const webEvidence =
    result?.web_evidence || [];

  const sourceSummary =
    evidenceVerification?.source_summary;

  const evidenceVerdict =
    evidenceVerification?.final_verdict ||
    "NOT_ENOUGH_INFO";


  /* ==========================================================
     RENDER
     ========================================================== */

 return (
  <div className="w-full space-y-6">


      {/* ======================================================
          INPUT
          ====================================================== */}

      <Card className="glass-panel p-5">

        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold">
              Enter a claim
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              Text verification uses evidence only.
              No image upload is used here.
            </p>
          </div>

          <span className="text-xs text-muted-foreground">
            {text.length}/10000
          </span>
        </div>

        <Textarea
          value={text}
          onChange={(event) =>
            setText(event.target.value)
          }
          placeholder="Example: The Earth revolves around the Sun."
          disabled={isAnalyzing}
          className="min-h-[180px] resize-y bg-background/40"
        />

        <div className="flex gap-3 mt-4">

          <Button
            onClick={analyzeText}
            disabled={
              isAnalyzing ||
              !text.trim()
            }
            className="flex-1"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying Evidence...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Verify Text
              </>
            )}
          </Button>

          {text && !isAnalyzing && (
            <Button
              variant="outline"
              onClick={clearText}
            >
              Clear
            </Button>
          )}

        </div>

      </Card>


      {/* ======================================================
          ANALYSIS PROGRESS
          ====================================================== */}

      {isAnalyzing && (
        <Card className="glass-panel p-5">

          <div className="flex items-center gap-3 mb-3">

            <Loader2 className="w-5 h-5 text-primary animate-spin" />

            <div>
              <p className="font-semibold">
                Verifying claim
              </p>

              <p className="text-xs text-muted-foreground">
                {textState.statusText ||
                  "Running evidence-based verification..."}
              </p>
            </div>

          </div>

          <Progress
            value={textState.progress}
            className="h-2"
          />

          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>
              Evidence pipeline
            </span>

            <span>
              {textState.progress}%
            </span>
          </div>

        </Card>
      )}


      {/* ======================================================
          ERROR
          ====================================================== */}

      {textState.error && !isAnalyzing && (
        <Card className="border-destructive/40 bg-destructive/5 p-5">

          <div className="flex gap-3">

            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />

            <div>
              <p className="font-semibold text-destructive">
                Verification failed
              </p>

              <p className="text-sm text-muted-foreground mt-1">
                {textState.error}
              </p>
            </div>

          </div>

        </Card>
      )}


      {/* ======================================================
          RESULT
          ====================================================== */}

      {result && !isAnalyzing && (

        <div className="space-y-5">

          {/* ==================================================
              FINAL VERDICT
              ================================================== */}

          <Card
            className={`p-6 border ${config.className}`}
          >

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

              <div className="flex items-center gap-4">

                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-background/40">
                  <VerdictIcon className="w-8 h-8" />
                </div>

                <div>

                  <p className="text-xs uppercase tracking-[0.2em] opacity-70">
                    Final Verification Verdict
                  </p>

                  <h2 className="text-3xl font-black tracking-tight mt-1">
                    {config.label}
                  </h2>

                  <p className="text-sm opacity-80 mt-1">
                    {config.description}
                  </p>

                </div>

              </div>


              <div className="grid grid-cols-2 gap-3">

                <div className="rounded-xl border border-border/50 bg-background/40 px-5 py-3 text-center">

                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Evidence Confidence
                  </p>

                  <p className="text-2xl font-bold mt-1">
                    {(finalConfidence * 100).toFixed(2)}%
                  </p>

                </div>


                <div className="rounded-xl border border-border/50 bg-background/40 px-5 py-3 text-center">

                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Evidence Verdict
                  </p>

                  <p className="text-sm font-bold mt-2">
                   {evidenceVerdict.replace(/_/g, " ")}
                  </p>

                </div>

              </div>

            </div>

          </Card>


          {/* ==================================================
              CLAIM + REASON
              ================================================== */}

          <Card className="glass-panel p-5">

            <div className="flex items-center gap-2 mb-4">
              <Scale className="w-4 h-4 text-primary" />

              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                Verification Summary
              </p>
            </div>


            <div className="rounded-xl border border-border/50 bg-background/30 p-4">

              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Claim
              </p>

              <p className="text-base leading-relaxed font-medium">
                {result.text || text}
              </p>

            </div>


            <div className="rounded-xl border border-border/50 bg-background/30 p-4 mt-3">

              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Reason
              </p>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {result.reason ||
                  "The claim was evaluated against available evidence."}
              </p>

            </div>

          </Card>


          {/* ==================================================
              EVIDENCE SCORE
              ================================================== */}

          <Card className="glass-panel p-5">

            <div className="flex items-center gap-2 mb-5">
              <Brain className="w-4 h-4 text-primary" />

              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                Evidence Analysis
              </p>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

              <div className="rounded-xl border border-success/30 bg-success/5 p-4">

                <p className="text-xs text-muted-foreground">
                  Supporting Score
                </p>

                <p className="text-2xl font-bold text-success mt-1">
  {Number(
    evidenceVerification?.scores?.supports || 0
  ).toFixed(3)}
</p>

              </div>


              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">

                <p className="text-xs text-muted-foreground">
                  Refuting Score
                </p>

                <p className="text-2xl font-bold text-destructive mt-1">
  {Number(
    evidenceVerification?.scores?.refutes || 0
  ).toFixed(3)}
</p>

              </div>


              <div className="rounded-xl border border-border/50 bg-background/30 p-4">

                <p className="text-xs text-muted-foreground">
                  Neutral Score
                </p>

                <p className="text-2xl font-bold mt-1">
  {Number(
    evidenceVerification?.scores?.neutral || 0
  ).toFixed(3)}
</p>

              </div>

            </div>


            <div className="mt-5 rounded-xl border border-border/50 bg-background/30 p-4">

              <div className="flex items-center justify-between">

                <span className="text-sm text-muted-foreground">
                  Evidence passages evaluated
                </span>

                <span className="font-bold">
                  {evidenceVerification?.evidence_count || 0}
                </span>

              </div>

              <div className="flex items-center justify-between mt-2">

                <span className="text-sm text-muted-foreground">
                  Sources evaluated
                </span>

                <span className="font-bold">
                  {sourceSummary?.total_sources || 0}
                </span>

              </div>

            </div>

          </Card>


          {/* ==================================================
              SOURCE COVERAGE
              ================================================== */}

          {sourceSummary && (
            <Card className="glass-panel p-5">

              <div className="flex items-center gap-2 mb-5">
                <Newspaper className="w-4 h-4 text-primary" />

                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                  Source Coverage
                </p>
              </div>


              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                <div className="rounded-xl border border-border/50 bg-background/30 p-4">
                  <p className="text-xs text-muted-foreground">
                    Total
                  </p>
                  <p className="text-xl font-bold mt-1">
                    {sourceSummary.total_sources || 0}
                  </p>
                </div>

                <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                  <p className="text-xs text-muted-foreground">
                    Supporting
                  </p>
                  <p className="text-xl font-bold text-success mt-1">
                    {sourceSummary.supporting_sources || 0}
                  </p>
                </div>

                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-xs text-muted-foreground">
                    Refuting
                  </p>
                  <p className="text-xl font-bold text-destructive mt-1">
                    {sourceSummary.refuting_sources || 0}
                  </p>
                </div>

                <div className="rounded-xl border border-border/50 bg-background/30 p-4">
                  <p className="text-xs text-muted-foreground">
                    Neutral
                  </p>
                  <p className="text-xl font-bold mt-1">
                    {sourceSummary.neutral_sources || 0}
                  </p>
                </div>

              </div>

            </Card>
          )}


          {/* ==================================================
              EVIDENCE PASSAGES
              ================================================== */}

          <Card className="glass-panel p-5">

            <div className="flex items-center justify-between mb-5">

              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />

                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                  Verified Evidence
                </p>
              </div>

              <span className="text-xs text-muted-foreground">
                {evidenceResults.length} passages
              </span>

            </div>


            {evidenceResults.length === 0 ? (

              <div className="rounded-xl border border-border/50 bg-background/30 p-6 text-center">

                <HelpCircle className="w-7 h-7 mx-auto text-muted-foreground mb-2" />

                <p className="font-medium">
                  No decisive evidence found
                </p>

                <p className="text-sm text-muted-foreground mt-1">
                  The system therefore keeps the final verdict
                  conservative.
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {evidenceResults.map(
                  (evidence, index) => {

                    const evidenceVerdict =
                      String(
                        evidence.final_evidence_verdict ||
                          evidence.nli_verdict ||
                          "NOT_ENOUGH_INFO"
                      ).toUpperCase();

                    const isSupport =
                      evidenceVerdict ===
                      "SUPPORTS";

                    const isRefute =
                      evidenceVerdict ===
                      "REFUTES";

                    const evidenceClass =
                      isSupport
                        ? "border-success/30 bg-success/5"
                        : isRefute
                          ? "border-destructive/30 bg-destructive/5"
                          : "border-border/50 bg-background/20";

                    return (
                      <div
                        key={`${evidence.source || "source"}-${index}`}
                        className={`rounded-xl border p-4 ${evidenceClass}`}
                      >

                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">

                          <div className="flex-1">

                            <div className="flex items-center gap-2 mb-2">

                              {isSupport ? (
                                <CheckCircle2 className="w-4 h-4 text-success" />
                              ) : isRefute ? (
                                <XCircle className="w-4 h-4 text-destructive" />
                              ) : (
                                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                              )}

                              <span className="text-xs font-bold uppercase tracking-wider">
                               {evidenceVerdict.replace(/_/g, " ")}
                              </span>

                            </div>


                            {evidence.title && (
                              <p className="font-semibold">
                                {evidence.title}
                              </p>
                            )}

                            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                              {evidence.evidence ||
                                "No evidence passage was returned."}
                            </p>

                          </div>


                          <div className="text-right shrink-0">

                            <p className="text-xs font-semibold">
                              {evidence.source ||
                                "Unknown source"}
                            </p>

                            {typeof evidence.source_quality === "number" && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                Source quality{" "}
                                {formatScorePercent(
                                  evidence.source_quality
                                )}
                              </p>
                            )}

                          </div>

                        </div>


                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">

                          <div className="rounded-lg bg-background/40 p-2">
                            <p className="text-[10px] text-muted-foreground">
                              Proposition
                            </p>
                            <p className="text-xs font-semibold mt-1">
                              {evidence.proposition_relationship ||
                                "UNKNOWN"}
                            </p>
                          </div>

                          <div className="rounded-lg bg-background/40 p-2">
                            <p className="text-[10px] text-muted-foreground">
                              NLI
                            </p>
                            <p className="text-xs font-semibold mt-1">
                              {evidence.nli_verdict ||
                                "NOT_ENOUGH_INFO"}
                            </p>
                          </div>

                          <div className="rounded-lg bg-background/40 p-2">
                            <p className="text-[10px] text-muted-foreground">
                              Similarity
                            </p>
                            <p className="text-xs font-semibold mt-1">
                              {formatScorePercent(
                                evidence.similarity
                              )}
                            </p>
                          </div>

                          <div className="rounded-lg bg-background/40 p-2">
                            <p className="text-[10px] text-muted-foreground">
                              Directness
                            </p>
                            <p className="text-xs font-semibold mt-1">
                              {formatScorePercent(
                                evidence.directness
                              )}
                            </p>
                          </div>

                        </div>


                        {evidence.correction_reason && (
                          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3">

                            <p className="text-[10px] uppercase tracking-wider text-warning mb-1">
                              Evidence interpretation
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {evidence.correction_reason}
                            </p>

                          </div>
                        )}


                        {evidence.url && (
                          <a
                            href={evidence.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-3"
                          >
                            Open source
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                      </div>
                    );
                  }
                )}

              </div>

            )}

          </Card>


          {/* ==================================================
              SOURCE RESULTS
              ================================================== */}

          {sourceResults.length > 0 && (
            <Card className="glass-panel p-5">

              <div className="flex items-center gap-2 mb-5">
                <ShieldCheck className="w-4 h-4 text-primary" />

                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                  Source-Level Verification
                </p>
              </div>


              <div className="space-y-3">

                {sourceResults.map(
                  (source, index) => {

                    const sourceVerdict =
                      String(
                        source.verdict ||
                          "NOT_ENOUGH_INFO"
                      ).toUpperCase();

                    return (
                      <div
                        key={`${source.source || "source"}-${index}`}
                        className="rounded-xl border border-border/50 bg-background/20 p-4"
                      >

                        <div className="flex items-center justify-between gap-3">

                          <div>

                            <p className="font-semibold">
                              {source.source ||
                                "Unknown source"}
                            </p>

                            <p className="text-xs text-muted-foreground mt-1">
                              {source.evidence_count || 0} evidence passages
                            </p>

                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                              sourceVerdict === "SUPPORTS"
                                ? "text-success border-success/30 bg-success/5"
                                : sourceVerdict === "REFUTES"
                                  ? "text-destructive border-destructive/30 bg-destructive/5"
                                  : "text-muted-foreground border-border/50"
                            }`}
                          >
                            {sourceVerdict.replace(/_/g, " ")}
                          </span>

                        </div>


                        {source.best_evidence && (
                          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                            {source.best_evidence}
                          </p>
                        )}

                      </div>
                    );
                  }
                )}

              </div>

            </Card>
          )}


          {/* ==================================================
              FACT CHECKS
              ================================================== */}

          <Card className="glass-panel p-5">

            <div className="flex items-center justify-between mb-5">

              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-primary" />

                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                  Google Fact Checks
                </p>
              </div>

              <span className="text-xs text-muted-foreground">
                {factChecks.length} results
              </span>

            </div>


            {factChecks.length === 0 ? (

              <div className="rounded-xl border border-border/50 bg-background/30 p-5">

                <p className="text-sm font-medium">
                  No matching fact-check article was found.
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  The final decision therefore relies primarily
                  on retrieved web evidence and NLI.
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {factChecks.map(
                  (factCheck, index) => {

                    const rating =
                      factCheck.normalized_rating ||
                      factCheck.rating ||
                      "UNRATED";

                    return (
                      <div
                        key={`${factCheck.url || "factcheck"}-${index}`}
                        className="rounded-xl border border-border/50 bg-background/20 p-4"
                      >

                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">

                          <div className="flex-1">

                            <p className="font-semibold">
                              {factCheck.publisher ||
                                "Fact-check publisher"}
                            </p>

                            {factCheck.title && (
                              <p className="text-sm mt-1">
                                {factCheck.title}
                              </p>
                            )}

                            <p className="text-xs text-muted-foreground mt-2">
                              {factCheck.claim ||
                                "Related fact-check claim"}
                            </p>

                          </div>


                          <span className="px-3 py-1 rounded-full border border-border/50 bg-background/40 text-xs font-bold">
                            {rating}
                          </span>

                        </div>


                        <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted-foreground">

                          {typeof factCheck.relevance_score === "number" && (
                            <span>
                              Relevance{" "}
                              {formatScorePercent(
                                factCheck.relevance_score
                              )}
                            </span>
                          )}

                          {typeof factCheck.publisher_quality === "number" && (
                            <span>
                              Publisher quality{" "}
                              {formatScorePercent(
                                factCheck.publisher_quality
                              )}
                            </span>
                          )}

                        </div>


                        {factCheck.url && (
                          <a
                            href={factCheck.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-3"
                          >
                            Open fact check
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                      </div>
                    );
                  }
                )}

              </div>

            )}

          </Card>


          {/* ==================================================
              NEWS / WEB SOURCES
              ================================================== */}

          <Card className="glass-panel p-5">

            <div className="flex items-center justify-between mb-5">

              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-primary" />

                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                  News & Web Evidence
                </p>
              </div>

              <span className="text-xs text-muted-foreground">
                {webEvidence.length} sources
              </span>

            </div>


            {webEvidence.length === 0 ? (

              <div className="rounded-xl border border-border/50 bg-background/30 p-5">

                <p className="text-sm font-medium">
                  No web evidence was retrieved.
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {webEvidence.map(
                  (source, index) => {

                    const sourceUrl =
                      source.article_url ||
                      source.publisher_url ||
                      source.google_news_url;

                    return (
                      <div
                        key={`${sourceUrl || "web"}-${index}`}
                        className="rounded-xl border border-border/50 bg-background/20 p-4"
                      >

                        <div className="flex items-start gap-3">

                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Newspaper className="w-4 h-4 text-primary" />
                          </div>

                          <div className="flex-1 min-w-0">

                            <p className="font-semibold">
                              {source.title ||
                                "Web evidence"}
                            </p>

                            <p className="text-xs text-muted-foreground mt-1">
                              {source.publisher ||
                                "Unknown publisher"}
                            </p>

                            {source.description && (
                              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                                {source.description}
                              </p>
                            )}

                            {source.published && (
                              <p className="text-[11px] text-muted-foreground mt-2">
                                Published: {source.published}
                              </p>
                            )}

                            {sourceUrl && (
                              <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-3"
                              >
                                View source
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}

                          </div>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

            )}

          </Card>


          {/* ==================================================
              CLASSIFIER
              ================================================== */}

          <Card className="glass-panel p-5">

            <div className="flex items-center gap-2 mb-5">
              <Brain className="w-4 h-4 text-primary" />

              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                Secondary ML Classifier
              </p>
            </div>


            <div className="rounded-xl border border-border/50 bg-background/20 p-4 mb-4">

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                <div>

                  <p className="font-semibold">
                    {classifier?.model ||
                      "GhostFaith/distilbert-fakenews"}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    Device: {classifier?.device || "unknown"}
                  </p>

                </div>

                <div className="text-left md:text-right">

                  <p className="text-xs text-muted-foreground">
                    Classifier output
                  </p>

                  <p className="font-bold mt-1">
                    {classifier?.label || "UNKNOWN"}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {formatPercent(
                      classifierConfidence
                    )}
                  </p>

                </div>

              </div>

            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              <div className="rounded-xl border border-border/50 bg-background/20 p-4">

                <div className="flex justify-between">

                  <span className="text-sm">
                    Real probability
                  </span>

                  <span className="font-bold">
                    {formatPercent(
                      realProbability
                    )}
                  </span>

                </div>

                <Progress
                  value={realProbability * 100}
                  className="mt-3 h-2"
                />

              </div>


              <div className="rounded-xl border border-border/50 bg-background/20 p-4">

                <div className="flex justify-between">

                  <span className="text-sm">
                    Fake probability
                  </span>

                  <span className="font-bold">
                    {formatPercent(
                      fakeProbability
                    )}
                  </span>

                </div>

                <Progress
                  value={fakeProbability * 100}
                  className="mt-3 h-2"
                />

              </div>

            </div>


            <div className="mt-4 rounded-xl border border-warning/20 bg-warning/5 p-4">

              <div className="flex gap-3">

                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />

                <p className="text-xs text-muted-foreground leading-relaxed">
                  This classifier is a secondary signal.
                  VeriFact does not use the classifier alone
                  to determine whether a factual claim is true.
                  The final text verdict is based on retrieved
                  evidence, proposition direction and NLI.
                </p>

              </div>

            </div>

          </Card>


          {/* ==================================================
              TECHNICAL DETAILS
              ================================================== */}

          <Card className="glass-panel p-5">

            <div className="flex items-center gap-2 mb-5">
              <BadgeCheck className="w-4 h-4 text-primary" />

              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                Verification Pipeline
              </p>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

              <div className="rounded-xl border border-border/50 bg-background/20 p-4">
                <p className="text-xs text-muted-foreground">
                  Fact Check
                </p>
                <p className="font-bold mt-1">
                  {result.factcheck_used
                    ? "USED"
                    : "NOT DOMINANT"}
                </p>
              </div>

              <div className="rounded-xl border border-border/50 bg-background/20 p-4">
                <p className="text-xs text-muted-foreground">
                  Web Sources
                </p>
                <p className="font-bold mt-1">
                  {webEvidence.length}
                </p>
              </div>

              <div className="rounded-xl border border-border/50 bg-background/20 p-4">
                <p className="text-xs text-muted-foreground">
                  Evidence Passages
                </p>
                <p className="font-bold mt-1">
                  {evidenceResults.length}
                </p>
              </div>

              <div className="rounded-xl border border-border/50 bg-background/20 p-4">
                <p className="text-xs text-muted-foreground">
                  Processing Time
                </p>
                <p className="font-bold mt-1">
                  {result.executionTimeMs
                    ? `${result.executionTimeMs} ms`
                    : "—"}
                </p>
              </div>

            </div>


            {result.speedMetrics?.throughputLabel && (
              <p className="text-xs text-muted-foreground mt-4">
                Processing throughput:{" "}
                {result.speedMetrics.throughputLabel}
              </p>
            )}

          </Card>


          {/* ==================================================
              DISCLAIMER
              ================================================== */}

          <div className="rounded-xl border border-border/50 bg-background/20 p-4">

            <div className="flex gap-3">

              <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />

              <p className="text-xs text-muted-foreground leading-relaxed">
                VeriFact uses retrieved evidence to assess claims.
                A result of UNVERIFIED means the available evidence
                was insufficient or inconclusive; it should not be
                interpreted as proof that the claim is false.
              </p>

            </div>

          </div>

        </div>
      )}

    </div>
  );
};