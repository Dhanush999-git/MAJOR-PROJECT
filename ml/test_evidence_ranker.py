from services.article_extractor import ArticleExtractor
from services.publisher_url_finder import PublisherURLFinder
from services.evidence_selector import EvidenceSelector
from services.evidence_ranker import EvidenceRanker

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
# 2. Publisher information
# ---------------------------------------------------------

title = article.get("title")

source = article.get(
    "source",
    {}
)

publisher = source.get("title")
publisher_url = source.get("href")


# ---------------------------------------------------------
# 3. Resolve article
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


# ---------------------------------------------------------
# 4. Extract article
# ---------------------------------------------------------

extractor = ArticleExtractor()

article_text = extractor.extract(
    article_url
)


# ---------------------------------------------------------
# 5. Semantic evidence selection
# ---------------------------------------------------------

selector = EvidenceSelector()

selected = selector.select(
    claim=query,
    article_text=article_text,
    top_k=10
)


# ---------------------------------------------------------
# 6. Evidence ranking
# ---------------------------------------------------------

ranker = EvidenceRanker()

ranked = ranker.rank(
    claim=query,
    evidence_passages=selected,
    minimum_similarity=0.35,
    minimum_concept_overlap=0.20,
    top_k=5
)


# ---------------------------------------------------------
# 7. Display
# ---------------------------------------------------------

print("\n" + "=" * 70)
print("RANKED EVIDENCE")
print("=" * 70)


for index, item in enumerate(
    ranked,
    start=1
):

    print("\n" + "-" * 70)
    print(f"EVIDENCE #{index}")
    print("-" * 70)

    print("\nEvidence score:")
    print(item["evidence_score"])

    print("Similarity:")
    print(item["similarity"])

    print("Keyword overlap:")
    print(item["keyword_overlap"])

    print("Directness:")
    print(item["directness"])

    print("Usefulness:")
    print(item["usefulness"])

    print("\nPassage:")
    print(item["text"])


print("\n" + "=" * 70)
print("Evidence ranking test completed.")
print("=" * 70)