import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebHit { title: string; url: string; snippet: string; source: string; group: string }

function hostOf(u: string) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

function getEnv(name: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno?.env?.get) {
    return Deno.env.get(name);
  }
  return undefined;
}

async function firecrawlSearch(query: string, group: string, limit: number): Promise<WebHit[]> {
  const FIRECRAWL_API_KEY = getEnv('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const r = await fetch(`https://api.firecrawl.dev/v1/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ query, limit }),
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) {
      console.error(`Firecrawl search failed [${r.status}] (${group}):`, await r.text());
      return [];
    }
    const d = await r.json();
    const items = Array.isArray(d?.data) ? d.data : (Array.isArray(d?.data?.web) ? d.data.web : []);
    return items.map((it: any) => ({
      title: it.title || '',
      url: it.url || '',
      snippet: (it.description || it.markdown || '').slice(0, 400),
      source: hostOf(it.url || ''),
      group,
    })).filter((h: WebHit) => h.url);
  } catch (e) {
    console.error('Firecrawl search error:', e);
    return [];
  }
}

async function gatherLiveEvidence(text: string) {
  const claim = text.replace(/\s+/g, ' ').trim().slice(0, 220);
  const NEWS = 'site:reuters.com OR site:apnews.com OR site:bbc.com OR site:aljazeera.com OR site:theguardian.com OR site:nytimes.com OR site:indiatoday.in OR site:thehindu.com';
  const FACT = 'site:snopes.com OR site:politifact.com OR site:factcheck.org OR site:factcheck.afp.com OR site:boomlive.in OR site:altnews.in OR site:reuters.com/fact-check';
  const SOCIAL = 'site:x.com OR site:twitter.com OR site:reddit.com OR site:facebook.com OR site:instagram.com OR site:youtube.com OR site:threads.net OR site:tiktok.com';
  const [news, factCheck, social, open] = await Promise.all([
    firecrawlSearch(`${claim} ${NEWS}`, 'news', 6),
    firecrawlSearch(`${claim} fact check ${FACT}`, 'fact-checker', 5),
    firecrawlSearch(`${claim} ${SOCIAL}`, 'social', 6),
    firecrawlSearch(claim, 'web', 5),
  ]);
  return [...news, ...factCheck, ...social, ...open];
}

function formatEvidence(hits: WebHit[]) {
  if (!hits.length) return 'NO LIVE WEB RESULTS AVAILABLE. Rely on trained knowledge and say so explicitly.';
  return hits.map((h, i) => `[${i + 1}] (${h.group} | ${h.source}) ${h.title}\nURL: ${h.url}\nSnippet: ${h.snippet}`).join('\n\n');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text) return new Response(JSON.stringify({ error: 'text is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    console.log('Analyzing text for fake news, propaganda, bias...');

    const liveHits = await gatherLiveEvidence(text);
    console.log('Live evidence hits:', liveHits.length);

    const response = await callAI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are Verifact News Verifier — an advanced AI fact-checking and news-verification analyst. Your job is not only to classify text as Real / Misleading / Fake, but to VERIFY whether the reported event actually happened by cross-referencing your trained knowledge of trusted news agencies (Reuters, AP, AFP, BBC, NYT, WaPo, Guardian, Al Jazeera, PTI, ANI), official government sources, and reputable fact-checkers (Snopes, PolitiFact, FactCheck.org, AFP Fact Check, Reuters Fact Check, BOOM, AltNews).

Run these layers and fuse them:
LAYER 1 Semantic — tone, intent, sensational/biased language.
LAYER 2 Claim & Entity Fact-Check — extract claims, entities, dates, places; mark each supported/unverified/contradicted against reliable sources.
LAYER 3 Historical/Event Verification — did this event actually occur? When, where, who was involved, why. Detect recycled or out-of-context claims.
LAYER 4 Internal Consistency — contradictions, fabricated quotes, missing attribution.
LAYER 5 Propaganda / Manipulation techniques.
LAYER 6 Source Credibility & AI-generation signals.

LIVE WEB EVIDENCE: You are given real-time search results from major news agencies, fact-checking organizations, social media platforms (X, Reddit, Facebook, Instagram, YouTube, Threads, TikTok) and the open web. Treat this live evidence as the PRIMARY basis for verification and prefer it over memory. Cross-reference the claim against these results: if multiple reputable outlets corroborate it, lean Verified; if fact-checkers debunk it, lean False Information; if only social posts carry it with no reputable outlet, lean Misleading or Insufficient Evidence. Cite the specific outlets you used.

ENSEMBLE: produce three calibrated probabilities summing to 100 (real + misleading + fake). The final "verdict" is the label with the highest probability. Additionally produce a user-facing "verifiedVerdict" from: "Verified" | "False Information" | "Misleading" | "Partially True" | "Insufficient Evidence".

Mapping guidance:
- Verified → the event genuinely happened and the claim is substantively accurate.
- False Information → the event did not happen or the core claim is fabricated.
- Misleading → real kernel but framed to deceive, missing critical context, or altered.
- Partially True → some claims accurate, others inaccurate; specify which.
- Insufficient Evidence → cannot be confirmed from reliable sources you know.

Return ONLY valid JSON, no markdown, matching exactly:
{
  "verdict": "Real" | "Misleading" | "Fake",
  "verifiedVerdict": "Verified" | "False Information" | "Misleading" | "Partially True" | "Insufficient Evidence",
  "probabilities": { "real": number, "misleading": number, "fake": number },
  "isAuthentic": boolean,
  "confidence": number,
  "category": "authentic" | "suspicious" | "fake",
  "analysis": "3-5 sentence expert explanation citing specific evidence from the text",
  "indicators": ["specific red flags"],
  "scores": {
    "fakeNewsProbability": number, "propagandaLevel": number, "biasScore": number,
    "sentimentManipulation": number, "sourceCredibility": number, "aiGeneratedProbability": number
  },
  "biasDirection": "left" | "center-left" | "center" | "center-right" | "right" | "unknown",
  "propagandaTechniques": [{ "name": string, "confidence": number, "example": string }],
  "manipulationTactics": [{ "tactic": string, "severity": "low" | "medium" | "high" }],
  "factChecks": [{ "claim": string, "status": "supported" | "unverified" | "contradicted", "note": string }],
  "historicalContext": "1-3 sentences (or empty)",
  "inconsistencies": [string],
  "layerSignals": { "semantic": number, "factCheck": number, "historical": number, "consistency": number, "propaganda": number, "sourceCredibility": number },
  "aiExplanation": "plain-English paragraph for a general audience explaining WHY the verdict was chosen",
  "eventSummary": {
    "what": "one clear sentence on what actually happened, or empty if unknown",
    "when": "date or period, or empty",
    "where": "location, or empty",
    "who": "people/organizations involved, or empty",
    "why": "cause/context if applicable, or empty",
    "latest": "most recent verified development you know of, or empty",
    "context": "any important context users should know, or empty"
  },
  "correction": {
    "needed": boolean,
    "inaccurateParts": [string],
    "reasons": [string],
    "correctedClaim": "a rewritten, factually accurate version of the original claim, or empty when needed=false",
    "whatActuallyHappened": "clear factual description of the real event, or empty when not applicable"
  },
  "trustedSources": [
    { "name": "e.g. Reuters", "type": "news" | "government" | "fact-checker" | "academic" | "other", "note": "why this source is relevant" }
  ],
  "sourceCoverage": {
    "corroboratingOutlets": number,
    "contradictingOutlets": number,
    "socialOnly": boolean,
    "summary": "1-2 sentences on how widely and by whom this is reported"
  },
  "evidenceUsed": [
    { "title": string, "url": string, "source": string, "stance": "supports" | "refutes" | "context", "note": "what this result showed" }
  ]
}

Rules:
- All scores 0-100.
- "isAuthentic" = (verdict === "Real").
- "category": Real → "authentic", Misleading → "suspicious", Fake → "fake".
- "confidence" = winning probability.
- correction.needed MUST be true when verifiedVerdict is any of: False Information, Misleading, Partially True.
- If you truly do not know, set verifiedVerdict to "Insufficient Evidence" and keep eventSummary fields empty rather than fabricating.
- Never invent URLs. In trustedSources, name outlets and reasoning only — no fake links.
- In evidenceUsed, only use URLs that appear verbatim in the LIVE WEB EVIDENCE block. Never fabricate a URL.
- If the live evidence block is empty, set sourceCoverage counts to 0, evidenceUsed to [], and lower confidence accordingly.
- Be decisive, concise, and evidence-based.`
        },
        { role: 'user', content: `Verify this news claim / article / headline:\n\n${text}\n\n--- LIVE WEB EVIDENCE (real-time search across news agencies, fact-checkers and social platforms) ---\n${formatEvidence(liveHits)}` }
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

    // Normalize probabilities to sum to 100 and align verdict/category
    const p = result.probabilities || {};
    let real = Math.max(0, Number(p.real) || 0);
    let mis = Math.max(0, Number(p.misleading) || 0);
    let fake = Math.max(0, Number(p.fake) || 0);
    const sum = real + mis + fake;
    if (sum > 0 && Math.abs(sum - 100) > 0.5) {
      real = (real / sum) * 100;
      mis = (mis / sum) * 100;
      fake = (fake / sum) * 100;
    }
    real = Math.round(real); mis = Math.round(mis); fake = Math.round(fake);
    // Fix rounding drift
    const drift = 100 - (real + mis + fake);
    if (drift !== 0) {
      const top = Math.max(real, mis, fake);
      if (top === real) real += drift;
      else if (top === mis) mis += drift;
      else fake += drift;
    }
    result.probabilities = { real, misleading: mis, fake };
    const winner = real >= mis && real >= fake ? 'Real' : mis >= fake ? 'Misleading' : 'Fake';
    result.verdict = winner;
    result.confidence = winner === 'Real' ? real : winner === 'Misleading' ? mis : fake;
    result.isAuthentic = winner === 'Real';
    result.category = winner === 'Real' ? 'authentic' : winner === 'Misleading' ? 'suspicious' : 'fake';

    // Ensure verifiedVerdict aligns with ensemble winner when missing / mismatched
    const allowedVV = ['Verified', 'False Information', 'Misleading', 'Partially True', 'Insufficient Evidence'];
    if (!result.verifiedVerdict || !allowedVV.includes(result.verifiedVerdict)) {
      result.verifiedVerdict = winner === 'Real' ? 'Verified' : winner === 'Misleading' ? 'Misleading' : 'False Information';
    }
    if (['False Information', 'Misleading', 'Partially True'].includes(result.verifiedVerdict)) {
      result.correction = result.correction || {};
      result.correction.needed = true;
    } else if (result.verifiedVerdict === 'Verified') {
      result.correction = result.correction || { needed: false, inaccurateParts: [], reasons: [], correctedClaim: '', whatActuallyHappened: '' };
      result.correction.needed = false;
    }
    result.verifiedAt = new Date().toISOString();
    result.liveSources = liveHits.map((h) => ({ title: h.title, url: h.url, source: h.source, group: h.group }));
    result.liveSearchUsed = liveHits.length > 0;

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in verify-text function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      isAuthentic: false, confidence: 0, category: 'fake',
      analysis: 'An error occurred during analysis. Please try again.',
      indicators: [], scores: { fakeNewsProbability: 0, propagandaLevel: 0, biasScore: 0, sentimentManipulation: 0, sourceCredibility: 0, aiGeneratedProbability: 0 },
      biasDirection: 'unknown', propagandaTechniques: [], manipulationTactics: [], aiExplanation: ''
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
