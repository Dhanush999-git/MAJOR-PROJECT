from services.google_news_service import GoogleNewsService
from services.publisher_url_finder import PublisherURLFinder
from services.article_extractor import ArticleExtractor


class WebEvidenceService:
    def __init__(self):
        print("=" * 60)
        print("Initializing Web Evidence Service")
        print("=" * 60)

        self.google_news = GoogleNewsService()
        self.publisher_finder = PublisherURLFinder()
        self.article_extractor = ArticleExtractor()

        print("Web Evidence Service ready.")
        print("=" * 60)

    def search(
        self,
        claim: str,
        max_results: int = 5
    ):
        if not claim or not claim.strip():
            raise ValueError("Claim cannot be empty.")

        news_results = self.google_news.search(
            query=claim,
            max_results=max_results
        )

        evidence_sources = []

        for article in news_results:

            title = article.get("title")
            publisher = article.get("source")
            google_news_url = article.get(
                "google_news_url"
            )
            publisher_url = article.get(
                "publisher_url"
            )
            description = article.get(
                "description"
            )

            if not title or not publisher:
                continue

            resolved = None

            if publisher_url:

                try:

                    resolved = self.publisher_finder.find(
                        title=title,
                        publisher=publisher,
                        publisher_url=publisher_url
                    )

                except Exception as error:

                    print(
                        f"Publisher resolution failed: "
                        f"{error}"
                    )

            article_text = None
            article_url = None

            if resolved:

                article_url = resolved.get(
                    "url"
                )

                if article_url:

                    try:

                        article_text = (
                            self.article_extractor.extract(
                                article_url
                            )
                        )

                    except Exception as error:

                        print(
                            f"Article extraction failed: "
                            f"{error}"
                        )

            # --------------------------------------------------
            # Fallback evidence
            # --------------------------------------------------
            #
            # If the publisher article cannot be resolved,
            # keep the RSS description as lightweight evidence.
            #
            # We DO NOT pretend the description is a full article.
            # --------------------------------------------------

            evidence_text = article_text

            evidence_type = "article"

            if not evidence_text:

                if description:

                    evidence_text = description
                    evidence_type = "rss_description"

                else:

                    evidence_text = title
                    evidence_type = "rss_title"

            evidence_sources.append({
                "title": title,
                "publisher": publisher,

                "google_news_url": google_news_url,

                "publisher_url": publisher_url,

                "article_url": article_url,

                "published": article.get(
                    "published"
                ),

                "description": description,

                "article_text": article_text,

                "evidence_text": evidence_text,

                "evidence_type": evidence_type,

                "resolved": resolved is not None,

                "extracted": article_text is not None,
            })

        return evidence_sources