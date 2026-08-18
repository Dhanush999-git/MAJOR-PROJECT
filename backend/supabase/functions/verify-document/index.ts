import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileData, mime, filename, signals } = await req.json();
    if (!fileData || !mime) {
      return new Response(JSON.stringify({ error: "fileData and mime are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isImage = mime.startsWith("image/");
    const isPdf = mime === "application/pdf";
    const isDocx = mime.includes("officedocument.wordprocessingml") || mime === "application/msword";

    const signalsBlock = `\n\nCLIENT METADATA & FILE SIGNALS (weigh these strongly):
- Filename: ${filename ?? "unknown"}
- MIME: ${mime}
- File size (bytes): ${signals?.fileSize ?? "unknown"}
- SHA-256 hash: ${signals?.sha256 ?? "unknown"}
- Pages / dimensions: ${signals?.dimensions ?? "unknown"}
- Detected PDF metadata (author, producer, creator, created, modified, encryption, signed): ${JSON.stringify(signals?.pdfMeta ?? {})}
- Detected image EXIF (make, model, software, dateTime): ${JSON.stringify(signals?.exif ?? {})}
- Text extracted client-side (may be empty for scanned docs): ${signals?.textSample ? String(signals.textSample).slice(0, 2000) : "none"}

RULES OF THUMB:
1. PDF producer/creator says "Photoshop", "Canva", "GIMP", "Illustrator", "Word" for a document that claims to be an official government/bank/legal document => Suspicious.
2. Missing all metadata + rasterised (scanned-looking) PDF => Suspicious unless it looks like a genuine scan.
3. Different fonts within the same field (e.g. name row uses different weights/families) => strong forgery signal.
4. Author fields present but createdDate == modifiedDate to the second AND recent => likely regenerated/edited.
5. Digital signature present and valid => strong authenticity boost.
6. AI-image tells inside a document image (unnatural stamp/photo, garbled seal text, warped logo) => AI-generated document.`;

    const system = `You are an elite forensic document verification analyst. Analyse the uploaded document (PDF, image scan, or DOCX) and decide if it is REAL, SUSPICIOUS, or FAKE. Your judgment fuses:
- OCR-level text reading (PaddleOCR-like) — read every visible text field.
- Layout understanding (LayoutLMv3 / Donut-like) — check field alignment, tables, headers, footers, stamps, logos.
- Forgery detection (EfficientNet / XceptionNet-like) — copy-move, splicing, font mismatches, ghosted edits, misaligned pixels around edited fields.
- AI-image detection (CLIP / DINOv2-like) — is a photo/stamp/signature AI-generated?
- Metadata forensics — EXIF, PDF author/producer/timestamps, editing software, digital signatures, QR / barcodes, hashes.
- Structural checks — templates, spacing, expected sections for the document type (invoice, ID card, certificate, degree, passport, bank statement, offer letter, etc.).

Be DECISIVE. In plain English, no jargon.${signalsBlock}

Return ONLY a valid JSON object (no markdown fences):
{
  "verdict": "Real" | "Suspicious" | "Fake",
  "authenticityScore": number,            // 0-100 (higher = more authentic)
  "confidence": number,                   // 0-100 confidence in the verdict
  "documentType": string,                 // e.g. "Invoice", "National ID", "Bank statement", "Offer letter", "Degree certificate", "Unknown"
  "primaryMetric": { "label": "Authenticity Score" | "Forgery Probability" | "AI Generation Probability", "value": number },
  "verdictTag": "Genuine Document" | "Lightly Edited" | "Tampered" | "Forged" | "AI Generated" | "Scanned Copy",
  "trustScore": { "level": "Low Risk" | "Medium Risk" | "High Risk", "score": number },
  "plainExplanation": "2-3 sentence, warm, human explanation any non-technical person can understand",
  "whyItMatters": [ "bullet 1", "bullet 2", "bullet 3" ],
  "detectionBreakdown": {
    "copyMoveForgery": number,
    "splicing": number,
    "fontMismatch": number,
    "layoutInconsistency": number,
    "metadataIssues": number,
    "aiGeneratedContent": number,
    "signatureValidity": number,
    "compressionArtifacts": number
  },
  "metadataFindings": [
    { "field": "PDF Producer", "value": "…", "risk": "low" | "medium" | "high", "note": "…" }
  ],
  "extractedFields": [
    { "label": "Name", "value": "…" }
  ],
  "regions": [
    { "label": "Edited amount field", "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0, "severity": "low" | "medium" | "high", "page": 1 }
  ],
  "analysis": "Forensic summary (3-5 sentences, technical, precise)"
}

Rules:
- regions x,y,w,h are normalised 0-1 for the first page/image; return [] if none.
- For a clearly authentic document return low breakdown scores, verdict "Real", trustScore.level "Low Risk".
- For obvious tampering (edited numbers, mismatched fonts, wrong producer) return verdict "Fake", primaryMetric label "Forgery Probability" with a high value.
- For AI-generated fake documents (e.g. fabricated ID cards, fake bank statements) return verdictTag "AI Generated" and set aiGeneratedContent >= 80.
- Keep plainExplanation warm and human. No "As an AI".`;

    const userContent: any[] = [
      { type: "text", text: `Verify this ${isPdf ? "PDF" : isDocx ? "Word document" : "document image"} named "${filename ?? "document"}". Read every visible field, cross-check layout, fonts, metadata and any embedded images/stamps/signatures.` },
    ];
    if (isImage) {
      userContent.push({ type: "image_url", image_url: { url: fileData } });
    } else {
      userContent.push({ type: "file", file: { filename: filename ?? "document", file_data: fileData } });
    }

    const response = await callAI({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    }, corsHeaders);

    if (!response.ok) {
      return response;
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse AI response");
    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in verify-document function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        verdict: "Suspicious",
        authenticityScore: 0,
        confidence: 0,
        analysis: "An error occurred during analysis. Please try again.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});