import os
import re
from difflib import SequenceMatcher

import requests
from dotenv import load_dotenv


load_dotenv()


FACTCHECK_API_URL = (
    "https://factchecktools.googleapis.com/v1alpha1/claims:search"
)


class FactCheckService:
    """
    Google Fact Check Tools API integration.

    Searches Google Fact Check and adds:
    - normalized ratings
    - claim relevance
    - publisher quality
    """

    SOURCE_QUALITY = {
        "factcheck.org": 0.95,
        "associated press": 0.95,
        "ap news": 0.95,
        "reuters": 0.95,
        "afp": 0.90,
        "usa today": 0.85,
        "snopes": 0.90,
        "politifact": 0.90,
        "factly": 0.80,
        "boomlive": 0.80,
        "alt news": 0.75,
    }

    def __init__(self):
        print("=" * 60)
        print("Initializing Google Fact Check Service")
        print("=" * 60)

        self.api_key = os.getenv(
            "GOOGLE_FACTCHECK_API_KEY"
        )

        if not self.api_key:
            raise RuntimeError(
                "GOOGLE_FACTCHECK_API_KEY is not configured."
            )

        print("Google Fact Check API key loaded.")
        print("=" * 60)

    # =========================================================
    # TEXT NORMALIZATION
    # =========================================================

    def _normalize_text(self, text: str):
        if not text:
            return ""

        text = text.lower()

        text = re.sub(
            r"[^a-z0-9\s]",
            " ",
            text
        )

        text = re.sub(
            r"\s+",
            " ",
            text
        )

        return text.strip()

    def _words(self, text: str):
        stop_words = {
            "the",
            "a",
            "an",
            "and",
            "or",
            "of",
            "to",
            "in",
            "on",
            "for",
            "is",
            "are",
            "was",
            "were",
            "be",
            "this",
            "that",
            "it",
            "as",
            "by",
            "from",
            "with",
            "about",
            "does",
            "do",
            "how",
            "why",
            "what",
            "when",
            "where",
            "who",
        }

        normalized = self._normalize_text(text)

        return {
            word
            for word in normalized.split()
            if word not in stop_words
            and len(word) > 2
        }

    # =========================================================
    # STRING SIMILARITY
    # =========================================================

    def _sequence_similarity(
        self,
        user_claim: str,
        fact_claim: str
    ):
        user_text = self._normalize_text(
            user_claim
        )

        fact_text = self._normalize_text(
            fact_claim
        )

        if not user_text or not fact_text:
            return 0.0

        return SequenceMatcher(
            None,
            user_text,
            fact_text
        ).ratio()

    # =========================================================
    # WORD COVERAGE
    # =========================================================

    def _word_coverage(
        self,
        user_claim: str,
        fact_claim: str
    ):
        user_words = self._words(
            user_claim
        )

        fact_words = self._words(
            fact_claim
        )

        if not user_words:
            return 0.0

        overlap = user_words.intersection(
            fact_words
        )

        return len(overlap) / len(user_words)

    # =========================================================
    # CLAIM RELEVANCE
    # =========================================================

    def _claim_relevance(
        self,
        user_claim: str,
        fact_claim: str
    ):
        """
        Calculate how relevant a fact-check claim is
        to the user's claim.

        Fact-check claims are often longer than the
        original user claim, so user-claim coverage
        receives the strongest weight.
        """

        if not user_claim or not fact_claim:
            return 0.0

        user_words = self._words(
            user_claim
        )

        fact_words = self._words(
            fact_claim
        )

        if not user_words or not fact_words:
            return 0.0

        overlap = user_words.intersection(
            fact_words
        )

        user_coverage = (
            len(overlap)
            / len(user_words)
        )

        fact_coverage = (
            len(overlap)
            / len(fact_words)
        )

        # F1-style lexical overlap.
        if user_coverage + fact_coverage > 0:
            lexical_f1 = (
                2
                * user_coverage
                * fact_coverage
                / (
                    user_coverage
                    + fact_coverage
                )
            )
        else:
            lexical_f1 = 0.0

        sequence_similarity = (
            self._sequence_similarity(
                user_claim,
                fact_claim
            )
        )

        relevance = (
            (user_coverage * 0.60)
            + (lexical_f1 * 0.25)
            + (sequence_similarity * 0.15)
        )

        return round(
            min(relevance, 1.0),
            4
        )

    # =========================================================
    # RATING NORMALIZATION
    # =========================================================

    def _normalize_rating(
        self,
        rating: str
    ):
        if not rating:
            return "UNKNOWN"

        normalized = rating.strip().lower()

        false_terms = {
            "false",
            "fake",
            "incorrect",
            "wrong",
            "pants on fire",
            "mostly false",
            "four pinocchios",
        }

        true_terms = {
            "true",
            "correct",
            "accurate",
            "verified",
            "mostly true",
            "three pinocchios",
        }

        mixed_terms = {
            "mixed",
            "partly true",
            "half true",
            "partially true",
            "missing context",
            "needs context",
            "out of context",
            "misleading",
        }

        for term in false_terms:
            if term in normalized:
                return "FALSE"

        for term in true_terms:
            if term in normalized:
                return "TRUE"

        for term in mixed_terms:
            if term in normalized:
                return "MIXED"

        return "UNKNOWN"

    # =========================================================
    # PUBLISHER QUALITY
    # =========================================================

    def _publisher_quality(
        self,
        publisher: str
    ):
        if not publisher:
            return 0.50

        normalized = publisher.strip().lower()

        if normalized in self.SOURCE_QUALITY:
            return self.SOURCE_QUALITY[
                normalized
            ]

        for name, score in self.SOURCE_QUALITY.items():
            if name in normalized:
                return score

        return 0.50

    # =========================================================
    # GOOGLE FACT CHECK SEARCH
    # =========================================================

    def search(
        self,
        query: str,
        page_size: int = 10,
        language_code: str = "en"
    ):
        if not query or not query.strip():
            raise ValueError(
                "Fact-check query cannot be empty."
            )

        params = {
            "query": query.strip(),
            "pageSize": page_size,
            "languageCode": language_code,
            "key": self.api_key,
        }

        try:
            response = requests.get(
                FACTCHECK_API_URL,
                params=params,
                timeout=30
            )

            response.raise_for_status()

        except requests.exceptions.HTTPError as error:

            status_code = (
                error.response.status_code
                if error.response is not None
                else "unknown"
            )

            try:
                error_details = (
                    error.response.json()
                )
            except Exception:
                error_details = (
                    error.response.text
                    if error.response
                    else str(error)
                )

            raise RuntimeError(
                f"Fact Check API HTTP error "
                f"{status_code}: {error_details}"
            ) from error

        except requests.exceptions.RequestException as error:

            raise RuntimeError(
                f"Fact Check API request failed: {error}"
            ) from error

        data = response.json()

        return self._parse_results(
            data,
            query
        )

    # =========================================================
    # RESULT PARSING
    # =========================================================

    def _parse_results(
        self,
        data: dict,
        user_claim: str
    ):
        results = []

        claims = data.get(
            "claims",
            []
        )

        for claim_item in claims:

            fact_claim = claim_item.get(
                "text",
                ""
            )

            claim_reviews = claim_item.get(
                "claimReview",
                []
            )

            relevance = self._claim_relevance(
                user_claim,
                fact_claim
            )

            for review in claim_reviews:

                publisher = review.get(
                    "publisher",
                    {}
                )

                publisher_name = publisher.get(
                    "name"
                )

                rating = review.get(
                    "textualRating"
                )

                normalized_rating = (
                    self._normalize_rating(
                        rating
                    )
                )

                publisher_quality = (
                    self._publisher_quality(
                        publisher_name
                    )
                )

                results.append({
                    "claim": fact_claim,

                    "publisher": publisher_name,

                    "publisher_site": publisher.get(
                        "site"
                    ),

                    "title": review.get(
                        "title"
                    ),

                    "url": review.get(
                        "url"
                    ),

                    "review_date": review.get(
                        "reviewDate"
                    ),

                    "rating": rating,

                    "normalized_rating": (
                        normalized_rating
                    ),

                    "language_code": review.get(
                        "languageCode"
                    ),

                    "relevance_score": (
                        relevance
                    ),

                    "publisher_quality": round(
                        publisher_quality,
                        4
                    ),

                    "relevant": (
                        relevance >= 0.35
                    ),
                })

        results.sort(
            key=lambda item: (
                item["relevance_score"],
                item["publisher_quality"]
            ),
            reverse=True
        )

        return results