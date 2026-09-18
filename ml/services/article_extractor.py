import re

import requests
import trafilatura
from bs4 import BeautifulSoup


class ArticleExtractor:
    """
    Downloads and extracts readable article text.

    The downloader explicitly handles character encoding so that
    UTF-8 article text does not become mojibake such as:

        â€™
        â€œ
        â€
        â€¦
    """

    def __init__(self):
        print("=" * 60)
        print("Initializing Article Extraction Service")
        print("=" * 60)

    def _download(self, url: str):
        try:
            response = requests.get(
                url,
                timeout=30,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 "
                        "(Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 "
                        "(KHTML, like Gecko) "
                        "Chrome/120 Safari/537.36"
                    )
                },
            )
            response.raise_for_status()

            # Prefer the charset declared by the HTTP response.
            # If the server does not provide a useful charset,
            # requests may fall back to ISO-8859-1, which can
            # produce mojibake for UTF-8 pages.
            content_type = response.headers.get("Content-Type", "").lower()

            declared_encoding = None

            charset_match = re.search(
                r"charset\s*=\s*['\"]?([a-zA-Z0-9._-]+)",
                content_type,
            )

            if charset_match:
                declared_encoding = charset_match.group(1)

            if declared_encoding:
                response.encoding = declared_encoding
            else:
                apparent_encoding = getattr(
                    response,
                    "apparent_encoding",
                    None,
                )

                if apparent_encoding:
                    response.encoding = apparent_encoding
                else:
                    response.encoding = "utf-8"

            return response.text

        except requests.exceptions.RequestException as error:
            raise RuntimeError(
                f"Failed to download article: {error}"
            ) from error

    def _clean_text(self, text: str):
        if not text:
            return ""

        text = text.replace("\xa0", " ")

        # Normalize common Unicode punctuation.
        text = text.replace("\u2018", "'")
        text = text.replace("\u2019", "'")
        text = text.replace("\u201c", '"')
        text = text.replace("\u201d", '"')
        text = text.replace("\u2013", "-")
        text = text.replace("\u2014", " - ")
        text = text.replace("\u2026", "...")

        text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r" *\n *", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)

        return text.strip()

    def _repair_mojibake(self, text: str):
        """
        Repair common UTF-8 -> Windows/Latin-1 mojibake.

        Example:

            doesnâ€™t -> doesn't
            Earthâ€™s -> Earth's
            â€¦      -> ...
            â€œtextâ€ -> "text"

        Only apply the repair when obvious mojibake markers
        are present.
        """
        if not text:
            return ""

        mojibake_markers = (
            "â",
            "ð",
            "Ã",
            "Â",
        )

        if not any(marker in text for marker in mojibake_markers):
            return text

        try:
            repaired = text.encode("latin1").decode("utf-8")
            return repaired
        except (UnicodeEncodeError, UnicodeDecodeError):
            return text

    def _remove_boilerplate(self, text: str):
        if not text:
            return ""

        lines = text.splitlines()
        cleaned = []

        ignored_patterns = [
            r"^media editor:",
            r"^subscribe$",
            r"^sign up$",
            r"^newsletter$",
            r"^advertisement$",
            r"^advertisements?$",
            r"^cookie policy$",
            r"^privacy policy$",
            r"^terms of use$",
            r"^terms & conditions$",
            r"^last modification:",
            r"^all rights reserved\.?$",
        ]

        for line in lines:
            line = line.strip()

            if not line:
                continue

            lower_line = line.lower()

            ignored = False

            for pattern in ignored_patterns:
                if re.search(
                    pattern,
                    lower_line,
                    re.IGNORECASE,
                ):
                    ignored = True
                    break

            if ignored:
                continue

            cleaned.append(line)

        return "\n\n".join(cleaned)

    def _extract_marker_section(self, text: str):
        if not text:
            return ""

        marker_patterns = [
            r"\bTranscript\b",
            r"\bArticle\b",
            r"\bFull Story\b",
            r"\bStory\b",
        ]

        for pattern in marker_patterns:
            match = re.search(
                pattern,
                text,
                re.IGNORECASE,
            )

            if match:
                section = text[match.end():].strip()

                if len(section) >= 300:
                    return section

        return ""

    def _clean_html(self, html: str):
        soup = BeautifulSoup(
            html,
            "html.parser",
        )

        remove_tags = [
            "script",
            "style",
            "noscript",
            "iframe",
            "nav",
            "footer",
            "form",
            "aside",
            "svg",
        ]

        for tag_name in remove_tags:
            for tag in soup.find_all(tag_name):
                tag.decompose()

        boilerplate_keywords = [
            "navigation",
            "navbar",
            "menu",
            "sidebar",
            "footer",
            "advert",
            "advertisement",
            "cookie",
            "newsletter",
            "social",
            "related",
            "recommended",
            "comments",
            "share",
            "breadcrumb",
        ]

        for element in soup.find_all(True):
            attrs = getattr(
                element,
                "attrs",
                None,
            )

            if not isinstance(attrs, dict):
                continue

            classes = attrs.get(
                "class",
                [],
            )

            if isinstance(classes, list):
                class_text = " ".join(
                    str(item)
                    for item in classes
                )
            else:
                class_text = str(classes)

            element_id = attrs.get(
                "id",
                "",
            )

            if element_id is None:
                element_id = ""

            combined = (
                f"{class_text} {element_id}"
            ).lower()

            if any(
                keyword in combined
                for keyword in boilerplate_keywords
            ):
                element.decompose()

        return str(soup)

    def _extract_with_trafilatura(self, html: str):
        cleaned_html = self._clean_html(html)

        extracted_text = trafilatura.extract(
            cleaned_html,
            include_comments=False,
            include_tables=False,
            include_links=False,
            include_images=False,
            favor_precision=True,
        )

        if not extracted_text:
            return ""

        return self._clean_text(extracted_text)

    def _fallback_extract(self, html: str):
        soup = BeautifulSoup(
            html,
            "html.parser",
        )

        remove_tags = [
            "script",
            "style",
            "noscript",
            "nav",
            "footer",
            "aside",
            "form",
            "iframe",
            "svg",
        ]

        for tag_name in remove_tags:
            for tag in soup.find_all(tag_name):
                tag.decompose()

        text = soup.get_text(
            "\n",
            strip=True,
        )

        return self._clean_text(text)

    def extract(self, url: str):
        if not url or not url.strip():
            raise ValueError(
                "Article URL cannot be empty."
            )

        html = self._download(url)

        extracted_text = (
            self._extract_with_trafilatura(html)
        )

        if not extracted_text:
            extracted_text = (
                self._fallback_extract(html)
            )

        # Repair encoding problems before downstream NLP.
        extracted_text = self._repair_mojibake(
            extracted_text
        )

        extracted_text = self._clean_text(
            extracted_text
        )

        extracted_text = self._remove_boilerplate(
            extracted_text
        )

        marker_section = (
            self._extract_marker_section(
                extracted_text
            )
        )

        if marker_section:
            extracted_text = marker_section

        extracted_text = self._clean_text(
            extracted_text
        )

        if not extracted_text:
            raise RuntimeError(
                "Could not extract meaningful article text."
            )

        if len(extracted_text) < 100:
            raise RuntimeError(
                "Extracted article text is too short."
            )

        return extracted_text