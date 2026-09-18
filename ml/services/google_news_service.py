import feedparser
from urllib.parse import quote
from bs4 import BeautifulSoup


GOOGLE_NEWS_RSS_URL = (
    "https://news.google.com/rss/search"
    "?q={query}"
    "&hl=en-US"
    "&gl=US"
    "&ceid=US:en"
)


class GoogleNewsService:

    def __init__(self):
        print("=" * 60)
        print("Initializing Google News RSS Service")
        print("=" * 60)

    def _clean_html(self, html: str):

        if not html:
            return ""

        soup = BeautifulSoup(
            html,
            "html.parser"
        )

        return soup.get_text(
            " ",
            strip=True
        )

    def search(
        self,
        query: str,
        max_results: int = 10
    ):

        if not query or not query.strip():
            raise ValueError(
                "Google News query cannot be empty."
            )

        url = GOOGLE_NEWS_RSS_URL.format(
            query=quote(query.strip())
        )

        feed = feedparser.parse(url)

        results = []

        for entry in feed.entries[:max_results]:

            google_news_url = entry.get(
                "link"
            )

            source_name = None
            publisher_url = None

            if hasattr(entry, "source"):

                source = entry.source

                if hasattr(source, "get"):

                    source_name = source.get(
                        "title"
                    )

                    publisher_url = source.get(
                        "href"
                    )

            title = entry.get(
                "title",
                ""
            )

            raw_description = entry.get(
                "summary",
                ""
            )

            description = self._clean_html(
                raw_description
            )

            published = entry.get(
                "published"
            )

            # ----------------------------------------------------
            # Remove publisher suffix from title
            # ----------------------------------------------------

            clean_title = title

            if source_name:

                suffix = (
                    f" - {source_name}"
                )

                if clean_title.lower().endswith(
                    suffix.lower()
                ):

                    clean_title = clean_title[
                        :-len(suffix)
                    ].strip()

            # ----------------------------------------------------
            # Build clean RSS evidence
            # ----------------------------------------------------

            if description:

                normalized_title = (
                    clean_title.lower().strip()
                )

                normalized_description = (
                    description.lower().strip()
                )

                if normalized_title in normalized_description:

                    rss_evidence = description

                else:

                    rss_evidence = (
                        f"{clean_title}. "
                        f"{description}"
                    ).strip()

            else:

                rss_evidence = clean_title

            # ----------------------------------------------------
            # Store result
            # ----------------------------------------------------

            results.append({

                "title": clean_title,

                "google_news_url":
                    google_news_url,

                "url":
                    google_news_url,

                "published":
                    published,

                "source":
                    source_name,

                "publisher_url":
                    publisher_url,

                "description":
                    description,

                "rss_evidence":
                    rss_evidence,

            })

        return results