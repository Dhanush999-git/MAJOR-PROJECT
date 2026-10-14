import { createContext, useContext, useState, ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { API_BASE_URL } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { computeContentHash, getCachedResult, setCachedResult } from "@/lib/cacheManager";
import { buildForensicEnsemble, type EnsembleVerificationResult } from "@/lib/forensicEnsemble";
import type { ForensicBundle } from "@/lib/forensicSignals";
import { decodeQrImage, type PhysicalQrAnalysis } from "@/lib/qrDecoder";
import { analyzeQrForensics, type QrForensicReport, type QrRiskLevel } from "@/lib/qrForensics";
import type { SpeedMetrics } from "@/lib/analysisTypes";

export type AnalysisMode = "text" | "image" | "video" | "audio" | "url" | "document" | "qr";

interface SpecialistModelResult {
  verdict?: string;
  confidence?: number;
  fake_probability?: number;
  real_probability?: number;
  model?: string;
  effects?: unknown[];
  regions?: unknown[];
}

type JsonRecord = Record<string, unknown>;

interface ImageAnalysisSignals {
  exif?: { make?: string; model?: string; software?: string };
  compression?: { megapixels?: number; bytesPerPixel?: number };
  dimensions?: { width: number; height: number };
  mime?: string;
}

interface VideoAnalysisInput extends JsonRecord {
  frames?: unknown[];
  audio?: unknown;
  durationSec?: number;
  src?: string;
}

interface AudioAnalysisInput {
  audioBase64: string;
  mimeType: string;
  filename: string;
}

interface DocumentAnalysisInput {
  fileData: string;
  mime: string;
  filename: string;
}

interface ImageAnalysisResult extends EnsembleVerificationResult {
  isAuthentic?: boolean;
  verdict?: string;
  fakeProbability?: number;
  realProbability?: number;
  model?: string;
  specialistModelResult?: SpecialistModelResult | null;
  forensicEvidence?: EnsembleVerificationResult;
  modelUsed?: string;
  analysis?: string;
  detectionScores?: Record<string, number>;
  speedMetrics?: SpeedMetrics;
  executionTimeMs?: number;
  isProgressive?: boolean;
}

interface QrAiResponse {
  verdict?: QrForensicReport["verdict"];
  securityScore?: number;
  riskLevel?: QrRiskLevel;
  recommendedAction?: QrForensicReport["recommendedAction"];
  analysis?: string;
}

const asFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// Analysis responses come from several independently deployed services. Components
// narrow each response to its mode-specific shape before rendering it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AnalysisState<TInput = unknown, TResult = any, TExtra = unknown> {
  isAnalyzing: boolean;
  progress: number;
  statusText: string;
  input: TInput | null;
  result: TResult | null;
  extraData?: TExtra | null;
  error?: string | null;
}

const initialModuleState = {
  isAnalyzing: false,
  progress: 0,
  statusText: "",
  input: null,
  result: null,
  extraData: null,
  error: null,
};

interface AnalysisContextValue {
  activeModule: AnalysisMode;
  setActiveModule: (mode: AnalysisMode) => void;
  textState: AnalysisState<string>;
  imageState: AnalysisState<string>;
  videoState: AnalysisState<VideoAnalysisInput>;
  audioState: AnalysisState<AudioAnalysisInput>;
  documentState: AnalysisState<DocumentAnalysisInput>;
  urlState: AnalysisState<string>;
  qrState: AnalysisState<string, QrForensicReport>;

  runTextAnalysis: (
  text: string,
  options?: { enableTruthAnalysis?: boolean }
) => Promise<void>;
  runImageAnalysis: (imageData: string, signals?: ImageAnalysisSignals, forensics?: ForensicBundle | null) => Promise<void>;
  runVideoAnalysis: (body: VideoAnalysisInput) => Promise<void>;
  runAudioAnalysis: (audioBase64: string, mimeType: string, filename: string) => Promise<void>;
  runDocumentAnalysis: (fileData: string, mime: string, filename: string, signals?: JsonRecord) => Promise<void>;
  runUrlAnalysis: (url: string) => Promise<void>;
  runQrAnalysis: (qrInput: string | HTMLImageElement | HTMLCanvasElement, overrideRawText?: string) => Promise<void>;

  clearAnalysis: (mode: AnalysisMode) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | undefined>(undefined);

export const AnalysisProvider = ({ children }: { children: ReactNode }) => {
  const { user, token } = useAuth();
  const [activeModule, setActiveModule] = useState<AnalysisMode>("text");

  const [textState, setTextState] = useState<AnalysisState<string>>(initialModuleState);
  const [imageState, setImageState] = useState<AnalysisState<string>>(initialModuleState);
  const [videoState, setVideoState] = useState<AnalysisState<VideoAnalysisInput>>(initialModuleState);
  const [audioState, setAudioState] = useState<AnalysisState<AudioAnalysisInput>>(initialModuleState);
  const [documentState, setDocumentState] = useState<AnalysisState<DocumentAnalysisInput>>(initialModuleState);
  const [urlState, setUrlState] = useState<AnalysisState<string>>(initialModuleState);
  const [qrState, setQrState] = useState<AnalysisState<string, QrForensicReport>>(initialModuleState);

  const saveScanToDb = async (
  scanType: string,
  label: string,
  verdict: string | null,
  confidence: number | null,
  details: object
) => {
  const payload = {
  user_id: user?.id || "guest-user",
  scan_type: scanType,
  input_label: label.slice(0, 80),
  file_path: null,

  // Actual ML result
  verdict: verdict || "unknown",
  confidence: Number(confidence) || 0,

  source_type: scanType,
  details: details || {},
  effects: [],
  created_at: new Date().toISOString(),
};

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // Save scan to local MongoDB backend
  try {
    const response = await fetch(`${API_BASE_URL}/api/scans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.error || "Unable to save the scan");
    }
  } catch (error) {
    console.error("MongoDB scan save failed:", error);
    if (scanType === "image" || scanType === "text") {
      throw new Error("Analysis completed, but the scan could not be saved. Please try again.");
    }
  }

  // Save analysis log to local MongoDB backend
  try {
    const response = await fetch(`${API_BASE_URL}/api/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        log_type: "forensic_scan",
        scan_type: scanType,
        label,
        verdict,
        confidence,
        user_id: user?.id || "guest",
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to save the analysis log");
    }
  } catch (error) {
    console.error("MongoDB log save failed:", error);
  }
};

  const simulateProgress = <TInput, TResult, TExtra>(
    setter: React.Dispatch<React.SetStateAction<AnalysisState<TInput, TResult, TExtra>>>,
    statuses: string[],
    durationMs: number = 1000,
  ) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(0.98, elapsed / durationMs);
      const pct = Math.round(ratio * 100);
      const statusIdx = Math.floor(ratio * statuses.length);
      const statusText = statuses[Math.min(statusIdx, statuses.length - 1)];

      setter((prev) => (prev.isAnalyzing ? { ...prev, progress: pct, statusText } : prev));
      if (ratio >= 0.98) clearInterval(interval);
    }, 25);
    return interval;
  };

  // 1. Text Analysis
  // 1. Text Analysis
// 1. Text Analysis
const runTextAnalysis = async (
  text: string,
  options?: { enableTruthAnalysis?: boolean }
) => {
  const startTime = performance.now();

  setTextState({
    isAnalyzing: true,
    progress: 5,
    statusText: "Analyzing text claims & web evidence...",
    input: text,
    result: null,
    error: null,
  });

  const timer = simulateProgress(
    setTextState,
    [
      "Extracting claims...",
      "Searching fact-check sources...",
      "Searching news evidence...",
      "Comparing evidence with the claim...",
      "Finalizing evidence-based verdict...",
    ],
    1200
  );

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/verify/text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.trim(),
        }),
      }
    );

    const outerData = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        outerData?.error ||
          outerData?.detail ||
          "Evidence-based text verification failed"
      );
    }

    if (
      !outerData ||
      typeof outerData !== "object"
    ) {
      throw new Error(
        "Text verification returned an invalid response"
      );
    }

    /*
     * Node backend returns:
     *
     * {
     *   success: true,
     *   result: {
     *     verdict: "...",
     *     confidence: ...,
     *     ...
     *   }
     * }
     *
     * Always unwrap result safely.
     */
    const verificationData =
      outerData &&
      typeof outerData.result === "object" &&
      outerData.result !== null
        ? outerData.result
        : outerData;

    const resultRecord =
      verificationData as Record<string, unknown>;

    /* --------------------------------------------------------
       BASIC RESULT
       -------------------------------------------------------- */

    const rawVerdict = String(
      resultRecord.verdict ?? "UNVERIFIED"
    )
      .trim()
      .toUpperCase();

    const rawConfidence = Number(
      resultRecord.confidence ?? 0
    );

    const confidenceDecimal = Number.isFinite(
      rawConfidence
    )
      ? Math.max(
          0,
          Math.min(1, rawConfidence)
        )
      : 0;

    const confidencePercent =
      confidenceDecimal * 100;


    /* --------------------------------------------------------
       CLASSIFIER
       -------------------------------------------------------- */

    const classifier =
      resultRecord.classifier &&
      typeof resultRecord.classifier === "object"
        ? (resultRecord.classifier as {
            label?: string;
            raw_label?: string;
            confidence?: number;
            probabilities?: Record<
              string,
              number
            >;
            model?: string;
            device?: string;
          })
        : undefined;


    /* --------------------------------------------------------
       FACT CHECKS
       -------------------------------------------------------- */

    const factChecksRaw =
      Array.isArray(
        resultRecord.fact_checks
      )
        ? resultRecord.fact_checks
        : [];

    const factChecks = factChecksRaw.map(
      (item) => {
        const fact =
          item as Record<string, unknown>;

        return {
          claim:
            typeof fact.claim === "string"
              ? fact.claim
              : text,

          publisher:
            typeof fact.publisher === "string"
              ? fact.publisher
              : "Fact-check publisher",

          publisher_site:
            typeof fact.publisher_site === "string"
              ? fact.publisher_site
              : "",

          title:
            typeof fact.title === "string"
              ? fact.title
              : "",

          url:
            typeof fact.url === "string"
              ? fact.url
              : "",

          review_date:
            typeof fact.review_date === "string"
              ? fact.review_date
              : "",

          rating:
            typeof fact.rating === "string"
              ? fact.rating
              : "",

          normalized_rating:
            typeof fact.normalized_rating === "string"
              ? fact.normalized_rating
              : "",

          relevance_score:
            typeof fact.relevance_score === "number"
              ? fact.relevance_score
              : 0,

          publisher_quality:
            typeof fact.publisher_quality === "number"
              ? fact.publisher_quality
              : 0,

          relevant:
            fact.relevant === true,
        };
      }
    );


    /* --------------------------------------------------------
       WEB EVIDENCE
       -------------------------------------------------------- */

    const webEvidenceRaw =
      Array.isArray(
        resultRecord.web_evidence
      )
        ? resultRecord.web_evidence
        : [];

    const webEvidence =
      webEvidenceRaw.map(
        (item) => {
          const evidence =
            item as Record<string, unknown>;

          return {
            title:
              typeof evidence.title === "string"
                ? evidence.title
                : "Web evidence",

            publisher:
              typeof evidence.publisher === "string"
                ? evidence.publisher
                : "Unknown publisher",

            google_news_url:
              typeof evidence.google_news_url === "string"
                ? evidence.google_news_url
                : "",

            publisher_url:
              typeof evidence.publisher_url === "string"
                ? evidence.publisher_url
                : "",

            article_url:
              typeof evidence.article_url === "string"
                ? evidence.article_url
                : "",

            published:
              typeof evidence.published === "string"
                ? evidence.published
                : "",

            description:
              typeof evidence.description === "string"
                ? evidence.description
                : "",

            article_text:
              typeof evidence.article_text === "string"
                ? evidence.article_text
                : "",

            evidence_text:
              typeof evidence.evidence_text === "string"
                ? evidence.evidence_text
                : "",

            evidence_type:
              typeof evidence.evidence_type === "string"
                ? evidence.evidence_type
                : "",

            resolved:
              evidence.resolved === true,

            extracted:
              evidence.extracted === true,
          };
        }
      );


    /* --------------------------------------------------------
       EVIDENCE VERIFICATION
       -------------------------------------------------------- */

    const evidenceVerificationRaw =
      resultRecord.evidence_verification;

    const evidenceVerification =
      evidenceVerificationRaw &&
      typeof evidenceVerificationRaw === "object"
        ? (evidenceVerificationRaw as Record<
            string,
            unknown
          >)
        : null;


    const scoresRaw =
      evidenceVerification?.scores;

    const scores =
      scoresRaw &&
      typeof scoresRaw === "object"
        ? (scoresRaw as Record<string, unknown>)
        : {};


    const sourceSummaryRaw =
      evidenceVerification?.source_summary;

    const sourceSummary =
      sourceSummaryRaw &&
      typeof sourceSummaryRaw === "object"
        ? (sourceSummaryRaw as Record<
            string,
            unknown
          >)
        : {};


    /* --------------------------------------------------------
       EVIDENCE RESULTS
       -------------------------------------------------------- */

    const evidenceResultsRaw =
      Array.isArray(
        evidenceVerification?.evidence_results
      )
        ? evidenceVerification.evidence_results
        : [];

    const evidenceResults =
      evidenceResultsRaw.map(
        (item) => {
          const evidence =
            item as Record<string, unknown>;

          return {
            evidence:
              typeof evidence.evidence === "string"
                ? evidence.evidence
                : "",

            proposition_relationship:
              typeof evidence.proposition_relationship === "string"
                ? evidence.proposition_relationship
                : "UNKNOWN",

            proposition_confidence:
              typeof evidence.proposition_confidence === "number"
                ? evidence.proposition_confidence
                : 0,

            claim_relation:
              evidence.claim_relation ?? null,

            evidence_relation:
              evidence.evidence_relation ?? null,

            nli_verdict:
              typeof evidence.nli_verdict === "string"
                ? evidence.nli_verdict
                : "NOT_ENOUGH_INFO",

            nli_confidence:
              typeof evidence.nli_confidence === "number"
                ? evidence.nli_confidence
                : 0,

            final_evidence_verdict:
              typeof evidence.final_evidence_verdict === "string"
                ? evidence.final_evidence_verdict
                : "NOT_ENOUGH_INFO",

            correction_reason:
              typeof evidence.correction_reason === "string"
                ? evidence.correction_reason
                : "",

            evidence_score:
              typeof evidence.evidence_score === "number"
                ? evidence.evidence_score
                : 0,

            similarity:
              typeof evidence.similarity === "number"
                ? evidence.similarity
                : 0,

            keyword_overlap:
              typeof evidence.keyword_overlap === "number"
                ? evidence.keyword_overlap
                : 0,

            concept_overlap:
              typeof evidence.concept_overlap === "number"
                ? evidence.concept_overlap
                : 0,

            directness:
              typeof evidence.directness === "number"
                ? evidence.directness
                : 0,

            usefulness:
              typeof evidence.usefulness === "number"
                ? evidence.usefulness
                : 0,

            source:
              typeof evidence.source === "string"
                ? evidence.source
                : "Unknown source",

            source_quality:
              typeof evidence.source_quality === "number"
                ? evidence.source_quality
                : 0,

            evidence_type:
              typeof evidence.evidence_type === "string"
                ? evidence.evidence_type
                : "",

            title:
              typeof evidence.title === "string"
                ? evidence.title
                : "",

            url:
              typeof evidence.url === "string"
                ? evidence.url
                : "",

            published:
              typeof evidence.published === "string"
                ? evidence.published
                : "",
          };
        }
      );


    /* --------------------------------------------------------
       SOURCE RESULTS
       -------------------------------------------------------- */

    const sourceResultsRaw =
      Array.isArray(
        evidenceVerification?.source_results
      )
        ? evidenceVerification.source_results
        : [];

    const sourceResults =
      sourceResultsRaw.map(
        (item) => {
          const source =
            item as Record<string, unknown>;

          return {
            source:
              typeof source.source === "string"
                ? source.source
                : "Unknown source",

            source_quality:
              typeof source.source_quality === "number"
                ? source.source_quality
                : 0,

            verdict:
              typeof source.verdict === "string"
                ? source.verdict
                : "NOT_ENOUGH_INFO",

            strength:
              typeof source.strength === "number"
                ? source.strength
                : 0,

            evidence_count:
              typeof source.evidence_count === "number"
                ? source.evidence_count
                : 0,

            best_evidence:
              typeof source.best_evidence === "string"
                ? source.best_evidence
                : "",
          };
        }
      );


    /* --------------------------------------------------------
       PROBABILITIES
       -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       FINAL UI VERDICT
       -------------------------------------------------------- */

    const finalVerdict =
      rawVerdict === "REAL" ||
      rawVerdict === "FAKE" ||
      rawVerdict === "UNVERIFIED"
        ? rawVerdict
        : "UNVERIFIED";


    const enrichedData = {
      ...resultRecord,

      text:
        typeof resultRecord.text === "string"
          ? resultRecord.text
          : text,

      verdict: finalVerdict,

      confidence: confidenceDecimal,

      reason:
        typeof resultRecord.reason === "string"
          ? resultRecord.reason
          : "The claim was evaluated using available evidence.",

      classifier,

      fact_checks: factChecks,

      web_evidence: webEvidence,

      evidence_verification: {
        ...evidenceVerification,

        scores: {
          supports:
            typeof scores.supports === "number"
              ? scores.supports
              : 0,

          refutes:
            typeof scores.refutes === "number"
              ? scores.refutes
              : 0,

          neutral:
            typeof scores.neutral === "number"
              ? scores.neutral
              : 0,
        },

        source_summary: {
          total_sources:
            typeof sourceSummary.total_sources === "number"
              ? sourceSummary.total_sources
              : 0,

          supporting_sources:
            typeof sourceSummary.supporting_sources === "number"
              ? sourceSummary.supporting_sources
              : 0,

          refuting_sources:
            typeof sourceSummary.refuting_sources === "number"
              ? sourceSummary.refuting_sources
              : 0,

          neutral_sources:
            typeof sourceSummary.neutral_sources === "number"
              ? sourceSummary.neutral_sources
              : 0,

          conflicting_sources:
            typeof sourceSummary.conflicting_sources === "number"
              ? sourceSummary.conflicting_sources
              : 0,
        },

        evidence_results: evidenceResults,

        source_results: sourceResults,

        evidence_count:
          typeof evidenceVerification?.evidence_count === "number"
            ? evidenceVerification.evidence_count
            : evidenceResults.length,
      },

      executionTimeMs:
        Math.round(
          performance.now() - startTime
        ),

      speedMetrics: {
        totalMs:
          Math.round(
            performance.now() - startTime
          ),

        prepMs: 0,

        forensicMs: 0,

        aiInferenceMs: 0,

        throughputLabel:
          `${(
            text.length /
            ((performance.now() - startTime) / 1000 || 1)
          ).toFixed(0)} chars/sec`,
      },
    };


    /* --------------------------------------------------------
       FRONTEND STATE
       -------------------------------------------------------- */

    clearInterval(timer);

    setTextState((prev) => ({
      ...prev,
      isAnalyzing: false,
      progress: 100,
      statusText: "Analysis Complete",
      result: enrichedData,
      error: null,
    }));


    /* --------------------------------------------------------
       DATABASE
       -------------------------------------------------------- */

    await saveScanToDb(
      "text",
      text,
      finalVerdict,
      confidencePercent,
      enrichedData
    );


    toast.success(
      `Text verification completed in ${
        enrichedData.executionTimeMs
      }ms!`
    );

  } catch (err) {

    clearInterval(timer);

    const msg =
      err instanceof Error
        ? err.message
        : "Analysis failed";

    console.error(
      "[Text Verification]",
      err
    );

    setTextState((prev) => ({
      ...prev,
      isAnalyzing: false,
      progress: 0,
      statusText: "",
      error: msg,
      result: null,
    }));

    toast.error(
      "Text verification failed: " + msg
    );
  }
};

  // 2. Image Analysis
  const runImageAnalysis = async (imageData: string, signals?: ImageAnalysisSignals, forensics?: ForensicBundle | null) => {
    const startTime = performance.now();

    // 2. Start Progressive Analysis State
    setImageState({
      isAnalyzing: true,
      progress: 10,
      statusText: "Parsing EXIF metadata & computing FFT radial power spectrum...",
      input: imageData,
      result: null,
      extraData: { signals, forensics },
      error: null,
    });

    // 3. Fast Progressive Update: Immediately calculate local ensemble result
    const preliminaryEnsemble = buildForensicEnsemble(forensics, signals, null);
    setImageState((prev) => ({
      ...prev,
      progress: 40,
      statusText: "Running pretrained specialist model and forensic analysis...",
      result: {
        ...preliminaryEnsemble,
        isProgressive: true,
      },
    }));

    const timer = simulateProgress(
      setImageState,
      ["Running PRNU sensor noise validation...", "Detecting AI diffusion artifacts...", "Cross-verifying vision neural features...", "Finalizing ensemble consensus..."],
      1200
    );

    try {
      let aiResponse: SpecialistModelResult | null = null;

      // 4. Pretrained specialist ML model
      const mlUrl = "http://127.0.0.1:8000/predict/image";

try {
  // Convert the browser data URL into a Blob
  const imageBlob = await fetch(imageData).then((response) => response.blob());

  const formData = new FormData();
  formData.append("file", imageBlob, "verification-image.jpg");

  // Send image to local Python ML API
  const mlController = new AbortController();
  const mlTimeout = window.setTimeout(() => mlController.abort(), 120_000);
  let mlResponse: Response;

  try {
    mlResponse = await fetch(mlUrl, {
      method: "POST",
      body: formData,
      signal: mlController.signal,
    });
  } finally {
    window.clearTimeout(mlTimeout);
  }

  const responseText = await mlResponse.text();
  let mlData: unknown = null;
  try {
    mlData = responseText ? JSON.parse(responseText) : null;
  } catch {
    // Preserve the raw body in the error below for easier local debugging.
  }

  if (!mlResponse.ok) {
    throw new Error(
      `ML API returned HTTP ${mlResponse.status}: ${responseText || "empty response"}`
    );
  }

  if (
    typeof mlData === "object" &&
    mlData !== null &&
    "success" in mlData &&
    mlData.success === true &&
    "result" in mlData &&
    mlData.result
  ) {
    const modelResult = mlData.result as {
      verdict?: string;
      confidence?: number;
      fake_probability?: number;
      real_probability?: number;
      model?: string;
    };

    // Convert the specialist model response into
    // the structure used by the existing VeriFact pipeline.
    aiResponse = {
      verdict: modelResult.verdict,
      confidence: modelResult.confidence,
      fake_probability: modelResult.fake_probability,
      real_probability: modelResult.real_probability,
      model: modelResult.model,

      // Keep these empty for now.
      // We will populate them from actual forensic analysis later.
      effects: [],
      regions: [],
    };

  } else {
    throw new Error(
      `ML API returned an unexpected response shape: ${responseText || "empty response"}`
    );
  }
} catch (e) {
  console.error("[Image ML] Request failed");

  throw e;
}

      // 5. Final result: specialist model is primary; forensic analysis is supporting evidence.
      const forensicEnsemble = buildForensicEnsemble(
  forensics,
  signals,
  aiResponse
);
      const modelVerdict = String(aiResponse?.verdict ?? "").trim().toUpperCase();
      const isSpecialistFake =
  modelVerdict === "FAKE" ||
  modelVerdict === "AI-GENERATED" ||
  modelVerdict === "AI_GENERATED" ||
  modelVerdict === "AI GENERATED";
      const specialistConfidence = aiResponse
  ? asFiniteNumber(aiResponse.confidence) ?? 0
  : 0;
      const specialistFakeProbability = aiResponse
  ? asFiniteNumber(aiResponse.fake_probability) ?? 0
  : 0;
      const specialistRealProbability = aiResponse
  ? asFiniteNumber(aiResponse.real_probability) ??
    (modelVerdict === "REAL"
      ? specialistConfidence
      : 100 - specialistConfidence)
  : 0;

      let finalEnsemble: ImageAnalysisResult;

      if (aiResponse) {
  finalEnsemble = {
    ...forensicEnsemble,

    // PRIMARY MODEL RESULT
    classification: isSpecialistFake
      ? "AI Generated Image"
      : "Real Camera Photograph",

    category: isSpecialistFake
      ? "manipulated"
      : "authentic",

    verdict: isSpecialistFake
      ? "AI Generated Image"
      : "Authentic Image",

    verdictTag: isSpecialistFake
      ? "AI Generated"
      : "Original Photo",

    isAuthentic: !isSpecialistFake,

    confidence: specialistConfidence,

    fakeProbability: specialistFakeProbability,

    realProbability: specialistRealProbability,

    primaryMetric: {
      label: isSpecialistFake
        ? "AI Generated Probability"
        : "Authenticity Probability",
      value: isSpecialistFake
        ? specialistFakeProbability
        : specialistRealProbability,
    },

    model: aiResponse.model,

    specialistModelResult: aiResponse,

    plainExplanation: isSpecialistFake
      ? `The pretrained deepfake detection model classified this image as AI-generated with ${specialistConfidence.toFixed(2)}% confidence.`
      : `The pretrained deepfake detection model classified this image as authentic with ${specialistConfidence.toFixed(2)}% confidence.`,

    forensicEvidence: forensicEnsemble,
  };
      } else {
  throw new Error(
    "The pretrained image detection model did not return a result."
  );
}

clearInterval(timer);

      const elapsedMs = Math.round(performance.now() - startTime);
      const speedMetrics = {
        totalMs: elapsedMs,
        prepMs: Math.round(elapsedMs * 0.15),
        forensicMs: Math.round(elapsedMs * 0.40),
        aiInferenceMs: Math.round(elapsedMs * 0.45),
        throughputLabel: `${((imageData.length * 0.75) / (1024 * 1024) / (elapsedMs / 1000 || 1)).toFixed(1)} MB/s`,
        isCached: false,
      };

      const modelConfidence = specialistConfidence;
      const modelFakeProbability = specialistFakeProbability;
      const modelRealProbability = specialistRealProbability;
      const isModelFake = isSpecialistFake;

const enrichedData = {
  // Keep forensic information
  ...finalEnsemble,

  // PRIMARY MODEL RESULT
  confidence: modelConfidence,

  fakeProbability: modelFakeProbability,

  realProbability: modelRealProbability,

  verdict: aiResponse
    ? (isModelFake ? "AI Generated Image" : "Authentic Image")
    : finalEnsemble.verdictTag,

  verdictTag: aiResponse
    ? (isModelFake ? "AI Generated" : "Original Photo")
    : finalEnsemble.verdictTag,

  category: aiResponse
    ? (isModelFake ? "manipulated" : "authentic")
    : finalEnsemble.category,

  isAuthentic: aiResponse
    ? !isModelFake
    : finalEnsemble.category === "authentic",

  primaryMetric: aiResponse
    ? { label: "AI Generated Probability", value: modelFakeProbability }
    : finalEnsemble.primaryMetric,

  analysis: aiResponse
    ? (
        isModelFake
          ? `The specialist image detection model classified this image as AI-generated with ${modelConfidence.toFixed(2)}% confidence. The forensic analysis provides supporting evidence.`
          : `The specialist image detection model classified this image as authentic with ${modelConfidence.toFixed(2)}% confidence. The forensic analysis provides supporting evidence.`
      )
    : finalEnsemble.plainExplanation,

  // Make the displayed AI-generation score use the model
  detectionScores: {
    ...(finalEnsemble.detectionScores ?? {}),
    aiGeneration: modelFakeProbability,
  },

  specialistModelResult: aiResponse,
forensicEvidence: finalEnsemble,
modelUsed:
  aiResponse?.model ||
  "deepfake-detector-model-v1",

  effects: [],
  regions: [],

  speedMetrics,
  executionTimeMs: elapsedMs,
      };
      // Store in high-speed cache

      setImageState((prev) => ({
        ...prev,
        isAnalyzing: false,
        progress: 100,
        statusText: "Analysis Complete",
        result: enrichedData,
      }));

      await saveScanToDb(
  "image",
  "Image scan",
  enrichedData.verdict,
  Number(enrichedData.confidence ?? 0),
  enrichedData
);
      toast.success(`Multi-Model Analysis completed in ${elapsedMs}ms!`);
    } catch (err) {
      clearInterval(timer);
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setImageState((prev) => ({
        ...prev,
        isAnalyzing: false,
        progress: 0,
        statusText: "",
        error: msg,
        result: null,
      }));
      toast.error("Image analysis failed: " + msg);
    }
  };

  // 3. Video Analysis
  const runVideoAnalysis = async (body: VideoAnalysisInput) => {
  const startTime = performance.now();

  setVideoState({
    isAnalyzing: true,
    progress: 5,
    statusText: "Uploading video to forensic analysis engine...",
    input: body,
    result: null,
    error: null,
  });

  const timer = simulateProgress(
    setVideoState,
    [
      "Uploading video...",
      "Extracting video frames...",
      "Running VideoMAE deepfake detection...",
      "Aggregating forensic evidence...",
    ],
    4000
  );

  try {
    /*
     * The VideoVerification UI keeps the local video source in `body.src`.
     * Convert that source back into a File so the Node backend can receive
     * the original video through multipart/form-data.
     */
    if (!body?.src) {
      throw new Error("Video source is missing.");
    }

    const videoResponse = await fetch(body.src);

    if (!videoResponse.ok) {
      throw new Error("Unable to read the selected video.");
    }

    const videoBlob = await videoResponse.blob();

    const filename =
  `video-${Date.now()}.${videoBlob.type?.split("/")[1] || "mp4"}`;

    const videoFile = new File(
      [videoBlob],
      filename,
      {
        type: videoBlob.type || "video/mp4",
      }
    );

    const formData = new FormData();
    formData.append("video", videoFile);

    const response = await fetch(
      "http://127.0.0.1:5000/api/analyze/video",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    clearInterval(timer);

    if (!response.ok || data?.success !== true) {
      throw new Error(
        data?.error || "Video verification failed."
      );
    }

    const elapsedMs = Math.round(performance.now() - startTime);

    const frameCount =
      data?.result?.frames_analyzed ||
      body?.frames?.length ||
      16;

    const speedMetrics = {
      totalMs: elapsedMs,
      prepMs: Math.round(elapsedMs * 0.25),
      forensicMs: Math.round(elapsedMs * 0.35),
      aiInferenceMs: Math.round(elapsedMs * 0.40),
      throughputLabel: `${(
        frameCount /
        (elapsedMs / 1000 || 1)
      ).toFixed(1)} FPS`,
    };

    /*
     * Keep the existing frontend result structure as much as possible,
     * while adding the real backend verification result.
     */
    const backendVerdict = data.result?.verdict || "UNVERIFIED";
const realProbability = Number(data.result?.real_probability ?? 0);
const fakeProbability = Number(data.result?.fake_probability ?? 0);
const confidence = Number(data.result?.confidence ?? 0);
const riskLevel = data.result?.risk_level || "MEDIUM";

const enrichedData = {
  ...data.result,

  video: data.video,
  model: data.model,

  speedMetrics,
  executionTimeMs: elapsedMs,

  // Adapt backend verdict to the existing Video UI.
  verdictTag:
    backendVerdict === "REAL"
      ? "Original"
      : backendVerdict === "FAKE"
        ? "Deepfake Suspected"
        : "Edited",

  // Existing UI expects an object, not a number.
  trustScore: {
    level:
      riskLevel === "LOW"
        ? "Low Risk"
        : riskLevel === "HIGH"
          ? "High Risk"
          : "Medium Risk",
    score: realProbability,
  },

  // Existing UI expects { label, value }.
  primaryMetric: {
    label: "Authenticity Probability",
    value: realProbability,
  },

  plainExplanation:
    backendVerdict === "REAL"
      ? `The VideoMAE detector estimates ${realProbability.toFixed(2)}% probability that this video is authentic.`
      : backendVerdict === "FAKE"
        ? `The VideoMAE detector estimates ${fakeProbability.toFixed(2)}% probability that this video contains synthetic or manipulated content.`
        : `The VideoMAE detector estimates ${fakeProbability.toFixed(2)}% fake probability and ${realProbability.toFixed(2)}% real probability, so the result requires caution.`,

  // Keep the actual backend probabilities available.
  // VideoMAE currently returns aggregate real/fake probabilities.
// It does not provide separate facial, lip-sync, temporal-jump,
// or GAN-artifact scores, so do not display fabricated values.
detectionScores: undefined,

  timeline: Array.isArray(data.result?.timestamps)
    ? data.result.timestamps.map(
        (timestamp: unknown, index: number) => ({
          timestamp: Number(timestamp) || 0,
          type: "visual" as const,
          severity:
            backendVerdict === "FAKE"
              ? "high" as const
              : backendVerdict === "SUSPICIOUS"
                ? "medium" as const
                : "low" as const,
          label: `Analyzed frame ${index + 1}`,
          note: "VideoMAE temporal frame analysis",
        })
      )
    : [],

  frameFlags: {
    suspiciousFrames: data.result?.suspicious_frames ?? 0,
    framesAnalyzed:
      data.result?.frames_analyzed ?? frameCount,
  },
};

    setVideoState((prev) => ({
      ...prev,
      isAnalyzing: false,
      progress: 100,
      statusText: "Analysis Complete",
      result: enrichedData,
    }));

  } catch (error) {
    clearInterval(timer);

    const message =
      error instanceof Error
        ? error.message
        : "Video analysis failed.";

    setVideoState((prev) => ({
      ...prev,
      isAnalyzing: false,
      progress: 0,
      statusText: "",
      error: message,
      result: null,
    }));

    toast.error("Video analysis failed: " + message);
  }
};

  // 4. Audio Analysis
 const runAudioAnalysis = async (
  audioBase64: string,
  mimeType: string,
  filename: string
) => {
  setAudioState((prev) => ({
    ...prev,
    isAnalyzing: true,
    error: null,
  }));

  try {
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const audioBlob = new Blob([bytes], {
      type: mimeType || "audio/wav",
    });

    const formData = new FormData();
    formData.append("file", audioBlob, filename);

    const response = await fetch(
      `${import.meta.env.VITE_ML_API_URL || "http://localhost:8000"}/predict/audio`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || "Audio verification request failed."
      );
    }

    const isFake = data.verdict === "AI_GENERATED";

    const result = {
      verdictTag: isFake
        ? "AI GENERATED VOICE"
        : "REAL AUDIO",
      confidence: Number(data.confidence ?? 0),
      category: isFake ? "fake" : "authentic",
      isAuthentic: !isFake,
      probabilities: {
        real: Number(data.bonafide_probability ?? 0),
        aiGenerated: Number(data.spoof_probability ?? 0),
        voiceCloned: 0,
        manipulated: 0,
        editedSpeech: 0,
        suspicious: 0,
      },
      transcript: "",
      durationSec: Number(data.duration_seconds ?? 0),
      reasons: [
        "Prediction generated by the integrated Wav2Vec2 audio detector.",
        `Analyzed ${Number(data.windows_analyzed ?? 0)} audio window(s).`,
        "Voice cloning, editing, and individual tampering events are not independently detected by this model.",
      ],
      aiExplanation:
        data.disclaimer ||
        "This is a model prediction and does not guarantee authenticity.",
    };

    setAudioState((prev) => ({
      ...prev,
      isAnalyzing: false,
      result,
      error: null,
    }));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Audio verification failed.";

    setAudioState((prev) => ({
      ...prev,
      isAnalyzing: false,
      error: message,
    }));

    toast.error(message);
  }
};

  // 5. Document Analysis
  const runDocumentAnalysis = async (fileData: string, mime: string, filename: string, signals?: JsonRecord) => {
    const startTime = performance.now();
    setDocumentState({
      isAnalyzing: true,
      progress: 5,
      statusText: "Extracting text, OCR & document metadata...",
      input: { fileData, mime, filename },
      result: null,
      extraData: { signals },
      error: null,
    });

    const timer = simulateProgress(setDocumentState, ["Running OCR text extraction...", "Analyzing layout & font consistency...", "Checking producer & author metadata...", "Verifying digital signatures & stamps..."], 3500);

    try {
      const { data, error } = await supabase.functions.invoke("verify-document", {
        body: { fileData, mime, filename, signals },
      });
      clearInterval(timer);
      if (error) throw error;

      const elapsedMs = Math.round(performance.now() - startTime);
      const speedMetrics = {
        totalMs: elapsedMs,
        prepMs: Math.round(elapsedMs * 0.22),
        forensicMs: Math.round(elapsedMs * 0.38),
        aiInferenceMs: Math.round(elapsedMs * 0.40),
        throughputLabel: `${((fileData.length * 0.75) / (1024 * 1024) / (elapsedMs / 1000 || 1)).toFixed(1)} MB/s`,
      };
      const enrichedData = { ...data, speedMetrics, executionTimeMs: elapsedMs };

      setDocumentState((prev) => ({
        ...prev,
        isAnalyzing: false,
        progress: 100,
        statusText: "Analysis Complete",
        result: enrichedData,
      }));

      saveScanToDb("document", filename || "Document scan", enrichedData.verdict === "Real" ? "authentic" : "suspicious", enrichedData.confidence, enrichedData);
      toast.success(`Document Verification completed in ${elapsedMs}ms!`);
    } catch (err) {
      clearInterval(timer);
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setDocumentState((prev) => ({
        ...prev,
        isAnalyzing: false,
        progress: 0,
        statusText: "",
        error: msg,
        result: { verdict: "Suspicious", authenticityScore: 0, confidence: 0, analysis: "An error occurred during analysis." },
      }));
      toast.error("Document analysis failed: " + msg);
    }
  };

  // 6. URL Analysis
  const runUrlAnalysis = async (url: string) => {
    const startTime = performance.now();
    setUrlState({
      isAnalyzing: true,
      progress: 5,
      statusText: "Fetching domain WHOIS, SSL & Safe Browsing data...",
      input: url,
      result: null,
      error: null,
    });

    const timer = simulateProgress(setUrlState, ["Checking domain registration date...", "Verifying SSL certificate...", "Querying Safe Browsing database...", "Analyzing website content credibility..."], 3000);

    try {
      const { data, error } = await supabase.functions.invoke("verify-url", { body: { url } });
      clearInterval(timer);
      if (error) throw error;

      const elapsedMs = Math.round(performance.now() - startTime);
      const speedMetrics = {
        totalMs: elapsedMs,
        prepMs: Math.round(elapsedMs * 0.30),
        forensicMs: Math.round(elapsedMs * 0.30),
        aiInferenceMs: Math.round(elapsedMs * 0.40),
        throughputLabel: `${(1000 / (elapsedMs || 1)).toFixed(1)} req/s`,
      };
      const enrichedData = { ...data, speedMetrics, executionTimeMs: elapsedMs };

      setUrlState((prev) => ({
        ...prev,
        isAnalyzing: false,
        progress: 100,
        statusText: "Analysis Complete",
        result: enrichedData,
      }));

      saveScanToDb("url", url, enrichedData.category, enrichedData.confidence, enrichedData);
      toast.success(`URL Analysis completed in ${elapsedMs}ms!`);
    } catch (err) {
      clearInterval(timer);
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setUrlState((prev) => ({
        ...prev,
        isAnalyzing: false,
        progress: 0,
        statusText: "",
        error: msg,
        result: { isCredible: false, confidence: 0, category: "misinformation", analysis: "An error occurred during analysis." },
      }));
      toast.error("URL analysis failed: " + msg);
    }
  };

  // 7. QR Code Analysis
    // 7. QR Code Analysis
  const runQrAnalysis = async (
    qrInput: string | HTMLImageElement | HTMLCanvasElement,
    overrideRawText?: string,
  ) => {
    const startTime = performance.now();
    const inputKey =
      typeof qrInput === "string"
        ? qrInput
        : overrideRawText || "qr_image";

    // 1. Check the existing QR result cache.
    const contentHash = await computeContentHash(inputKey);
    const cachedResult = getCachedResult<QrForensicReport>(
      contentHash,
      "qr",
    );

    if (cachedResult) {
      const cacheHitTime = Math.round(performance.now() - startTime);

      const enrichedCached = {
        ...cachedResult,
        speedMetrics: {
          ...cachedResult.speedMetrics,
          totalMs: cacheHitTime,
          isCached: true,
          throughputLabel: "Instant (Cached)",
        },
        executionTimeMs: cacheHitTime,
      };

      setQrState({
        isAnalyzing: false,
        progress: 100,
        statusText: "Complete (Cached)",
        input: inputKey,
        result: enrichedCached,
        error: null,
      });

      await saveScanToDb(
        "qr",
        "QR Scan (Cached)",
        enrichedCached.verdict,
        enrichedCached.securityScore,
        enrichedCached,
      );

      toast.success(`QR Analysis loaded from cache in ${cacheHitTime}ms!`);
      return;
    }

    // 2. Start progressive analysis.
    setQrState({
      isAnalyzing: true,
      progress: 10,
      statusText: "Decoding QR matrix pattern & physical border geometry...",
      input: inputKey,
      result: null,
      error: null,
    });

    const timer = simulateProgress(
      setQrState,
      [
        "Decoding QR payload...",
        "Checking URL structure and destination...",
        "Analyzing local forensic indicators...",
        "Finalizing QR security assessment...",
      ],
      1200,
    );

    try {
      // 3. Decode QR content and preserve physical forensic analysis.
      let rawText = overrideRawText || "";

      let physicalData: PhysicalQrAnalysis = {
        hasQr: true,
        rawText: overrideRawText || "",
        isStickerOverlay: false,
        overlayConfidence: 0,
        alignmentConsistency: 100,
        boundaryNoiseStd: 0,
      };

      let imageDataUrl: string | null = null;

      if (
        !overrideRawText &&
        (typeof qrInput !== "string" ||
          qrInput.startsWith("data:image/"))
      ) {
        let imgElem: HTMLImageElement | HTMLCanvasElement;

        if (typeof qrInput === "string") {
          imgElem = await new Promise<HTMLImageElement>(
            (resolve, reject) => {
              const img = new Image();

              img.onload = () => resolve(img);
              img.onerror = () =>
                reject(new Error("Unable to load the QR image."));

              img.src = qrInput;
            },
          );

          imageDataUrl = qrInput;
        } else {
          imgElem = qrInput;

          if (qrInput instanceof HTMLCanvasElement) {
            imageDataUrl = qrInput.toDataURL("image/png");
          } else {
            imageDataUrl = qrInput.src;

            // Convert the image to a data URL when possible.
            try {
              const canvas = document.createElement("canvas");
              canvas.width = qrInput.naturalWidth || qrInput.width;
              canvas.height = qrInput.naturalHeight || qrInput.height;

              const context = canvas.getContext("2d");

              if (context && canvas.width > 0 && canvas.height > 0) {
                context.drawImage(qrInput, 0, 0);
                imageDataUrl = canvas.toDataURL("image/png");
              }
            } catch {
              // Keep the original image URL; local decoding can still work.
            }
          }
        }

        physicalData = await decodeQrImage(imgElem);
        rawText = physicalData.rawText || "";
      }

      // A plain string may already be the decoded QR content.
      if (!rawText && typeof qrInput === "string") {
        if (qrInput.startsWith("data:image/")) {
          throw new Error(
            "No readable QR code was detected. Try a clearer image.",
          );
        }

        rawText = qrInput.trim();
      }

      if (!rawText) {
        throw new Error(
          "No readable QR code was detected. Please try a clearer image.",
        );
      }

      // 4. Run the existing local QR forensic engine.
      const localReport: QrForensicReport = analyzeQrForensics(
        rawText,
        physicalData,
      );

      setQrState((prev) => ({
        ...prev,
        progress: 50,
        statusText: "Checking decoded QR content with the verification API...",
        result: {
          ...localReport,
          isProgressive: true,
        },
      }));

      // 5. Call FastAPI only when the original input is an image.
      // The FastAPI /verify/qr endpoint requires multipart field "file".
      let aiResponse: QrAiResponse | null = null;

      try {
        if (imageDataUrl) {
          const imageResponse = await fetch(imageDataUrl);

          if (!imageResponse.ok) {
            throw new Error("Unable to read the QR image data.");
          }

          const imageBlob = await imageResponse.blob();

          const mimeType = imageBlob.type || "image/png";

          if (
            !["image/png", "image/jpeg", "image/webp"].includes(mimeType)
          ) {
            throw new Error(
              `Unsupported QR image type: ${mimeType}. Use PNG, JPEG, or WEBP.`,
            );
          }

          const formData = new FormData();

          formData.append("file", imageBlob, `qr-image.${mimeType.split("/")[1]}`);

          const mlApiUrl =
            import.meta.env.VITE_ML_API_URL || "http://localhost:8000";

          const response = await fetch(`${mlApiUrl}/verify/qr`, {
            method: "POST",
            body: formData,
          });

          const data = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(
              data?.detail ||
                `QR verification API returned HTTP ${response.status}.`,
            );
          }

          if (!data?.success || data.qr_detected !== true) {
            throw new Error("The backend could not decode this QR code.");
          }

          if (data.content_type === "url" && data.url_analysis) {
            const urlResult = data.url_analysis as Record<string, unknown>;

            const backendVerdict = String(
              urlResult.verdict || "UNVERIFIED",
            ).toUpperCase();

            const backendScore = Number(urlResult.security_score);

            let mappedVerdict: QrForensicReport["verdict"] | undefined;
            let mappedRisk: QrRiskLevel | undefined;
            let mappedAction:
              | QrForensicReport["recommendedAction"]
              | undefined;

            if (backendVerdict === "MALICIOUS") {
              mappedVerdict = "Scam / Phishing Attack";
              mappedRisk = "Critical Risk";
              mappedAction = "High-Risk Destination — Block Immediately";
            } else if (backendVerdict === "SUSPICIOUS") {
              mappedVerdict = "Suspicious";
              mappedRisk = "High Risk";
              mappedAction = "Do Not Open";
            } else if (backendVerdict === "LEGITIMATE") {
              mappedVerdict = "Legitimate";
              mappedRisk = "Low Risk";
              mappedAction = "Proceed With Caution";
            } else {
              mappedVerdict = "Unverified";
              mappedRisk = "Medium Risk";
              mappedAction = "Verify Destination Before Opening";
            }

            aiResponse = {
              verdict: mappedVerdict,
              securityScore: Number.isFinite(backendScore)
                ? Math.max(0, Math.min(100, backendScore))
                : undefined,
              riskLevel: mappedRisk,
              recommendedAction: mappedAction,
              analysis:
                typeof urlResult.message === "string"
                  ? urlResult.message
                  : `The QR code was decoded. URL classification: ${backendVerdict}. Structural URL checks do not prove that a destination is safe.`,
            };
          } else if (data.content_type === "text") {
            aiResponse = {
              verdict: "Unverified",
              riskLevel: "Medium Risk",
              recommendedAction: "Verify Content Before Acting",
              analysis:
                "The QR code contains text rather than an HTTP or HTTPS URL. The backend decoded the content but did not independently verify its authenticity.",
            };
          }
        } else {
          // Decoded text cannot be uploaded to this image-only endpoint.
          // Local forensic analysis remains available for text-only input.
          console.info(
            "QR input is already decoded text; using local forensic analysis.",
          );
        }
      } catch (error) {
        // Keep local analysis if the API is unavailable.
        console.warn(
          "FastAPI QR verification unavailable; retaining local forensic analysis:",
          error,
        );
      }

      // 6. Finalize results.
      clearInterval(timer);

      const elapsedMs = Math.round(performance.now() - startTime);

      const speedMetrics: SpeedMetrics = {
        totalMs: elapsedMs,
        prepMs: Math.round(elapsedMs * 0.2),
        forensicMs: Math.round(elapsedMs * 0.4),
        aiInferenceMs: Math.round(elapsedMs * 0.4),
        throughputLabel: `${(1000 / (elapsedMs || 1)).toFixed(1)} scan/s`,
        isCached: false,
      };

      const finalReport: QrForensicReport & {
        speedMetrics: SpeedMetrics;
        executionTimeMs: number;
      } = {
        ...localReport,
        verdict: aiResponse?.verdict || localReport.verdict,
        securityScore:
          aiResponse?.securityScore != null
            ? Math.min(localReport.securityScore, aiResponse.securityScore)
            : localReport.securityScore,
        riskLevel: aiResponse?.riskLevel || localReport.riskLevel,
        recommendedAction:
          aiResponse?.recommendedAction || localReport.recommendedAction,
        plainExplanation:
          aiResponse?.analysis || localReport.plainExplanation,
        speedMetrics,
        executionTimeMs: elapsedMs,
      };

      // 7. Preserve the existing SHA-256 cache.
      setCachedResult(contentHash, "qr", finalReport);

      setQrState((prev) => ({
        ...prev,
        isAnalyzing: false,
        progress: 100,
        statusText: "Analysis Complete",
        result: finalReport,
        error: null,
      }));

      await saveScanToDb(
        "qr",
        `QR: ${localReport.payloadType}`,
        finalReport.verdict,
        finalReport.securityScore,
        finalReport,
      );

      toast.success(`QR Analysis completed in ${elapsedMs}ms!`);
    } catch (err) {
      clearInterval(timer);

      const msg =
        err instanceof Error ? err.message : "QR analysis failed.";

      setQrState((prev) => ({
        ...prev,
        isAnalyzing: false,
        progress: 0,
        statusText: "",
        error: msg,
        result: null,
      }));

      toast.error("QR code analysis failed: " + msg);
    }
  };

  const clearAnalysis = (mode: AnalysisMode) => {
    switch (mode) {
      case "text": setTextState(initialModuleState); break;
      case "image": setImageState(initialModuleState); break;
      case "video": setVideoState(initialModuleState); break;
      case "audio": setAudioState(initialModuleState); break;
      case "document": setDocumentState(initialModuleState); break;
      case "url": setUrlState(initialModuleState); break;
      case "qr": setQrState(initialModuleState); break;
    }
  };

  return (
    <AnalysisContext.Provider
      value={{
        activeModule,
        setActiveModule,
        textState,
        imageState,
        videoState,
        audioState,
        documentState,
        urlState,
        qrState,
        runTextAnalysis,
        runImageAnalysis,
        runVideoAnalysis,
        runAudioAnalysis,
        runDocumentAnalysis,
        runUrlAnalysis,
        runQrAnalysis,
        clearAnalysis,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
};
