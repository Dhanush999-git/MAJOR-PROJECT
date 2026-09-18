from services.google_news_service import GoogleNewsService
from services.publisher_url_finder import PublisherURLFinder
from services.article_extractor import ArticleExtractor
from services.evidence_nli_pipeline import EvidenceNLIPipeline


# ============================================================
# TEST CLAIM
# ============================================================

query = "The Earth is larger than the Sun"


print("=" * 60)
print("EVIDENCE + NLI PIPELINE TEST")
print("=" * 60)

print()
print(f"Claim: {query}")
print()


# ============================================================
# STEP 1 — GOOGLE NEWS
# ============================================================

google_news = GoogleNewsService()

news_results = google_news.search(
    query=query,
    max_results=5
)

print()
print("=" * 60)
print("GOOGLE NEWS RESULTS")
print("=" * 60)

for index, article in enumerate(news_results, start=1):

    print()
    print(f"#{index}")
    print(f"Title: {article.get('title')}")
    print(f"Source: {article.get('source')}")
    print(f"Publisher URL: {article.get('publisher_url')}")
    print(f"Published: {article.get('published')}")


# ============================================================
# STEP 2 — FIND PUBLISHER ARTICLE
# ============================================================

publisher_finder = PublisherURLFinder()
article_extractor = ArticleExtractor()


article_text = None
article_url = None
selected_article = None


for article in news_results:

    title = article.get("title")
    publisher = article.get("source")
    publisher_url = article.get("publisher_url")

    if not title or not publisher_url:
        continue

    print()
    print("=" * 60)
    print("TRYING ARTICLE")
    print("=" * 60)

    print(f"Publisher: {publisher}")
    print(f"Title: {title}")

    try:

        resolved = publisher_finder.find(
            title=title,
            publisher=publisher,
            publisher_url=publisher_url
        )

    except Exception as error:

        print(
            f"Publisher resolution error: {error}"
        )

        continue

    if not resolved:
        continue

    article_url = resolved.get("url")

    if not article_url:
        continue

    print()
    print("Attempting article extraction...")

    try:

        article_text = article_extractor.extract(
            article_url
        )

    except Exception as error:

        print(
            f"Article extraction failed: {error}"
        )

        continue

    if article_text:

        selected_article = article

        print()
        print("ARTICLE SUCCESSFULLY EXTRACTED")
        print(f"URL: {article_url}")
        print(
            f"Extracted characters: "
            f"{len(article_text)}"
        )

        break


# ============================================================
# STEP 3 — STOP IF NO ARTICLE WAS FOUND
# ============================================================

if not article_text:

    print()
    print("=" * 60)
    print("NO ARTICLE COULD BE EXTRACTED")
    print("=" * 60)

    print()
    print(
        "Google News returned results, but none of "
        "the publisher pages could be resolved."
    )

    print()
    print(
        "This is a web-retrieval limitation, "
        "not an NLI-model failure."
    )

    raise SystemExit(0)


# ============================================================
# STEP 4 — RUN EVIDENCE + NLI PIPELINE
# ============================================================

print()
print("=" * 60)
print("RUNNING EVIDENCE + NLI PIPELINE")
print("=" * 60)


pipeline = EvidenceNLIPipeline()


result = pipeline.verify(
    claim=query,
    article_text=article_text,
    selection_top_k=10,
    ranking_top_k=5
)


# ============================================================
# STEP 5 — FINAL RESULT
# ============================================================

print()
print("=" * 60)
print("FINAL RESULT")
print("=" * 60)

print()
print(f"Claim: {result['claim']}")

print(
    f"Final NLI verdict: "
    f"{result['final_verdict']}"
)

print(
    f"Confidence: "
    f"{result['confidence']}"
)

print()
print("Scores:")

print(
    f"  SUPPORTS: "
    f"{result['scores']['supports']}"
)

print(
    f"  REFUTES: "
    f"{result['scores']['refutes']}"
)

print(
    f"  NEUTRAL: "
    f"{result['scores']['neutral']}"
)


# ============================================================
# STEP 6 — EVIDENCE DETAILS
# ============================================================

print()
print("=" * 60)
print("EVIDENCE RESULTS")
print("=" * 60)


for index, evidence in enumerate(
    result["evidence_results"],
    start=1
):

    print()
    print(f"Evidence #{index}")

    print(
        f"NLI verdict: "
        f"{evidence['nli_verdict']}"
    )

    print(
        f"NLI confidence: "
        f"{evidence['nli_confidence']}"
    )

    print(
        f"Evidence score: "
        f"{evidence['evidence_score']}"
    )

    print(
        f"Similarity: "
        f"{evidence['similarity']}"
    )

    print(
        f"Concept overlap: "
        f"{evidence['concept_overlap']}"
    )

    print()
    print("Evidence text:")

    print(
        evidence["evidence"]
    )


print()
print("=" * 60)
print("TEST COMPLETE")
print("=" * 60)