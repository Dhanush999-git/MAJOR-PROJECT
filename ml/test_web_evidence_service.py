from services.web_evidence_service import WebEvidenceService


service = WebEvidenceService()


claim = "Earth revolves around the Sun"


print("\n" + "=" * 70)
print("WEB EVIDENCE SERVICE TEST")
print("=" * 70)

print("\nClaim:")
print(claim)


results = service.search(
    claim=claim,
    max_results=3
)


print("\n" + "=" * 70)
print("WEB EVIDENCE RESULTS")
print("=" * 70)


print("\nNumber of sources:")
print(len(results))


for index, result in enumerate(results, start=1):

    print("\n" + "-" * 70)
    print(f"SOURCE #{index}")
    print("-" * 70)

    print("\nTitle:")
    print(result.get("title"))

    print("\nPublisher:")
    print(result.get("publisher"))

    print("\nPublisher URL:")
    print(result.get("publisher_url"))

    print("\nArticle URL:")
    print(result.get("article_url"))

    print("\nResolved:")
    print(result.get("resolved"))

    print("\nArticle extracted:")
    print(result.get("extracted"))

    article_text = result.get("article_text")

    if article_text:
        print("\nExtracted characters:")
        print(len(article_text))

        print("\nEvidence preview:")
        print(article_text[:500])


print("\n" + "=" * 70)
print("Web Evidence Service test completed.")
print("=" * 70)