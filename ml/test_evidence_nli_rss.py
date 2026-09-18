from services.google_news_service import GoogleNewsService
from services.evidence_nli_pipeline import EvidenceNLIPipeline


# ============================================================
# TEST CLAIM
# ============================================================

query = "The first human settlement on Mars will be established in 2032"


print("=" * 60)
print("RSS EVIDENCE + NLI TEST")
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


for index, article in enumerate(
    news_results,
    start=1
):

    print()
    print(f"#{index}")
    print(
        f"Title: "
        f"{article.get('title')}"
    )

    print(
        f"Source: "
        f"{article.get('source')}"
    )

    print(
        f"Published: "
        f"{article.get('published')}"
    )


# ============================================================
# STEP 2 — BUILD RSS EVIDENCE
# ============================================================

evidence_parts = []


for article in news_results:

    evidence = article.get(
        "rss_evidence"
    )

    if not evidence:
        continue

    evidence_parts.append(
        evidence
    )


if not evidence_parts:

    print()
    print(
        "No RSS evidence was returned."
    )

    raise SystemExit(0)


article_text = "\n\n".join(
    evidence_parts
)


print()
print("=" * 60)
print("RSS EVIDENCE")
print("=" * 60)

print()
print(article_text)


# ============================================================
# STEP 3 — RUN NLI PIPELINE
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
# STEP 4 — RESULT
# ============================================================

print()
print("=" * 60)
print("FINAL RESULT")
print("=" * 60)

print()

print(
    f"Claim: "
    f"{result['claim']}"
)

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
# STEP 5 — EVIDENCE DETAILS
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
    print(
        f"Evidence #{index}"
    )

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

    print(
        "Evidence text:"
    )

    print(
        evidence["evidence"]
    )


print()
print("=" * 60)
print("TEST COMPLETE")
print("=" * 60)