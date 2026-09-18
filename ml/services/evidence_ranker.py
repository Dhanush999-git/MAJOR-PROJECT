import re


class EvidenceRanker:

    # ========================================================
    # SOURCE QUALITY
    # ========================================================

    SOURCE_QUALITY = {

        # High-quality reference / scientific sources
        "britannica": 1.00,
        "nasa": 1.00,
        "national geographic": 0.95,

        # Established news organizations
        "associated press": 0.95,
        "ap": 0.95,
        "reuters": 0.95,
        "bbc": 0.95,

        # Established fact-checking organizations
        "factcheck.org": 0.95,
        "snopes": 0.90,
        "afp": 0.90,

        # General sources
        "earthsky": 0.80,
        "scienceabc": 0.70,
        "space daily": 0.65,
    }


    # ========================================================
    # CONSTRUCTOR
    # ========================================================

    def __init__(self):

        print("=" * 60)
        print("Initializing Evidence Ranking Service")
        print("=" * 60)


    # ========================================================
    # NORMALIZE WORDS
    # ========================================================

    def _normalize_words(
        self,
        text: str
    ):

        words = re.findall(
            r"\b[a-zA-Z0-9]+\b",
            text.lower()
        )

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
            "around",
            "about",
            "does",
            "do",
            "why",
            "how",
            "what",
            "when",
            "where",
            "who",
        }

        return {
            word
            for word in words
            if word not in stop_words
            and len(word) > 2
        }


    # ========================================================
    # KEYWORD OVERLAP
    # ========================================================

    def _keyword_overlap(
        self,
        claim: str,
        evidence: str
    ):

        claim_words = self._normalize_words(
            claim
        )

        evidence_words = self._normalize_words(
            evidence
        )

        if not claim_words:

            return 0.0

        overlap = (
            claim_words.intersection(
                evidence_words
            )
        )

        return (
            len(overlap)
            / len(claim_words)
        )


    # ========================================================
    # CONCEPT OVERLAP
    # ========================================================

    def _concept_overlap(
        self,
        claim: str,
        evidence: str
    ):

        claim_words = self._normalize_words(
            claim
        )

        evidence_words = self._normalize_words(
            evidence
        )

        generic_words = {
            "earth",
            "world",
            "people",
            "year",
            "years",
            "time",
            "day",
            "days",
        }

        meaningful_claim_words = {
            word
            for word in claim_words
            if word not in generic_words
        }

        if not meaningful_claim_words:

            return 0.0

        overlap = (
            meaningful_claim_words.intersection(
                evidence_words
            )
        )

        return (
            len(overlap)
            / len(meaningful_claim_words)
        )


    # ========================================================
    # DIRECTNESS
    # ========================================================

    def _directness_score(
        self,
        similarity: float,
        concept_overlap: float
    ):

        if (
            similarity >= 0.55
            and concept_overlap >= 0.50
        ):

            return 1.0

        if (
            similarity >= 0.45
            and concept_overlap >= 0.50
        ):

            return 0.75

        if concept_overlap >= 0.50:

            return 0.50

        return 0.0


    # ========================================================
    # USEFULNESS
    # ========================================================

    def _usefulness_score(
        self,
        text: str
    ):

        word_count = len(
            text.split()
        )

        if word_count < 10:

            return 0.20

        if word_count < 30:

            return 0.60

        return 1.00


    # ========================================================
    # SOURCE QUALITY
    # ========================================================

    def _source_quality(
        self,
        source: str
    ):

        if not source:

            return 0.50

        normalized = (
            source.strip()
            .lower()
        )

        # Exact match first
        if normalized in self.SOURCE_QUALITY:

            return self.SOURCE_QUALITY[
                normalized
            ]

        # Partial match
        for name, score in (
            self.SOURCE_QUALITY.items()
        ):

            if (
                name in normalized
                or normalized in name
            ):

                return score

        return 0.50


    # ========================================================
    # EVIDENCE TYPE QUALITY
    # ========================================================

    def _evidence_type_quality(
        self,
        evidence_type: str
    ):

        if not evidence_type:

            return 0.40

        evidence_type = (
            evidence_type
            .strip()
            .lower()
        )

        if evidence_type == "article":

            return 1.00

        if evidence_type == "article_excerpt":

            return 0.75

        if evidence_type == "rss_description":

            return 0.45

        if evidence_type == "rss_title":

            return 0.20

        return 0.40


    # ========================================================
    # FINAL RANKING
    # ========================================================

    def rank(
        self,
        claim: str,
        evidence_passages: list,
        minimum_similarity: float = 0.35,
        minimum_concept_overlap: float = 0.20,
        top_k: int = 5
    ):

        if not claim or not claim.strip():

            raise ValueError(
                "Claim cannot be empty."
            )

        if not evidence_passages:

            return []

        ranked = []


        for passage in evidence_passages:

            if not isinstance(
                passage,
                dict
            ):

                continue


            text = passage.get(
                "text",
                ""
            ).strip()


            similarity = float(
                passage.get(
                    "similarity",
                    0.0
                )
            )


            source = passage.get(
                "source",
                ""
            )


            evidence_type = passage.get(
                "evidence_type",
                ""
            )


            if not text:

                continue


            if similarity < minimum_similarity:

                continue


            keyword_overlap = (
                self._keyword_overlap(
                    claim,
                    text
                )
            )


            concept_overlap = (
                self._concept_overlap(
                    claim,
                    text
                )
            )


            if (
                concept_overlap
                < minimum_concept_overlap
            ):

                continue


            directness = (
                self._directness_score(
                    similarity,
                    concept_overlap
                )
            )


            usefulness = (
                self._usefulness_score(
                    text
                )
            )


            source_quality = (
                self._source_quality(
                    source
                )
            )


            evidence_type_quality = (
                self._evidence_type_quality(
                    evidence_type
                )
            )


            # ------------------------------------------------
            # BASE RELEVANCE
            # ------------------------------------------------

            relevance_score = (
                (similarity * 0.45)
                + (concept_overlap * 0.25)
                + (directness * 0.10)
                + (usefulness * 0.05)
            )


            # ------------------------------------------------
            # QUALITY MULTIPLIER
            # ------------------------------------------------

            quality_multiplier = (
                source_quality * 0.60
                + evidence_type_quality * 0.40
            )


            evidence_score = (
                relevance_score
                * quality_multiplier
            )


            ranked.append(
                {
                    "text": text,

                    "similarity": round(
                        similarity,
                        4
                    ),

                    "keyword_overlap": round(
                        keyword_overlap,
                        4
                    ),

                    "concept_overlap": round(
                        concept_overlap,
                        4
                    ),

                    "directness": round(
                        directness,
                        4
                    ),

                    "usefulness": round(
                        usefulness,
                        4
                    ),

                    "source": source,

                    "source_quality": round(
                        source_quality,
                        4
                    ),

                    "evidence_type": (
                        evidence_type
                    ),

                    "evidence_type_quality": round(
                        evidence_type_quality,
                        4
                    ),

                    "quality_multiplier": round(
                        quality_multiplier,
                        4
                    ),

                    "evidence_score": round(
                        evidence_score,
                        4
                    ),
                }
            )


        ranked.sort(
            key=lambda item: item[
                "evidence_score"
            ],
            reverse=True
        )


        return ranked[
            :top_k
        ]