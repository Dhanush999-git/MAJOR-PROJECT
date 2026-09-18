from services.factcheck_service import FactCheckService
from services.web_evidence_service import WebEvidenceService
from services.evidence_selector import EvidenceSelector
from services.evidence_ranker import EvidenceRanker
from models.text_nli_detector import TextNLIVerifier
from services.verdict_engine import VerdictEngine


class VerificationService:
    def __init__(self):
        print("=" * 60)
        print("Initializing VeriFact Verification Service")
        print("=" * 60)

        self.factcheck = FactCheckService()
        self.web_evidence = WebEvidenceService()
        self.selector = EvidenceSelector()
        self.ranker = EvidenceRanker()
        self.nli = TextNLIVerifier()
        self.verdict_engine = VerdictEngine()

        print("VeriFact Verification Service ready.")
        print("=" * 60)

    def verify(self, claim: str):
        if not claim or not claim.strip():
            raise ValueError("Claim cannot be empty.")

        claim = claim.strip()

        print()
        print("=" * 60)
        print("VERIFYING CLAIM")
        print("=" * 60)
        print(f"Claim: {claim}")

        # ---------------------------------------------------------
        # STEP 1 — GOOGLE FACT CHECK
        # ---------------------------------------------------------

        print()
        print("[1/5] Searching Google Fact Check...")

        factcheck_results = []

        try:
            factcheck_results = self.factcheck.search(
                query=claim,
                page_size=10,
                language_code="en"
            )
        except Exception as error:
            print(f"Fact Check search failed: {error}")

        print(f"Fact-check results: {len(factcheck_results)}")

        # ---------------------------------------------------------
        # STEP 2 — WEB / NEWS EVIDENCE
        # ---------------------------------------------------------

        print()
        print("[2/5] Searching web/news evidence...")

        web_results = []

        try:
            web_results = self.web_evidence.search(
                claim=claim,
                max_results=5
            )
        except Exception as error:
            print(f"Web evidence search failed: {error}")

        print(f"Web evidence sources: {len(web_results)}")

        # ---------------------------------------------------------
        # STEP 3 — COLLECT ARTICLE EVIDENCE
        # ---------------------------------------------------------

        print()
        print("[3/5] Preparing evidence...")

        evidence_documents = []

        for result in web_results:

            evidence_text = result.get("evidence_text")

            if not evidence_text:
                continue

            evidence_documents.append({
                "text": evidence_text,
                "title": result.get("title"),
                "publisher": result.get("publisher"),
                "article_url": result.get("article_url"),
                "google_news_url": result.get("google_news_url"),
                "published": result.get("published"),
                "evidence_type": result.get("evidence_type"),
            })

        print(f"Evidence documents: {len(evidence_documents)}")

        # ---------------------------------------------------------
        # STEP 4 — SELECT + RANK + NLI
        # ---------------------------------------------------------

        evidence_results = []

        for document in evidence_documents:

            article_text = document["text"]

            try:
                selected = self.selector.select(
                    claim=claim,
                    article_text=article_text,
                    top_k=10
                )

                ranked = self.ranker.rank(
                    claim=claim,
                    evidence_passages=selected,
                    minimum_similarity=0.35,
                    minimum_concept_overlap=0.20,
                    top_k=5
                )

            except Exception as error:
                print(f"Evidence processing failed: {error}")
                continue

            for evidence in ranked:

                evidence_text = evidence["text"]

                try:
                    nli_result = self.nli.predict(
                        claim=claim,
                        evidence=evidence_text
                    )
                except Exception as error:
                    print(f"NLI verification failed: {error}")
                    continue

                evidence_results.append({
                    "evidence": evidence_text,
                    "title": document.get("title"),
                    "publisher": document.get("publisher"),
                    "article_url": document.get("article_url"),
                    "google_news_url": document.get("google_news_url"),
                    "published": document.get("published"),
                    "evidence_type": document.get("evidence_type"),

                    "similarity": evidence["similarity"],
                    "concept_overlap": evidence["concept_overlap"],
                    "evidence_score": evidence["evidence_score"],

                    "nli_verdict": nli_result["verdict"],
                    "nli_confidence": nli_result["confidence"],
                })

        print(f"Verified evidence passages: {len(evidence_results)}")

        # ---------------------------------------------------------
        # STEP 5 — AGGREGATE NLI
        # ---------------------------------------------------------

        supports_score = 0.0
        refutes_score = 0.0
        neutral_score = 0.0

        for evidence in evidence_results:

            weight = (
                evidence["evidence_score"]
                * evidence["nli_confidence"]
            )

            if evidence["nli_verdict"] == "SUPPORTS":
                supports_score += weight

            elif evidence["nli_verdict"] == "REFUTES":
                refutes_score += weight

            else:
                neutral_score += weight

        if supports_score == 0 and refutes_score == 0:

            nli_result = {
                "final_verdict": "NOT_ENOUGH_INFO",
                "confidence": 0.0,
            }

        elif supports_score > refutes_score:

            total = supports_score + refutes_score

            confidence = supports_score / total

            nli_result = {
                "final_verdict": "SUPPORTS",
                "confidence": round(confidence * 0.75, 4),
            }

        elif refutes_score > supports_score:

            total = supports_score + refutes_score

            confidence = refutes_score / total

            nli_result = {
                "final_verdict": "REFUTES",
                "confidence": round(confidence * 0.75, 4),
            }

        else:

            nli_result = {
                "final_verdict": "NOT_ENOUGH_INFO",
                "confidence": 0.0,
            }

        # ---------------------------------------------------------
        # FACT-CHECK RATING
        # ---------------------------------------------------------


        # ---------------------------------------------------------
        # FINAL VERDICT
        # ---------------------------------------------------------

        final_result = self.verdict_engine.decide(
    claim=claim,
    factcheck_results=factcheck_results,
    nli_result=nli_result
)

        # ---------------------------------------------------------
        # RETURN RESULT
        # ---------------------------------------------------------

        result = {
            "claim": claim,

            "verdict": final_result["verdict"],
            "confidence": final_result["confidence"],
            "reason": final_result["reason"],

            "factcheck": {
                "found": len(factcheck_results) > 0,
                "results": factcheck_results,
            },

            "evidence": {
                "supports_score": round(supports_score, 4),
                "refutes_score": round(refutes_score, 4),
                "neutral_score": round(neutral_score, 4),
                "results": evidence_results,
            },

            "nli": {
                "verdict": nli_result["final_verdict"],
                "confidence": nli_result["confidence"],
            },
        }

        print()
        print("=" * 60)
        print("FINAL VERIFICATION RESULT")
        print("=" * 60)

        print(f"Verdict: {result['verdict']}")
        print(f"Confidence: {result['confidence']}")
        print(f"Reason: {result['reason']}")

        print("=" * 60)

        return result