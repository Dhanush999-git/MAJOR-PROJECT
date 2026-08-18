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
    const { rawContent, decodedPayload, payloadType, physicalTampering } = await req.json();

    if (!rawContent && !decodedPayload) {
      return new Response(
        JSON.stringify({ error: 'decodedPayload or rawContent is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing QR Code Payload (${payloadType}):`, (decodedPayload || rawContent).slice(0, 100));

    const response = await callAI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are an elite enterprise cybersecurity AI forensic analyst specialized in QR code threat detection, anti-phishing, payment fraud detection (UPI refund/cashback scams), domain typosquatting, malware links, and physical QR sticker replacement attacks.
Analyze the provided QR payload and physical metadata carefully.

Evaluate:
1. **Scam / Fraud Intent** — UPI "Pay vs Receive" traps, fake customer care, fake lottery/refunds. (IMPORTANT: scanning a QR code ALWAYS sends money out; legitimate refunds NEVER require scanning a QR code).
2. **Phishing & Impersonation** — Typosquatting domains, fake banking/login pages, Punycode homograph attacks.
3. **Malware / Executables** — APK/EXE/SCR file downloads triggered via QR.
4. **Physical Tampering** — QR sticker overlay anomalies or background noise variance.
5. **Actionable Guidance** — clear, direct user advice.

Return ONLY a valid JSON object, no prose, no markdown fences:
{
  "securityScore": number (0-100 where higher = SAFER),
  "verdict": "Genuine & Safe" | "Suspicious Content" | "Scam / Phishing Attack" | "Malicious QR Code",
  "riskLevel": "Safe" | "Low Risk" | "Medium Risk" | "High Risk" | "Critical Risk",
  "aiClassification": "Genuine" | "Safe" | "Suspicious" | "Scam" | "Phishing" | "Fake Payment" | "Malware Distribution" | "Credential Theft" | "Social Engineering" | "Brand Impersonation" | "High Risk",
  "recommendedAction": "Safe to Scan & Open" | "Verify Before Payment" | "Do Not Enter Credentials" | "Avoid Payment Immediately" | "Suspicious QR Code — Proceed with Caution" | "High-Risk Destination — Block Immediately",
  "analysis": "2-3 sentence expert cybersecurity breakdown explaining why this decision was made",
  "indicators": {
    "phishing": boolean,
    "malware": boolean,
    "paymentScam": boolean,
    "physicalTampering": boolean,
    "obfuscation": boolean
  },
  "threatFlags": ["list of explicit threat warning strings"]
}`
        },
        {
          role: 'user',
          content: `Analyze this decoded QR code content:

Payload Type: ${payloadType || 'URL/Data'}
Decoded Payload: ${decodedPayload || rawContent}
Physical Sticker Overlay Flag: ${physicalTampering?.isStickerOverlay ? 'YES (Suspicious)' : 'NO (Normal)'}
Boundary Noise Variance: ${physicalTampering?.boundaryNoiseStd || 0}`
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
    console.error('Error in verify-qr function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        securityScore: 50,
        verdict: 'Suspicious Content',
        riskLevel: 'Medium Risk',
        aiClassification: 'Suspicious',
        recommendedAction: 'Verify Before Payment',
        analysis: 'An error occurred during AI QR verification. Please exercise caution.',
        indicators: { phishing: false, malware: false, paymentScam: false, physicalTampering: false, obfuscation: false },
        threatFlags: ['AI evaluation endpoint offline or unreachable']
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
