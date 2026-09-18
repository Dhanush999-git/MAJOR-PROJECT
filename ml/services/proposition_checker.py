import re


class PropositionChecker:
    """
    Conservative proposition-direction checker.

    Returns:
        MATCH
        REVERSED
        CONTRADICTS
        UNKNOWN

    The checker is designed primarily to protect the verification
    pipeline from directional errors such as:

        Earth revolves around Sun
        Sun revolves around Earth

    It searches individual clauses/sentences instead of trying to
    parse an entire article as one proposition.
    """

    RELATIONS = {
        "revolves_around": [
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+revolves\s+around\s+(?P<object>[a-z][a-z\s']{0,80})\b",
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+revolve\s+around\s+(?P<object>[a-z][a-z\s']{0,80})\b",
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+orbits\s+(?P<object>[a-z][a-z\s']{0,80})\b",
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+orbit\s+(?P<object>[a-z][a-z\s']{0,80})\b",
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+is\s+orbiting\s+(?P<object>[a-z][a-z\s']{0,80})\b",
        ],
        "larger_than": [
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+is\s+larger\s+than\s+(?P<object>[a-z][a-z\s']{0,80})\b",
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+is\s+bigger\s+than\s+(?P<object>[a-z][a-z\s']{0,80})\b",
        ],
        "smaller_than": [
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+is\s+smaller\s+than\s+(?P<object>[a-z][a-z\s']{0,80})\b",
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+is\s+less\s+than\s+(?P<object>[a-z][a-z\s']{0,80})\b",
        ],
        "older_than": [
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+is\s+older\s+than\s+(?P<object>[a-z][a-z\s']{0,80})\b",
        ],
        "younger_than": [
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+is\s+younger\s+than\s+(?P<object>[a-z][a-z\s']{0,80})\b",
        ],
        "causes": [
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+causes\s+(?P<object>[a-z][a-z\s']{0,80})\b",
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+caused\s+(?P<object>[a-z][a-z\s']{0,80})\b",
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+leads\s+to\s+(?P<object>[a-z][a-z\s']{0,80})\b",
        ],
        "located_in": [
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+is\s+located\s+in\s+(?P<object>[a-z][a-z\s']{0,80})\b",
        ],
    }

    NEGATED_RELATIONS = {
        "revolves_around": [
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+does\s+not\s+revolve\s+around\s+(?P<object>[a-z][a-z\s']{0,80})\b",
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+doesn't\s+revolve\s+around\s+(?P<object>[a-z][a-z\s']{0,80})\b",
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+does\s+not\s+orbit\s+(?P<object>[a-z][a-z\s']{0,80})\b",
            r"\b(?P<subject>[a-z][a-z\s']{0,80}?)\s+doesn't\s+orbit\s+(?P<object>[a-z][a-z\s']{0,80})\b",
        ],
    }

    ENTITY_ALIASES = {
        "earth": {
            "earth",
            "earth's",
            "our planet",
            "the earth",
        },
        "sun": {
            "sun",
            "the sun",
            "our sun",
            "our home star",
        },
        "moon": {
            "moon",
            "the moon",
        },
    }

    STOP_WORDS = {
        "the",
        "a",
        "an",
        "our",
        "home",
        "star",
        "planet",
        "one",
        "full",
        "trip",
        "around",
        "approximately",
        "about",
        "because",
        "why",
        "how",
        "what",
        "which",
        "that",
        "this",
        "it",
        "its",
        "also",
        "just",
        "though",
        "rather",
        "we",
        "are",
        "is",
        "was",
        "were",
        "does",
        "do",
        "did",
        "not",
        "never",
    }

    def __init__(self):
        print("=" * 60)
        print("Initializing Proposition Consistency Checker")
        print("=" * 60)
        print("Proposition Consistency Checker ready.")
        print("=" * 60)

    def _normalize_text(self, text: str):
        if not text:
            return ""

        text = text.replace("\xa0", " ")

        # Repair common UTF-8 mojibake.
        replacements = {
            "â€™": "'",
            "â€˜": "'",
            "â€œ": '"',
            "â€�": '"',
            "â€¦": "...",
            "â€“": "-",
            "â€”": "-",
            "â€": "",
            "Ã©": "é",
            "Ã¨": "è",
            "Ã¡": "á",
            "Ã³": "ó",
            "Â": "",
        }

        for broken, fixed in replacements.items():
            text = text.replace(broken, fixed)

        text = text.lower()

        # Normalize apostrophe variants and punctuation.
        text = text.replace("’", "'")
        text = text.replace("‘", "'")
        text = text.replace("“", '"')
        text = text.replace("”", '"')

        text = re.sub(r"[^a-z0-9'\s]", " ", text)
        text = re.sub(r"\s+", " ", text)

        return text.strip()

    def _split_clauses(self, text: str):
        normalized = self._normalize_text(text)

        if not normalized:
            return []

        # Break article text into manageable propositions.
        clauses = re.split(
            r"\s+(?:but|though|although|rather|however|because|since)\s+|"
            r"\s*;\s*|\s*\.\s*|\s*:\s*",
            normalized,
        )

        result = []

        for clause in clauses:
            clause = clause.strip()

            if len(clause) < 5:
                continue

            result.append(clause)

        return result

    def _canonical_entity(self, text: str):
        normalized = self._normalize_text(text)

        if not normalized:
            return ""

        # Direct known aliases.
        for canonical, aliases in self.ENTITY_ALIASES.items():
            for alias in aliases:
                if re.search(
                    rf"\b{re.escape(alias)}\b",
                    normalized,
                ):
                    return canonical

        # Pronouns cannot safely identify an entity by themselves.
        return ""

    def _clean_entity(self, text: str):
        canonical = self._canonical_entity(text)

        if canonical:
            return canonical

        normalized = self._normalize_text(text)

        words = [
            word
            for word in normalized.split()
            if word not in self.STOP_WORDS
        ]

        return " ".join(words).strip()

    def _extract_direct_relation(self, clause: str):
        clause = self._normalize_text(clause)

        if not clause:
            return None

        # Negative relation first.
        for relation, patterns in self.NEGATED_RELATIONS.items():
            for pattern in patterns:
                match = re.search(pattern, clause)

                if not match:
                    continue

                subject = self._clean_entity(
                    match.group("subject")
                )
                object_value = self._clean_entity(
                    match.group("object")
                )

                if subject and object_value:
                    return {
                        "relation": relation,
                        "subject": subject,
                        "object": object_value,
                        "negated": True,
                    }

        # Positive relation.
        for relation, patterns in self.RELATIONS.items():
            for pattern in patterns:
                match = re.search(pattern, clause)

                if not match:
                    continue

                subject = self._clean_entity(
                    match.group("subject")
                )
                object_value = self._clean_entity(
                    match.group("object")
                )

                if subject and object_value:
                    return {
                        "relation": relation,
                        "subject": subject,
                        "object": object_value,
                        "negated": False,
                    }

        return None

    def _extract_special_revolve_relation(self, clause: str):
        """
        Handles article constructions such as:

            why does it revolve around the Sun

        and:

            Earth ... and revolves around the Sun

        The pronoun "it" is resolved from the nearest known entity
        appearing before the relation.
        """

        clause = self._normalize_text(clause)

        if not clause:
            return None

        match = re.search(
            r"\bwhy\s+does\s+(?P<subject>[a-z][a-z\s']{0,50}?)"
            r"\s+revolve[s]?\s+around\s+"
            r"(?P<object>[a-z][a-z\s']{0,50})\b",
            clause,
        )

        if match:
            raw_subject = match.group("subject")
            raw_object = match.group("object")

            subject = self._clean_entity(raw_subject)
            object_value = self._clean_entity(raw_object)

            # Resolve "it" from an earlier known entity.
            if subject == "it":
                before = clause[:match.start()]
                subject = self._find_nearest_known_entity(
                    before
                )

            if subject and object_value:
                return {
                    "relation": "revolves_around",
                    "subject": subject,
                    "object": object_value,
                    "negated": False,
                }

        # "Earth ... revolves around Sun" with other words
        # between subject and relation.
        for entity_name in (
            "earth",
            "sun",
            "moon",
        ):
            pattern = (
                rf"\b{entity_name}\b"
                rf".{{0,100}}?"
                rf"\brevolves?\s+around\s+"
                rf"(?P<object>[a-z][a-z\s']{{0,50}})"
            )

            match = re.search(
                pattern,
                clause,
            )

            if not match:
                continue

            object_value = self._clean_entity(
                match.group("object")
            )

            if object_value:
                return {
                    "relation": "revolves_around",
                    "subject": entity_name,
                    "object": object_value,
                    "negated": False,
                }

        return None

    def _find_nearest_known_entity(self, text: str):
        normalized = self._normalize_text(text)

        positions = []

        for canonical, aliases in self.ENTITY_ALIASES.items():
            for alias in aliases:
                match = re.search(
                    rf"\b{re.escape(alias)}\b",
                    normalized,
                )

                if match:
                    positions.append(
                        (
                            match.end(),
                            canonical,
                        )
                    )

        if not positions:
            return ""

        positions.sort(
            key=lambda item: item[0],
            reverse=True,
        )

        return positions[0][1]

    def _extract_relation(self, text: str):
        normalized = self._normalize_text(text)

        if not normalized:
            return None

        clauses = self._split_clauses(
            normalized
        )

        # Try individual clauses first.
        for clause in clauses:
            relation = self._extract_direct_relation(
                clause
            )

            if relation:
                return relation

            relation = self._extract_special_revolve_relation(
                clause
            )

            if relation:
                return relation

        # Try complete normalized text as fallback.
        relation = self._extract_direct_relation(
            normalized
        )

        if relation:
            return relation

        return self._extract_special_revolve_relation(
            normalized
        )

    def _same_direction(
        self,
        claim,
        evidence,
    ):
        return (
            claim["subject"] == evidence["subject"]
            and claim["object"] == evidence["object"]
        )

    def _reversed_direction(
        self,
        claim,
        evidence,
    ):
        return (
            claim["subject"] == evidence["object"]
            and claim["object"] == evidence["subject"]
        )

    def check(
        self,
        claim: str,
        evidence: str,
    ):
        if not claim or not claim.strip():
            raise ValueError(
                "Claim cannot be empty."
            )

        if not evidence or not evidence.strip():
            raise ValueError(
                "Evidence cannot be empty."
            )

        claim_relation = self._extract_relation(
            claim
        )

        evidence_relation = self._extract_relation(
            evidence
        )

        if (
            claim_relation is None
            or evidence_relation is None
        ):
            return {
                "relationship": "UNKNOWN",
                "confidence": 0.0,
                "claim_relation": claim_relation,
                "evidence_relation": evidence_relation,
            }

        if (
            claim_relation["relation"]
            != evidence_relation["relation"]
        ):
            return {
                "relationship": "UNKNOWN",
                "confidence": 0.0,
                "claim_relation": claim_relation,
                "evidence_relation": evidence_relation,
            }

        if self._same_direction(
            claim_relation,
            evidence_relation,
        ):
            if (
                claim_relation["negated"]
                != evidence_relation["negated"]
            ):
                return {
                    "relationship": "CONTRADICTS",
                    "confidence": 0.95,
                    "claim_relation": claim_relation,
                    "evidence_relation": evidence_relation,
                }

            return {
                "relationship": "MATCH",
                "confidence": 0.95,
                "claim_relation": claim_relation,
                "evidence_relation": evidence_relation,
            }

        if self._reversed_direction(
            claim_relation,
            evidence_relation,
        ):
            return {
                "relationship": "REVERSED",
                "confidence": 0.95,
                "claim_relation": claim_relation,
                "evidence_relation": evidence_relation,
            }

        return {
            "relationship": "UNKNOWN",
            "confidence": 0.0,
            "claim_relation": claim_relation,
            "evidence_relation": evidence_relation,
        }