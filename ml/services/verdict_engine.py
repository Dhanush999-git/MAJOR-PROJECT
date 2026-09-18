class VerdictEngine:
    """
    Final evidence-fusion decision layer.

    Combines:
    - Google Fact Check results
    - Web evidence
    - NLI verification
    - Source quality
    - Evidence strength

    Public verdicts:
        REAL
        FAKE
        UNVERIFIED
    """

    def __init__(self):
        print("=" * 60)
        print("Initializing Verdict Engine")
        print("=" * 60)
        print("Verdict Engine ready.")
        print("=" * 60)

    # =========================================================
    # FACT CHECK
    # =========================================================

    def _get_relevant_fact_checks(
        self,
        factcheck_results
    ):
        if not factcheck_results:
            return []

        relevant = []

        for item in factcheck_results:

            if not isinstance(item, dict):
                continue

            relevance = float(
                item.get(
                    "relevance_score",
                    0.0
                )
            )

            publisher_quality = float(
                item.get(
                    "publisher_quality",
                    0.50
                )
            )

            rating = str(
                item.get(
                    "normalized_rating",
                    "UNKNOWN"
                )
            ).upper()

            # Conservative threshold.
            if relevance < 0.50:
                continue

            if rating not in {
                "TRUE",
                "FALSE",
                "MIXED",
            }:
                continue

            relevant.append({
                "rating": rating,
                "relevance": relevance,
                "publisher_quality": publisher_quality,
                "publisher": item.get(
                    "publisher"
                ),
                "title": item.get(
                    "title"
                ),
                "url": item.get(
                    "url"
                ),
                "claim": item.get(
                    "claim"
                ),
            })

        return relevant

    def _factcheck_signal(
        self,
        factcheck_results
    ):
        relevant = self._get_relevant_fact_checks(
            factcheck_results
        )

        supports = 0.0
        refutes = 0.0

        for item in relevant:

            weight = (
                item["relevance"]
                * item["publisher_quality"]
            )

            if item["rating"] == "TRUE":
                supports += weight

            elif item["rating"] == "FALSE":
                refutes += weight

        return {
            "supports": supports,
            "refutes": refutes,
            "count": len(relevant),
            "items": relevant,
        }

    # =========================================================
    # NLI
    # =========================================================

    def _nli_signal(
        self,
        nli_result
    ):
        if not nli_result:
            return {
                "supports": 0.0,
                "refutes": 0.0,
                "neutral": 0.0,
            }

        scores = nli_result.get(
            "scores",
            {}
        )

        return {
            "supports": float(
                scores.get(
                    "supports",
                    0.0
                )
            ),
            "refutes": float(
                scores.get(
                    "refutes",
                    0.0
                )
            ),
            "neutral": float(
                scores.get(
                    "neutral",
                    0.0
                )
            ),
        }

    # =========================================================
    # SOURCE EVIDENCE
    # =========================================================

    def _source_signal(
        self,
        nli_result
    ):
        if not nli_result:
            return {
                "supports": 0.0,
                "refutes": 0.0,
                "supporting_sources": 0,
                "refuting_sources": 0,
                "total_sources": 0,
            }

        source_results = nli_result.get(
            "source_results",
            []
        )

        support_score = 0.0
        refute_score = 0.0

        supporting_sources = 0
        refuting_sources = 0

        for source in source_results:

            verdict = source.get(
                "verdict"
            )

            strength = float(
                source.get(
                    "strength",
                    0.0
                )
            )

            quality = float(
                source.get(
                    "source_quality",
                    0.50
                )
            )

            weighted_strength = (
                strength * quality
            )

            if verdict == "SUPPORTS":

                supporting_sources += 1

                support_score += (
                    weighted_strength
                )

            elif verdict == "REFUTES":

                refuting_sources += 1

                refute_score += (
                    weighted_strength
                )

        return {
            "supports": support_score,
            "refutes": refute_score,
            "supporting_sources":
                supporting_sources,
            "refuting_sources":
                refuting_sources,
            "total_sources":
                len(source_results),
        }

    # =========================================================
    # CONFIDENCE
    # =========================================================

    def _confidence(
        self,
        winning_score,
        losing_score,
        source_count,
        evidence_count,
        factcheck_count
    ):
        total = (
            winning_score
            + losing_score
        )

        if total <= 0:
            return 0.0

        balance = (
            winning_score / total
        )

        # Evidence coverage.
        if evidence_count <= 0:
            evidence_coverage = 0.0
        elif evidence_count == 1:
            evidence_coverage = 0.40
        elif evidence_count == 2:
            evidence_coverage = 0.55
        elif evidence_count == 3:
            evidence_coverage = 0.65
        elif evidence_count <= 5:
            evidence_coverage = 0.75
        else:
            evidence_coverage = 0.82

        # Independent source coverage.
        if source_count <= 0:
            source_coverage = 0.0
        elif source_count == 1:
            source_coverage = 0.45
        elif source_count == 2:
            source_coverage = 0.65
        else:
            source_coverage = 0.82

        # Fact-check availability is only a small
        # confidence bonus.
        if factcheck_count == 0:
            factcheck_bonus = 0.0
        elif factcheck_count == 1:
            factcheck_bonus = 0.05
        else:
            factcheck_bonus = 0.10

        confidence = (
            (balance * 0.55)
            + (evidence_coverage * 0.25)
            + (source_coverage * 0.15)
            + (factcheck_bonus * 0.05)
        )

        return round(
            min(confidence, 0.95),
            4
        )

    # =========================================================
    # FINAL DECISION
    # =========================================================

    def decide(
        self,
        claim: str,
        factcheck_results=None,
        nli_result=None
    ):
        if not claim or not claim.strip():
            raise ValueError(
                "Claim cannot be empty."
            )

        factcheck_results = (
            factcheck_results or []
        )

        # -----------------------------------------------------
        # Collect signals
        # -----------------------------------------------------

        factcheck = self._factcheck_signal(
            factcheck_results
        )

        nli = self._nli_signal(
            nli_result
        )

        source = self._source_signal(
            nli_result
        )

        # -----------------------------------------------------
        # Evidence counts
        # -----------------------------------------------------

        evidence_count = 0

        if nli_result:
            evidence_count = int(
                nli_result.get(
                    "evidence_count",
                    0
                )
            )

        source_count = source[
            "total_sources"
        ]

        factcheck_count = factcheck[
            "count"
        ]

        # -----------------------------------------------------
        # Web/NLI evidence gets primary authority.
        #
        # Fact Check gets a supporting role.
        # -----------------------------------------------------

        support_score = (
            nli["supports"] * 1.00
            + source["supports"] * 0.80
            + factcheck["supports"] * 0.50
        )

        refute_score = (
            nli["refutes"] * 1.00
            + source["refutes"] * 0.80
            + factcheck["refutes"] * 0.50
        )

        # -----------------------------------------------------
        # No evidence
        # -----------------------------------------------------

        if (
            support_score < 0.20
            and refute_score < 0.20
        ):
            return {
                "verdict": "UNVERIFIED",
                "confidence": 0.0,
                "reason": (
                    "Available evidence is "
                    "insufficient to verify "
                    "the claim."
                ),
                "factcheck_used": False,
                "decision_scores": {
                    "supports": round(
                        support_score,
                        4
                    ),
                    "refutes": round(
                        refute_score,
                        4
                    ),
                },
            }

        # -----------------------------------------------------
        # Conflict
        # -----------------------------------------------------

        if (
            support_score > 0.20
            and refute_score > 0.20
        ):

            total = (
                support_score
                + refute_score
            )

            difference = abs(
                support_score
                - refute_score
            )

            conflict_ratio = (
                difference / total
                if total > 0
                else 0.0
            )

            # Strong unresolved conflict.
            if conflict_ratio < 0.35:
                return {
                    "verdict": "UNVERIFIED",
                    "confidence": 0.0,
                    "reason": (
                        "Available evidence "
                        "contains conflicting "
                        "information."
                    ),
                    "factcheck_used": (
                        factcheck_count > 0
                    ),
                    "decision_scores": {
                        "supports": round(
                            support_score,
                            4
                        ),
                        "refutes": round(
                            refute_score,
                            4
                        ),
                    },
                }

        # -----------------------------------------------------
        # REAL
        # -----------------------------------------------------

        if support_score > refute_score:

            confidence = self._confidence(
                winning_score=support_score,
                losing_score=refute_score,
                source_count=source_count,
                evidence_count=evidence_count,
                factcheck_count=factcheck_count,
            )

            return {
                "verdict": "REAL",
                "confidence": confidence,
                "reason": (
                    "Available evidence "
                    "supports the claim."
                ),
                "factcheck_used": (
                    factcheck_count > 0
                ),
                "decision_scores": {
                    "supports": round(
                        support_score,
                        4
                    ),
                    "refutes": round(
                        refute_score,
                        4
                    ),
                },
            }

        # -----------------------------------------------------
        # FAKE
        # -----------------------------------------------------

        if refute_score > support_score:

            confidence = self._confidence(
                winning_score=refute_score,
                losing_score=support_score,
                source_count=source_count,
                evidence_count=evidence_count,
                factcheck_count=factcheck_count,
            )

            return {
                "verdict": "FAKE",
                "confidence": confidence,
                "reason": (
                    "Available evidence "
                    "contradicts the claim."
                ),
                "factcheck_used": (
                    factcheck_count > 0
                ),
                "decision_scores": {
                    "supports": round(
                        support_score,
                        4
                    ),
                    "refutes": round(
                        refute_score,
                        4
                    ),
                },
            }

        # -----------------------------------------------------
        # TIE
        # -----------------------------------------------------

        return {
            "verdict": "UNVERIFIED",
            "confidence": 0.0,
            "reason": (
                "Available evidence does not "
                "provide a sufficiently clear "
                "verification result."
            ),
            "factcheck_used": (
                factcheck_count > 0
            ),
            "decision_scores": {
                "supports": round(
                    support_score,
                    4
                ),
                "refutes": round(
                    refute_score,
                    4
                ),
            },
        }