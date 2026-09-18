from services.evidence_selector import EvidenceSelector
from services.evidence_ranker import EvidenceRanker
from services.proposition_checker import PropositionChecker
from models.text_nli_detector import TextNLIVerifier


class EvidenceNLIPipeline:
    """
    Evidence retrieval -> selection -> ranking -> proposition
    direction check -> NLI -> aggregated verification.

    Proposition direction is authoritative for explicit relational
    claims when confidence is high enough.
    """

    def __init__(self):
        print("=" * 60)
        print("Initializing Evidence + NLI Pipeline")
        print("=" * 60)

        self.selector = EvidenceSelector()
        self.ranker = EvidenceRanker()
        self.proposition_checker = PropositionChecker()
        self.nli = TextNLIVerifier()

        print("Evidence + NLI Pipeline ready.")
        print("=" * 60)

    def _verify_evidence(self, claim, evidence):
        proposition = self.proposition_checker.check(
            claim,
            evidence,
        )

        nli_result = self.nli.predict(
            claim,
            evidence,
        )

        relationship = proposition.get(
            "relationship",
            "UNKNOWN",
        )

        proposition_confidence = float(
            proposition.get("confidence", 0.0)
        )

        final_verdict = nli_result["verdict"]
        correction_reason = None

        if proposition_confidence >= 0.80:
            if relationship == "MATCH":
                final_verdict = "SUPPORTS"
                correction_reason = (
                    "Explicit proposition direction matches the claim."
                )

            elif relationship == "REVERSED":
                final_verdict = "REFUTES"
                correction_reason = (
                    "Evidence expresses the reverse proposition."
                )

            elif relationship == "CONTRADICTS":
                final_verdict = "REFUTES"
                correction_reason = (
                    "Evidence explicitly contradicts the claim."
                )

        return {
            "evidence": evidence,
            "proposition_relationship": relationship,
            "proposition_confidence": proposition_confidence,
            "claim_relation": proposition.get(
                "claim_relation"
            ),
            "evidence_relation": proposition.get(
                "evidence_relation"
            ),
            "nli_verdict": nli_result["verdict"],
            "nli_confidence": nli_result["confidence"],
            "final_evidence_verdict": final_verdict,
            "correction_reason": correction_reason,
        }

    def verify_sources(
        self,
        claim,
        sources,
        selection_top_k=3,
        ranking_top_k=5,
    ):
        if not claim or not claim.strip():
            raise ValueError("Claim cannot be empty.")

        if not sources:
            return {
                "claim": claim,
                "final_verdict": "NOT_ENOUGH_INFO",
                "confidence": 0.0,
                "scores": {
                    "supports": 0.0,
                    "refutes": 0.0,
                    "neutral": 1.0,
                },
                "source_summary": {
                    "total_sources": 0,
                    "supporting_sources": 0,
                    "refuting_sources": 0,
                    "neutral_sources": 0,
                    "conflicting_sources": 0,
                },
                "source_results": [],
                "evidence_count": 0,
                "evidence_results": [],
            }

        selected = self.selector.select_sources(
            claim=claim,
            sources=sources,
            top_k_per_source=selection_top_k,
            max_total=15,
        )

        ranked = self.ranker.rank(
            claim=claim,
            evidence_passages=selected,
            top_k=ranking_top_k,
        )

        evidence_results = []

        for item in ranked:
            result = self._verify_evidence(
                claim=claim,
                evidence=item["text"],
            )

            result.update({
                "evidence_score": item["evidence_score"],
                "similarity": item["similarity"],
                "keyword_overlap": item["keyword_overlap"],
                "concept_overlap": item["concept_overlap"],
                "directness": item["directness"],
                "usefulness": item["usefulness"],
                "source": item["source"],
                "source_quality": item["source_quality"],
                "evidence_type": item["evidence_type"],
                "title": item.get("title"),
                "url": item.get("url"),
                "published": item.get("published"),
            })

            evidence_results.append(result)

        supports = 0.0
        refutes = 0.0
        neutral = 0.0

        for item in evidence_results:
            score = float(
                item.get("evidence_score", 0.0)
            )

            verdict = item[
                "final_evidence_verdict"
            ]

            if verdict == "SUPPORTS":
                supports += score

            elif verdict == "REFUTES":
                refutes += score

            else:
                neutral += score

        total_score = (
            supports
            + refutes
            + neutral
        )

        if total_score > 0:
            support_ratio = supports / total_score
            refute_ratio = refutes / total_score
            neutral_ratio = neutral / total_score
        else:
            support_ratio = 0.0
            refute_ratio = 0.0
            neutral_ratio = 1.0

        supporting_sources = 0
        refuting_sources = 0
        neutral_sources = 0

        source_results = []

        grouped = {}

        for item in evidence_results:
            source = item.get(
                "source"
            ) or "Unknown"

            grouped.setdefault(
                source,
                []
            ).append(item)

        for source, items in grouped.items():
            source_support = sum(
                item["evidence_score"]
                for item in items
                if item["final_evidence_verdict"]
                == "SUPPORTS"
            )

            source_refute = sum(
                item["evidence_score"]
                for item in items
                if item["final_evidence_verdict"]
                == "REFUTES"
            )

            source_neutral = sum(
                item["evidence_score"]
                for item in items
                if item["final_evidence_verdict"]
                == "NOT_ENOUGH_INFO"
            )

            if source_support > max(
                source_refute,
                source_neutral,
            ):
                source_verdict = "SUPPORTS"
                supporting_sources += 1

            elif source_refute > max(
                source_support,
                source_neutral,
            ):
                source_verdict = "REFUTES"
                refuting_sources += 1

            else:
                source_verdict = "NOT_ENOUGH_INFO"
                neutral_sources += 1

            source_strength = max(
                source_support,
                source_refute,
                source_neutral,
            )

            best_evidence = max(
                items,
                key=lambda x: x[
                    "evidence_score"
                ],
            )

            source_results.append({
                "source": source,
                "source_quality": max(
                    item.get(
                        "source_quality",
                        0.5,
                    )
                    for item in items
                ),
                "verdict": source_verdict,
                "strength": round(
                    source_strength,
                    4,
                ),
                "evidence_count": len(items),
                "best_evidence": best_evidence[
                    "evidence"
                ],
            })

        conflicting_sources = (
            supporting_sources > 0
            and refuting_sources > 0
        )

        if conflicting_sources:
            final_verdict = "NOT_ENOUGH_INFO"
            confidence = 0.0

        elif supporting_sources > 0 and (
            support_ratio >= 0.25
        ):
            final_verdict = "SUPPORTS"
            confidence = max(
                0.75,
                min(0.95, support_ratio),
            )

        elif refuting_sources > 0 and (
            refute_ratio >= 0.15
        ):
            final_verdict = "REFUTES"
            confidence = max(
                0.75,
                min(0.95, refute_ratio),
            )

        else:
            final_verdict = "NOT_ENOUGH_INFO"
            confidence = 0.0

        return {
            "claim": claim,
            "final_verdict": final_verdict,
            "confidence": round(
                confidence,
                4,
            ),
            "scores": {
                "supports": round(
                    supports,
                    4,
                ),
                "refutes": round(
                    refutes,
                    4,
                ),
                "neutral": round(
                    neutral,
                    4,
                ),
            },
            "source_summary": {
                "total_sources": len(
                    grouped
                ),
                "supporting_sources": supporting_sources,
                "refuting_sources": refuting_sources,
                "neutral_sources": neutral_sources,
                "conflicting_sources": (
                    1
                    if conflicting_sources
                    else 0
                ),
            },
            "source_results": source_results,
            "evidence_count": len(
                evidence_results
            ),
            "evidence_results": evidence_results,
        }

    def verify(
        self,
        claim,
        article_text,
    ):
        source = {
            "publisher": "Direct Evidence",
            "title": "Direct Evidence",
            "evidence_text": article_text,
            "evidence_type": "article",
        }

        return self.verify_sources(
            claim=claim,
            sources=[source],
            selection_top_k=3,
            ranking_top_k=5,
        )