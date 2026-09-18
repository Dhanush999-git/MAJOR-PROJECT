from models.text_nli_detector import TextNLIVerifier


class EvidenceVerifier:

    def __init__(self):

        print("=" * 60)
        print("Loading Evidence Verification Service")
        print("=" * 60)

        self.nli = TextNLIVerifier()

        print("Evidence verification service ready.")
        print("=" * 60)

    def verify_single(
        self,
        claim: str,
        evidence: str
    ):

        result = self.nli.predict(
            claim=claim,
            evidence=evidence
        )

        return {
            "evidence": evidence,
            "verdict": result["verdict"],
            "confidence": result["confidence"],
            "probabilities": result["probabilities"]
        }

    def verify_multiple(
        self,
        claim: str,
        evidence_passages: list
    ):

        if not claim or not claim.strip():
            raise ValueError(
                "Claim cannot be empty."
            )

        if not evidence_passages:
            return {
                "final_verdict": "NOT_ENOUGH_INFO",
                "confidence": 0.0,
                "evidence_results": []
            }

        results = []

        for passage in evidence_passages:

            if isinstance(passage, dict):

                evidence_text = passage.get(
                    "text",
                    ""
                )

                similarity = float(
                    passage.get(
                        "similarity",
                        0.0
                    )
                )

            else:

                evidence_text = str(
                    passage
                )

                similarity = 1.0

            if not evidence_text.strip():
                continue

            nli_result = self.verify_single(
                claim=claim,
                evidence=evidence_text
            )

            # Combine semantic relevance and NLI confidence.
            evidence_weight = (
                similarity
                * nli_result["confidence"]
            )

            results.append({
                **nli_result,
                "similarity": round(
                    similarity,
                    4
                ),
                "evidence_weight": round(
                    evidence_weight,
                    4
                )
            })

        if not results:

            return {
                "final_verdict": "NOT_ENOUGH_INFO",
                "confidence": 0.0,
                "evidence_results": []
            }

        support_score = sum(
            result["evidence_weight"]
            for result in results
            if result["verdict"] == "SUPPORTS"
        )

        refute_score = sum(
            result["evidence_weight"]
            for result in results
            if result["verdict"] == "REFUTES"
        )

        total_score = (
            support_score
            + refute_score
        )

        if total_score == 0:

            final_verdict = "NOT_ENOUGH_INFO"
            final_confidence = 0.0

        elif refute_score > support_score:

            final_verdict = "REFUTES"

            final_confidence = (
                refute_score
                / total_score
            )

        elif support_score > refute_score:

            final_verdict = "SUPPORTS"

            final_confidence = (
                support_score
                / total_score
            )

        else:

            final_verdict = "NOT_ENOUGH_INFO"

            final_confidence = 0.0

        return {
            "final_verdict": final_verdict,

            "confidence": round(
                final_confidence,
                4
            ),

            "evidence_results": results,

            "summary": {
                "supports": sum(
                    1
                    for result in results
                    if result["verdict"] == "SUPPORTS"
                ),

                "refutes": sum(
                    1
                    for result in results
                    if result["verdict"] == "REFUTES"
                ),

                "not_enough_info": sum(
                    1
                    for result in results
                    if result["verdict"]
                    == "NOT_ENOUGH_INFO"
                )
            }
        }