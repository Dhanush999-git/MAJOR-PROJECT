import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { audioBase64, mimeType, filename } = await req.json();
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "audioBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mt = mimeType || "audio/mpeg";
    console.log(`[verify-audio] analyzing ${filename || "audio"} (${mt})`);

    const systemPrompt = `You are an elite forensic AUDIO verification engine for the Verifact platform.
You emulate an ensemble of specialized models:
- OpenAI Whisper for speech-to-text transcription.
- Wav2Vec 2.0 for voice pattern + synthetic-speech detection.
- ECAPA-TDNN for speaker verification + voice-clone identification.
- Librosa for low-level forensic signal analysis (silence, pitch, MFCC, spectral flux).
- CNN-based mel-spectrogram analysis for deepfake voice detection.
- Fake-news NLP on transcript: pass the transcript through your fake-news/misinformation reasoner.

Run the following layers on the supplied audio and combine them with an ensemble decision:

LAYER 1 — Speech-to-Text (Whisper): transcribe spoken content. Detect language. Capture filler words, hesitations, prosody hints.
LAYER 2 — Voice Pattern (Wav2Vec2): score how natural the voice sounds vs synthetic TTS / neural vocoder artifacts.
LAYER 3 — Speaker Verification (ECAPA-TDNN): detect speaker switches, voice cloning artifacts, embedding drift between segments.
LAYER 4 — Forensic Signal (Librosa): unnatural silence padding, repeated noise loops, pitch quantization, spectral discontinuities, splice points, codec re-encoding artifacts.
LAYER 5 — Spectrogram CNN: mel-spectrogram anomalies typical of deepfake voices, GAN vocoders, diffusion TTS.
LAYER 6 — Fake-news NLP on transcript: pass the transcript through your fake-news/misinformation reasoner.

ENSEMBLE: produce six probabilities that SUM TO 100:
  realProbability + aiGeneratedProbability + voiceClonedProbability + manipulatedProbability + editedSpeechProbability + suspiciousProbability = 100

Map the winner to verdictTag:
  Real → "REAL AUDIO"
  AI-Generated → "AI GENERATED VOICE"
  Voice-Cloned → "VOICE CLONED"
  Manipulated → "MANIPULATED AUDIO"
  Edited → "EDITED SPEECH"
  Suspicious → "SUSPICIOUS CONTENT"

Return ONLY valid JSON, no markdown:
{
  "verdictTag": "REAL AUDIO" | "AI GENERATED VOICE" | "VOICE CLONED" | "MANIPULATED AUDIO" | "EDITED SPEECH" | "SUSPICIOUS CONTENT",
  "confidence": number,
  "category": "authentic" | "suspicious" | "fake",
  "isAuthentic": boolean,
  "probabilities": {
    "real": number,
    "aiGenerated": number,
    "voiceCloned": number,
    "manipulated": number,
    "editedSpeech": number,
    "suspicious": number
  },
  "transcript": "full speech-to-text transcript (empty string if no speech detected)",
  "language": "ISO language code or 'unknown'",
  "speakerCount": number,
  "durationSec": number,
  "forensicScores": {
    "syntheticSpeech": number,
    "voiceCloneLikelihood": number,
    "spliceDetection": number,
    "speakerInconsistency": number,
    "spectrogramAnomaly": number,
    "unnaturalSilence": number,
    "roboticPitchVariation": number,
    "backgroundNoiseAnomaly": number,
    "codecReencoding": number
  },
  "reasons": ["short bullets such as 'Speaker mismatch detected at 0:14', 'Robotic pitch pattern found', 'Spectrogram anomaly in 2-4kHz band', 'Unnatural silence padding before splice'"],
  "tamperingEvents": [
    { "timestampSec": number, "type": "splice" | "insertion" | "cut" | "speaker-change" | "noise-loop", "severity": "low" | "medium" | "high", "note": "1 sentence" }
  ],
  "transcriptFakeNews": {
    "verdict": "Real" | "Misleading" | "Fake" | "N/A",
    "probabilities": { "real": number, "misleading": number, "fake": number },
    "summary": "1-3 sentences. If transcript empty, set verdict='N/A' and probabilities all 0."
  },
  "aiExplanation": "plain-English paragraph explaining WHY the verdict was chosen, citing forensic signals"
}

Rules:
- All scores are 0-100.
- "confidence" = the WINNING probability.
- "isAuthentic" = (verdictTag === "REAL AUDIO").
- "category": REAL AUDIO → "authentic"; SUSPICIOUS CONTENT or EDITED SPEECH → "suspicious"; AI GENERATED VOICE / VOICE CLONED / MANIPULATED AUDIO → "fake".
- Be decisive. Cite specific timestamps when possible.`;

    const response = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze this audio file (${filename || "upload"}). Run the full 6-layer forensic pipeline and return ensemble JSON.` },
            { type: "image_url", image_url: { url: `data:${mt};base64,${audioBase64}` } },
          ],
        },
      ],
    }, corsHeaders);

    if (!response.ok) {
      return response;
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;
    console.log("[verify-audio] AI response length:", resultText?.length);

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse AI response");
    const result = JSON.parse(jsonMatch[0]);

    // Normalize the 6 probabilities to sum to 100
    const p = result.probabilities || {};
    const keys = ["real", "aiGenerated", "voiceCloned", "manipulated", "editedSpeech", "suspicious"] as const;
    const vals: Record<string, number> = {};
    let sum = 0;
    for (const k of keys) {
      vals[k] = Math.max(0, Number(p[k]) || 0);
      sum += vals[k];
    }
    if (sum > 0) {
      for (const k of keys) vals[k] = (vals[k] / sum) * 100;
    } else {
      vals.suspicious = 100;
    }
    let rounded: Record<string, number> = {};
    let roundedSum = 0;
    for (const k of keys) {
      rounded[k] = Math.round(vals[k]);
      roundedSum += rounded[k];
    }
    let drift = 100 - roundedSum;
    if (drift !== 0) {
      const topKey = keys.reduce((a, b) => (rounded[a] >= rounded[b] ? a : b));
      rounded[topKey] += drift;
    }
    result.probabilities = rounded;

    // Determine winner & verdictTag
    const TAG_MAP: Record<string, string> = {
      real: "REAL AUDIO",
      aiGenerated: "AI GENERATED VOICE",
      voiceCloned: "VOICE CLONED",
      manipulated: "MANIPULATED AUDIO",
      editedSpeech: "EDITED SPEECH",
      suspicious: "SUSPICIOUS CONTENT",
    };
    const winner = keys.reduce((a, b) => (rounded[a] >= rounded[b] ? a : b));
    result.verdictTag = TAG_MAP[winner];
    result.confidence = rounded[winner];
    result.isAuthentic = winner === "real";
    result.category = winner === "real" ? "authentic" : winner === "editedSpeech" || winner === "suspicious" ? "suspicious" : "fake";

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in verify-audio function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        verdictTag: "SUSPICIOUS CONTENT",
        confidence: 0,
        category: "suspicious",
        isAuthentic: false,
        probabilities: { real: 0, aiGenerated: 0, voiceCloned: 0, manipulated: 0, editedSpeech: 0, suspicious: 100 },
        transcript: "",
        reasons: ["Analysis failed. Please try again."],
        aiExplanation: "An error occurred while analyzing the audio.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});