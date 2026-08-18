import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* ── helpers ───────────────────────────────── */
async function fetchPageContent(url: string): Promise<string> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VerifactBot/1.0)' } });
    if (!r.ok) return 'Unable to fetch page content';
    const html = await r.text();
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000);
  } catch { return 'Unable to fetch page content'; }
}

async function fetchRdap(domain: string): Promise<{ domainAge?: string; registrar?: string }> {
  try {
    const r = await fetch(`https://rdap.org/domain/${domain}`);
    if (!r.ok) return {};
    const d = await r.json();
    const created = d.events?.find((e: any) => e.eventAction === 'registration')?.eventDate;
    const registrar = d.entities?.[0]?.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3];
    return { domainAge: created, registrar };
  } catch { return {}; }
}

async function fetchSslInfo(hostname: string): Promise<{ valid?: boolean; issuer?: string }> {
  try {
    const r = await fetch(`https://ssl-checker.io/api/v1/check/${hostname}`);
    if (!r.ok) return {};
    const d = await r.json();
    return { valid: d.result === 'valid' || d.valid === true, issuer: d.issuer };
  } catch { return {}; }
}

async function checkGoogleSafeBrowsing(url: string, apiKey: string): Promise<{ threats: string[] }> {
  try {
    const r = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'verifact', clientVersion: '1.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    });
    if (!r.ok) return { threats: [] };
    const d = await r.json();
    return { threats: (d.matches || []).map((m: any) => m.threatType) };
  } catch { return { threats: [] }; }
}

function getEnv(name: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno?.env?.get) {
    return Deno.env.get(name);
  }
  return undefined;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'url is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const hostname = new URL(url).hostname;
    console.log('Analyzing URL:', url);

    // Parallel data gathering
    const GOOGLE_SB_KEY = getEnv('GOOGLE_SAFE_BROWSING_KEY') || '';
    const [pageContent, rdap, ssl, safeBrowsing] = await Promise.all([
      fetchPageContent(url),
      fetchRdap(hostname),
      fetchSslInfo(hostname),
      GOOGLE_SB_KEY ? checkGoogleSafeBrowsing(url, GOOGLE_SB_KEY) : Promise.resolve({ threats: [] }),
    ]);

    const enrichment = `
--- Technical data gathered ---
Domain: ${hostname}
RDAP domain registration date: ${rdap.domainAge || 'unknown'}
RDAP registrar: ${rdap.registrar || 'unknown'}
SSL valid: ${ssl.valid ?? 'unknown'}, issuer: ${ssl.issuer || 'unknown'}
Google Safe Browsing threats: ${safeBrowsing.threats.length ? safeBrowsing.threats.join(', ') : 'none detected'}
`;

    const response = await callAI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are an expert cybersecurity analyst and fact-checker. Analyze the provided URL using both the page content and the technical enrichment data (RDAP, SSL, Safe Browsing).

Evaluate:
1. **Phishing risk** — suspicious URL patterns, lookalike domains, credential harvesting forms
2. **Domain age & trust** — newly registered domains are higher risk; use the RDAP date
3. **SSL validity** — missing or self-signed certs are red flags
4. **WHOIS trust** — privacy-shielded registrations on suspicious domains
5. **Malware suspicion** — from Safe Browsing data and page content
6. **Misinformation risk** — content quality, sourcing, bias, propaganda
7. **Content credibility** — citations, named sources, editorial standards

Return ONLY valid JSON, no markdown:
{
  "isCredible": boolean,
  "confidence": number,
  "category": "credible" | "questionable" | "misinformation",
  "analysis": "3-5 sentence expert analysis citing specific evidence",
  "credibilityScores": {
    "sourceCredibility": number,
    "factVerification": number,
    "domainReputation": number,
    "citationQuality": number
  },
  "securityScores": {
    "phishingRisk": number,
    "malwareSuspicion": number,
    "sslTrust": number,
    "domainAgeTrust": number
  },
  "domainInfo": {
    "age": "human readable e.g. 5 years" | "unknown",
    "registrar": "string" | "unknown",
    "sslValid": boolean | null,
    "sslIssuer": "string" | "unknown"
  },
  "safeBrowsingThreats": ["list of threat types or empty"],
  "riskFlags": [
    { "flag": "short label", "severity": "low" | "medium" | "high" | "critical" }
  ]
}

All scores 0-100. For security scores, higher = MORE TRUSTWORTHY (inverse of risk). Be decisive.`
        },
        { role: 'user', content: `Analyze this URL:\n\nURL: ${url}\n\n${enrichment}\n\nPage Content Sample:\n${pageContent}` }
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

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in verify-url function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      isCredible: false, confidence: 0, category: 'misinformation',
      analysis: 'An error occurred during analysis. Please try again.',
      credibilityScores: { sourceCredibility: 0, factVerification: 0, domainReputation: 0, citationQuality: 0 },
      securityScores: { phishingRisk: 0, malwareSuspicion: 0, sslTrust: 0, domainAgeTrust: 0 },
      domainInfo: { age: 'unknown', registrar: 'unknown', sslValid: null, sslIssuer: 'unknown' },
      safeBrowsingThreats: [], riskFlags: []
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
