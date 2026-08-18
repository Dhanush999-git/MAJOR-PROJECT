import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageData, signals, forensics } = await req.json();

    if (!imageData) {
      return new Response(
        JSON.stringify({ error: 'imageData is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing image for AI generation / manipulation / edits (premium mode)…',
      signals ? 'with metadata signals' : '',
      forensics ? `+ forensic ensemble pre-score=${forensics.ensembleScore}` : '');

    // Build a forensic signals block the model can fuse with visual evidence.
    const signalsBlock = signals ? `\n\nCLIENT METADATA & COMPRESSION SIGNALS (use as strong corroborating evidence — missing EXIF + small file size + non-camera dimensions are STRONG indicators of AI generation or screenshots):
- EXIF camera make: ${signals.exif?.make ?? 'MISSING'}
- EXIF camera model: ${signals.exif?.model ?? 'MISSING'}
- EXIF software tag: ${signals.exif?.software ?? 'MISSING'}
- EXIF date taken: ${signals.exif?.dateTime ?? 'MISSING'}
- EXIF GPS: ${signals.exif?.gps ? 'present' : 'MISSING'}
- EXIF ISO: ${signals.exif?.iso ?? 'MISSING'}
- EXIF focal length: ${signals.exif?.focalLength ?? 'MISSING'}
- File size: ${signals.compression?.fileSize ?? 'unknown'} bytes
- Megapixels: ${signals.compression?.megapixels?.toFixed?.(2) ?? 'unknown'}
- Bytes-per-pixel: ${signals.compression?.bytesPerPixel?.toFixed?.(3) ?? 'unknown'}
- Width x Height: ${signals.dimensions?.width ?? '?'} x ${signals.dimensions?.height ?? '?'}
- Aspect ratio: ${signals.dimensions?.width && signals.dimensions?.height ? (signals.dimensions.width / signals.dimensions.height).toFixed(3) : 'unknown'}
- Mime type: ${signals.mime ?? 'unknown'}

RULES OF THUMB (apply strictly):
1. ALL EXIF camera fields missing AND square / 1:1 aspect (or common AI sizes 512, 768, 1024, 1280, 1536, 1792, 2048) => very likely AI-generated. Set verdict to "AI-Generated", isAuthentic=false, confidence>=85, sourceType="ai-generated".
2. EXIF software tag mentions "Midjourney", "Stable Diffusion", "DALL", "Imagen", "Flux", "ComfyUI", "Automatic1111", "Adobe Firefly" => certain AI. confidence>=95.
3. EXIF software contains "Photoshop", "Lightroom", "GIMP", "Affinity", "Snapseed", "Facetune" => "heavily-edited" or "lightly-edited" depending on visual evidence.
4. Real camera photo: present Make+Model+DateTimeOriginal AND natural EXIF metadata => likely authentic UNLESS visual evidence of deepfake/splicing.
5. PNG with no EXIF and AI-typical dimensions => strong AI signal.` : '';

    const forensicsBlock = forensics ? `\n\nNUMERICAL FORENSIC SIGNALS (computed client-side via CNN-style spatial + FFT spectral + sensor-noise residual + patch-based local analysis. Treat these as HIGH-WEIGHT evidence):

SPECTRAL (Fast Fourier domain, radial energy):
- High-frequency energy ratio: ${forensics.spectral.highFreqRatio} (real photos 0.18–0.45; AI/diffusion typically <0.15)
- Mid-frequency energy ratio: ${forensics.spectral.midFreqRatio}
- Spectral slope (log-log): ${forensics.spectral.spectralSlope} (real photos ≈ -1.8 to -2.2; AI often steeper than -2.4)
- Spectral synthetic score: ${forensics.spectral.syntheticScore}/100

SENSOR NOISE / PRNU residual (high-pass):
- Mean residual magnitude: ${forensics.noise.noiseMean} (real cameras 1.5–6.0; AI <1.5)
- Residual std: ${forensics.noise.noiseStd} (real cameras 2–8; AI <2)
- Cleanliness score: ${forensics.noise.cleanlinessScore}/100  (higher = unnaturally clean → AI)

EDGE / SOFTNESS (Sobel magnitudes):
- Mean edge density: ${forensics.edges.edgeDensity}
- Edge std: ${forensics.edges.edgeStd}
- Softness score: ${forensics.edges.softnessScore}/100

PATCH-BASED LOCAL CONSISTENCY (8x8 grid):
- Variance-of-variance across patches: ${forensics.patch.varianceOfVariance}
- Noise-std inconsistency across patches: ${forensics.patch.noiseInconsistency} (>1.5 strongly suggests splicing/inpainting)
- Manipulation score: ${forensics.patch.manipulationScore}/100

CLIENT ENSEMBLE PRE-SCORE: ${forensics.ensembleScore}/100 (higher = more synthetic/manipulated)

ENSEMBLE FUSION RULES (apply strictly — these numerical signals override visual impression when they strongly agree):
- ensembleScore >= 65 AND noise.cleanlinessScore >= 60 => verdict = "AI-Generated", isAuthentic=false, confidence >= 88.
- patch.manipulationScore >= 60 AND noise.noiseInconsistency markers => verdict = "Manipulated", isAuthentic=false.
- spectral.syntheticScore >= 50 AND noise.cleanlinessScore >= 50 => bias strongly toward AI-generated even if image looks photoreal.
- ALL forensic scores low (<25) AND EXIF present AND no visual tells => "Real" / authentic.
- Mirror these scores into detectionScores.aiGeneration (use max of model judgment and forensics.spectral.syntheticScore + noise.cleanlinessScore averaged).` : '';

    const response = await callAI({
      model: 'google/gemini-2.5-pro',
      messages: [
        {
          role: 'system',
          content: `You are an elite forensic image analyst specialized in detecting (a) AI-generated images (Midjourney, DALL-E, Stable Diffusion, Flux, Imagen, Gemini Imagen, Adobe Firefly, Sora-image), (b) deepfakes / face swaps / face edits, (c) digital manipulation (splicing, inpainting, object removal, background replacement), and (d) photo edits & effects (beauty filters, sky swap, lighting fixes). You fuse client-side forensic signals (EXIF, compression, dimensions, FFT, sensor noise, patches) with what you see to reach a CONFIDENT, decisive verdict. You speak to ordinary people in plain English while being technically rigorous.

Examine the image carefully for AI-generation tells (apply ALL of these — modern diffusion models are very photorealistic so be vigilant):
- Skin: airbrushed/plastic, no real pores, uniform tone, waxy highlights
- Eyes: irises slightly mismatched, pupils non-round, catchlight inconsistent between eyes, eyelash patterns too symmetric
- Hair: strands fuse together, edges blur into background, flyaway hairs missing or repeating
- Hands & teeth: extra/missing fingers, fused knuckles, melted/blended teeth, asymmetric finger lengths
- Jewellery / accessories: asymmetric earrings, watch faces with garbled numerals, broken chain links
- Text: illegible, warped, melted, fake-looking letterforms — a near-certain AI tell
- Background: repeating textures, cloned patterns, geometry that doesn't converge, melted lines, impossible reflections
- Lighting: subject and background lit from different directions; shadows soft/missing or pointing wrong way
- Symmetry: face/objects too perfectly symmetric; bilateral details (collars, buttons) mismatched
- Micro-noise: photographic sensor noise absent; uniformly clean noise pattern across high & low frequency areas (AI hallmark)
- Frequency artifacts: smooth blobs in detail areas, posterized gradients, "diffusion blur" in flat regions
- Deepfake: face/neck blending mismatch, lighting direction mismatch, asymmetric earrings, inconsistent ear shape, blurry hair edges
- Manipulation: cloned regions, mismatched noise, soft edges around objects, inconsistent shadows or perspective
- Edits & effects: Instagram-style filter, vignette, heavy color grading, beauty/skin smoothing, teeth whitening, eye enlargement, slimming/reshaping, background blur or replacement, sky replacement, object removal, HDR boost, oversharpening, noise reduction, exposure/contrast/saturation push, black-and-white conversion, film grain added

Be DECISIVE. Bias toward "AI-Generated" when multiple AI tells co-occur OR when the client signals strongly indicate AI (missing EXIF + AI-typical dimensions OR numerical forensic ensemble score >= 60). Photorealistic AI images should NOT be marked authentic just because they look real — look for the subtle tells above and TRUST the numerical FFT + sensor-noise + patch signals when they agree. Distinguish: unedited camera photo / lightly edited photo / heavily edited photo / fully AI-generated.${signalsBlock}${forensicsBlock}

Return ONLY a valid JSON object, no prose, no markdown fences:
{
  "isAuthentic": boolean,
  "confidence": number,
  "category": "authentic" | "suspicious" | "manipulated",
  "verdict": "Real" | "AI-Generated" | "Manipulated" | "Suspicious",
  "sourceType": "camera" | "lightly-edited" | "heavily-edited" | "ai-generated",
  "analysis": "2-4 sentence forensic explanation citing specific visual evidence",
  "detectionScores": {
    "aiGeneration": number,
    "splicing": number,
    "lighting": number,
    "metadata": number
  },
  "forensicSummary": {
    "spectralVerdict": "natural" | "suspicious" | "synthetic",
    "noiseVerdict": "natural" | "suspicious" | "synthetic",
    "patchVerdict": "consistent" | "inconsistent",
    "ensembleVerdict": "real" | "uncertain" | "ai-or-manipulated",
    "fusedConfidence": number
  },
  "effects": [
    { "name": "short label e.g. Beauty filter", "confidence": number, "severity": "subtle" | "moderate" | "strong" }
  ],
  "regions": [
    {
      "label": "short description e.g. Face blend edge",
      "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0,
      "severity": "low" | "medium" | "high"
    }
  ]
}

isAuthentic = true ONLY for an unedited or lightly edited real photo. Mark false if AI-generated, deepfaked, or heavily manipulated.
confidence = how sure you are of the verdict (0-100); use >=85 when client signals corroborate visual evidence. detectionScores are 0-100 where higher = more suspicious. For AI-generated images, aiGeneration MUST be >=80. effects is an array (can be empty) of detected edits/effects, each with confidence 0-100.
regions is an array of suspicious areas. x,y,w,h are normalized 0-1 fractions of image dimensions (top-left origin). Only include regions where manipulation or AI artifacts are visible. For authentic images return an empty array.

ALSO RETURN these PREMIUM fields (additive — keep them in the same JSON object):
- "primaryMetric": { "label": "AI Generated Probability" | "Manipulation Probability" | "Authenticity Score", "value": number 0-100 }
  Pick "AI Generated Probability" when the dominant signal is synthetic generation; "Manipulation Probability" for splicing/inpainting/face-edits/background-swap/heavy retouching; "Authenticity Score" only for clearly real photos (and value = 100 - max risk).
- "verdictTag": one of "Original Photo" | "Lightly Edited" | "Edited" | "Heavily Manipulated" | "Deepfake Suspected" | "AI Generated"
- "trustScore": { "level": "Low Risk" | "Medium Risk" | "High Risk", "score": number 0-100 (lower = safer) }
- "plainExplanation": one short, friendly paragraph (2-3 sentences, no jargon) any non-technical person can understand. Talk like a calm expert ("The skin looks too smooth and the background repeats — this is a strong sign of an AI image.").
- "whyItMatters": 2-3 bullet points (strings) describing real-world impact in plain language, picked from: dating-app catfishing, romance scams, fake job offers / hiring fraud, fake screenshots, news misinformation, political propaganda, identity theft, harassment, fake product reviews, fraudulent insurance claims. Pick the bullets most relevant to THIS image's verdict.
- "detectionBreakdown": object with these keys (each 0-100, higher = stronger evidence of that issue): { "deepfake": number, "beautyFilter": number, "faceEdit": number, "backgroundReplacement": number, "objectRemoval": number, "lightingMismatch": number, "metadataIssues": number, "aiPattern": number }. Be generous when signals are present — don't return all zeros for a suspicious image.

TONE for plainExplanation & whyItMatters: warm, human, calm, non-robotic. No "As an AI…". No headings. Use everyday words.`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image with the multi-layered forensic approach. Fuse the numerical FFT, sensor-noise, edge, and patch signals with what you see. Be decisive.' },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
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

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in verify-image function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        isAuthentic: false,
        confidence: 0,
        category: 'suspicious',
        verdict: 'Suspicious',
        sourceType: 'camera',
        analysis: 'An error occurred during analysis. Please try again.',
        detectionScores: { aiGeneration: 0, splicing: 0, lighting: 0, metadata: 0 },
        effects: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
