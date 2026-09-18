from services.factcheck_service import FactCheckService
from services.google_news_service import GoogleNewsService
from services.article_extractor import ArticleExtractor
from services.evidence_selector import EvidenceSelector
from services.evidence_verifier import EvidenceVerifier
from services.verdict_engine import VerdictEngine


class VerificationPipeline:

    def __init__(self):

        print("=" * 70)
        print("Initializing VeriFact Verification Pipeline")
        print("=" * 70)

        self.factcheck = FactCheckService()

        self.news = GoogleNewsService()

        self.extractor = ArticleExtractor()

        self.selector = EvidenceSelector()

        self.verifier = EvidenceVerifier()

        self.verdict_engine = VerdictEngine()

        print("Verification pipeline ready.")

        print("=" * 70)

    def verify(self, claim: str):

        if not claim or not claim.strip():

            raise ValueError(
                "Claim cannot be empty."
            )

        claim = claim.strip()

        # --------------------------------------------------
        # STEP 1
        # Google Fact Check
        # --------------------------------------------------

        print("\nSTEP 1 — Google Fact Check")

        factcheck_results = self.factcheck.search(
            query=claim,
            page_size=5
        )

        print(
            "Fact-check results:",
            len(factcheck_results)
        )

        sources = []

        source_type = "fact_check"

        if factcheck_results:

            for result in factcheck_results:

                sources.append({
                    **result,
                    "source_type": source_type
                })

        # --------------------------------------------------
        # STEP 2
        # Google News fallback
        # --------------------------------------------------

        if not sources:

            print(
                "\nNo existing fact-check found."
            )

            print(
                "STEP 2 — Google News Search"
            )

            news_results = self.news.search(
                query=claim,
                max_results=5
            )

            print(
                "News results:",
                len(news_results)
            )

            for result in news_results:

                sources.append({
                    **result,
                    "source_type": "news"
                })

        # --------------------------------------------------
        # No sources
        # --------------------------------------------------

        if not sources:

            return {
                "claim": claim,

                "verdict": "UNVERIFIED",

                "confidence": 0.0,

                "reason": (
                    "No relevant evidence sources "
                    "were found."
                ),

                "sources": []
            }

        evidence_records = []

        # --------------------------------------------------
        # STEP 3
        # Process sources
        # --------------------------------------------------

        for source in sources:

            url = source.get(
                "url"
            )

            if not url:
                continue

            print(
                "\nProcessing source:"
            )

            print(url)

            try:

                article_text = (
                    self.extractor.extract(
                        url
                    )
                )

            except Exception as error:

                print(
                    "Article extraction failed:",
                    error
                )

                continue

            # --------------------------------------------------
            # STEP 4
            # Evidence selection
            # --------------------------------------------------

            selected = self.selector.select(
                claim=claim,
                article_text=article_text,
                top_k=5
            )

            if not selected:
                continue

            # --------------------------------------------------
            # STEP 5
            # NLI verification
            # --------------------------------------------------

            nli_result = (
                self.verifier.verify_multiple(
                    claim=claim,
                    evidence_passages=selected
                )
            )

            evidence_records.append({

                "source": source,

                "nli": nli_result

            })

        # --------------------------------------------------
        # No usable evidence
        # --------------------------------------------------

        if not evidence_records:

            return {
                "claim": claim,

                "verdict": "UNVERIFIED",

                "confidence": 0.0,

                "reason": (
                    "Sources were found, but usable "
                    "evidence could not be extracted."
                ),

                "sources": []
            }

        # --------------------------------------------------
        # STEP 6
        # Aggregate source decisions
        # --------------------------------------------------

        fake_scores = []

        real_scores = []

        for record in evidence_records:

            source = record["source"]

            nli_result = record["nli"]

            rating = source.get(
                "rating"
            )

            decision = (
                self.verdict_engine.decide(
                    factcheck_rating=rating,
                    nli_result=nli_result
                )
            )

            record["decision"] = decision

            if decision["verdict"] == "FAKE":

                fake_scores.append(
                    decision["confidence"]
                )

            elif decision["verdict"] == "REAL":

                real_scores.append(
                    decision["confidence"]
                )

        # --------------------------------------------------
        # STEP 7
        # Final aggregation
        # --------------------------------------------------

        fake_score = (
            sum(fake_scores)
            / len(fake_scores)
            if fake_scores
            else 0.0
        )

        real_score = (
            sum(real_scores)
            / len(real_scores)
            if real_scores
            else 0.0
        )

        if (
            fake_score > real_score
            and fake_score >= 0.60
        ):

            final_verdict = "FAKE"

            final_confidence = fake_score

        elif (
            real_score > fake_score
            and real_score >= 0.60
        ):

            final_verdict = "REAL"

            final_confidence = real_score

        else:

            final_verdict = "UNVERIFIED"

            final_confidence = max(
                fake_score,
                real_score
            )

        return {

            "claim": claim,

            "verdict": final_verdict,

            "confidence": round(
                final_confidence,
                4
            ),

            "reason": (
                "Decision based on retrieved "
                "fact-check/news evidence and "
                "NLI verification."
            ),

            "source_count": len(
                evidence_records
            ),

            "sources": evidence_records
        }