import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AudioSignals {
  durationSec?: number;
  sampleRate?: number;
  rmsMean?: number;        // overall loudness 0-1
  rmsStd?: number;         // dynamic variation
  zcrMean?: number;        // zero-crossing rate (proxy for noisiness)
  spectralFlatnessMean?: number; // 0 (tonal) … 1 (noisy)
  spectralCentroidMean?: number; // Hz – brightness
  silentRatio?: number;    // % of frames near silence
  voicedRatio?: number;    // % of frames with voiced energy
  noiseFloorDb?: number;   // background noise floor
  pitchStability?: number; // 0-1 (1 = robotic/flat, low = natural variation)
}

interface FrameInput {
  timestamp: number;
  dataUrl: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const legacyFrame: string | undefined = body.frame;
    const legacyTimestamp: number | undefined = body.timestamp;
    const frames: FrameInput[] | undefined = Array.isArray(body.frames) ? body.frames : undefined;
    const audio: AudioSignals | undefined = body.audio;
    const durationSec: number | undefined = body.durationSec;

    if (!legacyFrame && (!frames || frames.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'frames[] or frame is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the payload
    const useFrames: FrameInput[] = frames && frames.length
      ? frames
      : [{ timestamp: legacyTimestamp ?? 0, dataUrl: legacyFrame as string }];

    console.log(`Analyzing video — frames=${useFrames.length}, hasAudio=${!!audio}, duration=${durationSec ?? 'n/a'}s`);

    const systemPrompt = `You are a senior forensic video analyst for a premium consumer trust product.
You receive multiple sampled frames from one video plus client-side audio signals.
Detect: AI generation (Sora/Runway/Pika/Veo/Kling), face-swap deepfakes, lip-sync mismatch, unnatural blinking,
voice cloning, suspicious frame cuts, replay/loop edits, lighting/background mismatch across frames,
unnatural facial expressions, morphing limbs/objects, plastic skin, melted hair, hand/finger errors.

Use the provided audio signals when judging voice authenticity:
- Very high pitchStability (>0.85) + low rmsStd (<0.05) + flatness < 0.3 ⇒ likely synthetic / TTS / voice-cloned.
- Very clean noiseFloorDb (< -55 dB) with no ambient variation ⇒ studio-clean, possibly synthetic.
- voicedRatio > 0.6 with abnormally constant centroid ⇒ robotic.
- Natural recordings have rmsStd > 0.08, varying centroid and some noise floor variation.

Fuse signals across frames AND audio into ONE confident verdict. Be decisive — do not hedge.

Return ONLY valid JSON, no markdown, matching this schema exactly:
{
  "isAuthentic": boolean,
  "confidence": number,                       // 0-100, certainty of the verdict
  "category": "authentic" | "suspicious" | "deepfake",
  "verdict": "Original" | "Edited" | "Manipulated" | "AI-Generated" | "Deepfake Suspected",
  "verdictTag": "Original" | "Edited" | "Manipulated" | "AI-Generated" | "Deepfake Suspected",
  "trustScore": { "level": "Low Risk" | "Medium Risk" | "High Risk", "score": number },
  "primaryMetric": { "label": string, "value": number },   // e.g. "Deepfake Probability" 89
  "plainExplanation": "2-3 short human-friendly sentences, no jargon",
  "analysis": "1-2 sentence forensic summary citing concrete evidence",
  "whyItMatters": [ "real-world risk bullet 1", "bullet 2", "bullet 3" ],
  "detectionScores": {
    "facialManipulation": number,             // 0-100, higher = more suspicious
    "lipSync": number,
    "temporalConsistency": number,
    "ganArtifacts": number,
    "blinkRate": number,
    "lightingMismatch": number,
    "backgroundConsistency": number,
    "voiceAuthenticity": number               // 0-100, higher = more suspicious voice
  },
  "voice": {
    "score": number,                          // 0-100, AUTHENTICITY (higher = more authentic)
    "verdict": "Real" | "Possibly AI-generated" | "Suspicious",
    "summary": "1 short sentence on the voice"
  },
  "timeline": [
    { "timestamp": number, "type": "visual" | "audio" | "both",
      "severity": "low" | "medium" | "high",
      "label": "short label e.g. lip-sync drift",
      "note": "1 short sentence" }
  ],
  "frameFlags": ["short labels for each issue across frames"]
}`;

    const userContent: any[] = [
      {
        type: 'text',
        text: `Analyze this video. Frames sampled at: ${useFrames.map(f => `${f.timestamp.toFixed(1)}s`).join(', ')}.${durationSec ? ` Duration ${durationSec.toFixed(1)}s.` : ''}

Audio signals: ${audio ? JSON.stringify(audio) : 'not provided'}

Return the JSON described in the system prompt. Pick a primaryMetric label that fits the verdict ("Deepfake Probability", "Manipulation Probability", "AI Generated Probability", or "Authenticity Score").`
      },
      ...useFrames.map(f => ({ type: 'image_url', image_url: { url: f.dataUrl } })),
    ];

    const response = await callAI({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
    }, corsHeaders);

    if (!response.ok) {
      return response;
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;
    console.log('AI Response:', resultText);

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse AI response');
    const result = JSON.parse(jsonMatch[0]);
    if (legacyTimestamp != null && result.timestamp == null) result.timestamp = legacyTimestamp;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in verify-video function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        isAuthentic: false,
        confidence: 0,
        category: 'suspicious',
        verdict: 'Suspicious',
        analysis: 'An error occurred during analysis. Please try again.',
        detectionScores: { facialManipulation: 0, lipSync: 0, temporalConsistency: 0, ganArtifacts: 0 }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
