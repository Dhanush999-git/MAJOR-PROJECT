import re
from urllib.parse import quote, urljoin

import requests
from bs4 import BeautifulSoup


class PublisherURLFinder:
    def __init__(self):
        print("=" * 60)
        print("Initializing Publisher URL Finder")
        print("=" * 60)

    def _clean_title(self, title: str, publisher: str):
        cleaned = title.strip()

        if publisher:
            suffix = f" - {publisher}"

            if cleaned.lower().endswith(suffix.lower()):
                cleaned = cleaned[:-len(suffix)].strip()

        cleaned = re.sub(r"\s+", " ", cleaned)

        return cleaned

    def _normalize_text(self, text: str):
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

    def _title_words(self, text: str):
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
            "how",
            "why",
        }

        words = self._normalize_text(text).split()

        return {
            word
            for word in words
            if word not in stop_words
            and len(word) > 2
        }

    def _title_similarity(
        self,
        target_title: str,
        candidate_title: str
    ):
        target_words = self._title_words(target_title)
        candidate_words = self._title_words(candidate_title)

        if not target_words or not candidate_words:
            return 0.0

        overlap = target_words.intersection(candidate_words)

        return len(overlap) / len(target_words)

    def _build_search_queries(
        self,
        title: str,
        publisher: str
    ):
        cleaned_title = self._clean_title(
            title,
            publisher
        )

        words = cleaned_title.split()

        queries = [
            cleaned_title
        ]

        if len(words) > 12:
            queries.append(
                " ".join(words[:12])
            )

        if len(words) > 8:
            queries.append(
                " ".join(words[:8])
            )

        if len(words) > 6:
            queries.append(
                " ".join(words[:6])
            )

        # Add a shorter keyword-oriented query.
        meaningful_words = list(
            self._title_words(cleaned_title)
        )

        if len(meaningful_words) >= 4:
            queries.append(
                " ".join(meaningful_words[:6])
            )

        unique_queries = []

        for query in queries:
            query = query.strip()

            if query and query not in unique_queries:
                unique_queries.append(query)

        return unique_queries

    def _extract_links(
        self,
        html: str,
        base_url: str
    ):
        soup = BeautifulSoup(
            html,
            "html.parser"
        )

        links = []

        for anchor in soup.find_all(
            "a",
            href=True
        ):
            href = anchor.get("href")
            text = anchor.get_text(
                " ",
                strip=True
            )

            if not href or not text:
                continue

            absolute_url = urljoin(
                base_url,
                href
            )

            # Ignore obvious non-article links.
            lower_url = absolute_url.lower()

            ignored_extensions = (
                ".jpg",
                ".jpeg",
                ".png",
                ".gif",
                ".svg",
                ".webp",
                ".pdf",
                ".xml",
            )

            if lower_url.endswith(
                ignored_extensions
            ):
                continue

            links.append({
                "url": absolute_url,
                "title": text.strip()
            })

        return links

    def _search_publisher(
        self,
        publisher_url: str,
        query: str
    ):
        search_url = (
            f"{publisher_url.rstrip('/')}"
            f"/search?query={quote(query)}"
        )

        print()
        print("Searching publisher site:")
        print(search_url)

        try:
            response = requests.get(
                search_url,
                timeout=20,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120 Safari/537.36"
                    )
                }
            )

            response.raise_for_status()

        except requests.exceptions.RequestException as error:
            print(
                f"Publisher search failed: {error}"
            )

            return []

        return self._extract_links(
            response.text,
            publisher_url
        )

    def find(
        self,
        title: str,
        publisher: str,
        publisher_url: str
    ):
        if not title:
            return None

        if not publisher_url:
            return None

        queries = self._build_search_queries(
            title,
            publisher
        )

        best_match = None
        best_score = 0.0

        for query in queries:

            links = self._search_publisher(
                publisher_url,
                query
            )

            for link in links:

                candidate_title = link["title"]

                score = self._title_similarity(
                    title,
                    candidate_title
                )

                if score > best_score:

                    best_score = score

                    best_match = {
                        "url": link["url"],
                        "title": candidate_title,
                        "match_score": round(
                            score,
                            4
                        )
                    }

        if best_match and best_score >= 0.40:

            print()
            print("Resolved publisher article:")
            print(
                f"Title: {best_match['title']}"
            )
            print(
                f"URL: {best_match['url']}"
            )
            print(
                f"Match score: "
                f"{best_match['match_score']}"
            )

            return best_match

        print(
            "Could not resolve publisher article."
        )

        return None