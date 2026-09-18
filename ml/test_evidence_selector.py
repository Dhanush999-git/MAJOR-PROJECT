from services.article_extractor import ArticleExtractor
from services.publisher_url_finder import PublisherURLFinder
from services.evidence_selector import EvidenceSelector

import feedparser
from urllib.parse import quote


# ---------------------------------------------------------
# 1. Search Google News
# ---------------------------------------------------------

query = "Earth revolves around the Sun"

rss_url = (
    "https://news.google.com/rss/search"
    f"?q={quote(query)}"
    "&hl=en-US"
    "&gl=US"
    "&ceid=US:en"
)

feed = feedparser.parse(rss_url)

if not feed.entries:
    print("No Google News results found.")
    raise SystemExit


article = feed.entries[0]


# ---------------------------------------------------------
# 2. Google News metadata
# ---------------------------------------------------------

title = article.get("title")

source = article.get(
    "source",
    {}
)

publisher = source.get("title")
publisher_url = source.get("href")


# ---------------------------------------------------------
# 3. Resolve publisher article
# ---------------------------------------------------------

finder = PublisherURLFinder()

resolved = finder.find(
    title=title,
    publisher=publisher,
    publisher_url=publisher_url
)

if not resolved:
    print("Could not resolve publisher article.")
    raise SystemExit


article_url = resolved["url"]


print("=" * 70)
print("EVIDENCE SELECTOR TEST")
print("=" * 70)

print("\nClaim:")
print(query)

print("\nArticle:")
print(article_url)


# ---------------------------------------------------------
# 4. Extract article
# ---------------------------------------------------------

extractor = ArticleExtractor()

article_text = extractor.extract(
    article_url
)

print("\nExtracted characters:")
print(len(article_text))


# ---------------------------------------------------------
# 5. Select evidence
# ---------------------------------------------------------

selector = EvidenceSelector()

evidence = selector.select(
    claim=query,
    article_text=article_text,
    top_k=5
)


# ---------------------------------------------------------
# 6. Display results
# ---------------------------------------------------------

print("\n" + "=" * 70)
print("SELECTED EVIDENCE")
print("=" * 70)


for index, item in enumerate(
    evidence,
    start=1
):

    print("\n" + "-" * 70)
    print(f"EVIDENCE #{index}")
    print("-" * 70)

    print("\nSimilarity:")
    print(item["similarity"])

    print("\nPassage:")
    print(item["text"])


print("\n" + "=" * 70)
print("Evidence selector test completed.")
print("=" * 70)