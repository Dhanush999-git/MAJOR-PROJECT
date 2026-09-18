import re

import torch
from sentence_transformers import SentenceTransformer, util


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


class EvidenceSelector:

    def __init__(self):

        print("=" * 60)
        print("Loading Evidence Selection Model")
        print("=" * 60)

        print(f"Model: {MODEL_NAME}")

        self.device = (
            "cuda"
            if torch.cuda.is_available()
            else "cpu"
        )

        print(f"Device: {self.device}")

        self.model = SentenceTransformer(
            MODEL_NAME,
            device=self.device
        )

        print(
            "Evidence selection model loaded successfully."
        )

        print("=" * 60)


    # =========================================================
    # CLEAN TEXT
    # =========================================================

    def _clean_text(
        self,
        text: str
    ):

        if not text:

            return ""

        text = text.replace(
            "\xa0",
            " "
        )

        # Fix common missing spaces caused by HTML extraction.
        text = re.sub(
            r"([a-z])([A-Z])",
            r"\1 \2",
            text
        )

        text = re.sub(
            r"\s+",
            " ",
            text
        )

        return text.strip()


    # =========================================================
    # SPLIT ARTICLE INTO PASSAGES
    # =========================================================

    def split_into_passages(
        self,
        article_text: str
    ):

        if not article_text or not article_text.strip():

            return []


        # Split on blank lines first.
        raw_passages = re.split(
            r"\n\s*\n",
            article_text
        )


        passages = []


        for passage in raw_passages:

            passage = passage.strip()


            if not passage:

                continue


            passage = self._clean_text(
                passage
            )


            # Ignore extremely short fragments.
            if len(passage) < 50:

                continue


            lower = passage.lower()


            ignored_patterns = [

                "media editor:",

                "© britannica",

                "â© britannica",

                "encyclopædia britannica, inc.",

                "encyclopÃ¦dia britannica, inc.",

                "sign up",

                "subscribe",

                "newsletter",

                "cookie policy",

                "privacy policy",

                "terms of use",

                "advertisement",

                "advertisements",

            ]


            if any(
                pattern in lower
                for pattern in ignored_patterns
            ):

                continue


            passages.append(
                passage
            )


        return passages


    # =========================================================
    # SELECT FROM ONE SOURCE
    # =========================================================

    def _select_from_source(
        self,
        claim: str,
        source: dict,
        top_k: int
    ):

        evidence_text = source.get(
            "evidence_text",
            ""
        )


        if not evidence_text:

            return []


        passages = self.split_into_passages(
            evidence_text
        )


        if not passages:

            return []


        claim_embedding = self.model.encode(
            claim,
            convert_to_tensor=True,
            normalize_embeddings=True
        )


        passage_embeddings = self.model.encode(
            passages,
            convert_to_tensor=True,
            normalize_embeddings=True
        )


        similarities = util.cos_sim(
            claim_embedding,
            passage_embeddings
        )[0]


        top_k = min(
            top_k,
            len(passages)
        )


        top_results = torch.topk(
            similarities,
            k=top_k
        )


        selected = []


        for score, index in zip(
            top_results.values,
            top_results.indices
        ):

            passage_index = int(
                index.item()
            )


            selected.append({

                "text":
                    passages[passage_index],

                "similarity":
                    round(
                        float(score.item()),
                        4
                    ),

                "passage_index":
                    passage_index,

                # -------------------------------------------------
                # Preserve source metadata.
                # -------------------------------------------------

                "source":
                    source.get(
                        "publisher"
                    ),

                "title":
                    source.get(
                        "title"
                    ),

                "url":
                    (
                        source.get("article_url")
                        or source.get(
                            "google_news_url"
                        )
                    ),

                "google_news_url":
                    source.get(
                        "google_news_url"
                    ),

                "publisher_url":
                    source.get(
                        "publisher_url"
                    ),

                "published":
                    source.get(
                        "published"
                    ),

                "evidence_type":
                    source.get(
                        "evidence_type"
                    ),

                "resolved":
                    source.get(
                        "resolved",
                        False
                    ),

                "extracted":
                    source.get(
                        "extracted",
                        False
                    ),
            })


        return selected


    # =========================================================
    # SELECT FROM MULTIPLE SOURCES
    # =========================================================

    def select_sources(
        self,
        claim: str,
        sources: list,
        top_k_per_source: int = 3,
        max_total: int = 15
    ):

        if not claim or not claim.strip():

            raise ValueError(
                "Claim cannot be empty."
            )


        if not sources:

            return []


        all_selected = []


        for source in sources:

            if not isinstance(
                source,
                dict
            ):

                continue


            selected = self._select_from_source(
                claim=claim,
                source=source,
                top_k=top_k_per_source
            )


            all_selected.extend(
                selected
            )


        # ---------------------------------------------------------
        # Rank all candidate passages by semantic similarity.
        # ---------------------------------------------------------

        all_selected.sort(
            key=lambda item: item[
                "similarity"
            ],
            reverse=True
        )


        return all_selected[
            :max_total
        ]


    # =========================================================
    # BACKWARD-COMPATIBLE SINGLE ARTICLE METHOD
    # =========================================================

    def select(
        self,
        claim: str,
        article_text: str,
        top_k: int = 5
    ):

        if not claim or not claim.strip():

            raise ValueError(
                "Claim cannot be empty."
            )


        if not article_text or not article_text.strip():

            raise ValueError(
                "Article text cannot be empty."
            )


        source = {
            "evidence_text":
                article_text
        }


        return self._select_from_source(
            claim=claim,
            source=source,
            top_k=top_k
        )