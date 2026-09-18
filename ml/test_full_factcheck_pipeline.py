from services.factcheck_service import FactCheckService
from services.article_extractor import ArticleExtractor
from services.evidence_selector import EvidenceSelector
from services.evidence_verifier import EvidenceVerifier


print("=" * 70)
print("VeriFact Full Fact-Check Verification Pipeline")
print("=" * 70)


try:

    # ---------------------------------------------------------
    # 1. Initialize services
    # ---------------------------------------------------------

    factcheck = FactCheckService()

    extractor = ArticleExtractor()

    selector = EvidenceSelector()

    verifier = EvidenceVerifier()


    # ---------------------------------------------------------
    # 2. User claim
    # ---------------------------------------------------------

    claim = (
        "COVID-19 vaccines contain tracking devices."
    )

    print("\nUSER CLAIM")
    print("-" * 70)
    print(claim)


    # ---------------------------------------------------------
    # 3. Google Fact Check
    # ---------------------------------------------------------

    print("\n\nSTEP 1 — Google Fact Check")

    factcheck_results = factcheck.search(
        query=claim,
        page_size=5
    )

    print(
        "Fact-check results:",
        len(factcheck_results)
    )


    if not factcheck_results:

        print(
            "\nNo fact-check results found."
        )

    else:

        # -----------------------------------------------------
        # 4. Select first article
        # -----------------------------------------------------

        source = factcheck_results[0]

        print("\nPublisher:")
        print(
            source.get("publisher")
        )

        print("\nRating:")
        print(
            source.get("rating")
        )

        print("\nArticle:")
        print(
            source.get("title")
        )

        print("\nURL:")
        print(
            source.get("url")
        )


        # -----------------------------------------------------
        # 5. Extract article
        # -----------------------------------------------------

        print(
            "\n\nSTEP 2 — Article Extraction"
        )

        article_text = extractor.extract(
            source.get("url")
        )

        print(
            "Article characters:",
            len(article_text)
        )


        # -----------------------------------------------------
        # 6. Select evidence
        # -----------------------------------------------------

        print(
            "\n\nSTEP 3 — Evidence Selection"
        )

        selected_evidence = selector.select(
            claim=claim,
            article_text=article_text,
            top_k=5
        )

        print(
            "Evidence passages:",
            len(selected_evidence)
        )

        for index, evidence in enumerate(
            selected_evidence,
            start=1
        ):

            print("\n" + "-" * 70)

            print(
                f"Evidence #{index}"
            )

            print(
                "Similarity:",
                evidence["similarity"]
            )

            print(
                "Text:"
            )

            print(
                evidence["text"]
            )


        # -----------------------------------------------------
        # 7. NLI verification
        # -----------------------------------------------------

        print(
            "\n\nSTEP 4 — NLI Verification"
        )

        verification = verifier.verify_multiple(
            claim=claim,
            evidence_passages=selected_evidence
        )


        # -----------------------------------------------------
        # 8. Display NLI results
        # -----------------------------------------------------

        print(
            "\nIndividual Evidence Results"
        )

        for index, result in enumerate(
            verification["evidence_results"],
            start=1
        ):

            print("\n" + "-" * 70)

            print(
                f"Evidence #{index}"
            )

            print(
                "Verdict:",
                result["verdict"]
            )

            print(
                "Confidence:",
                result["confidence"]
            )


        # -----------------------------------------------------
        # 9. Final result
        # -----------------------------------------------------

        print(
            "\n\nFINAL NLI VERDICT"
        )

        print("-" * 70)

        print(
            verification["final_verdict"]
        )

        print(
            "Confidence:",
            verification["confidence"]
        )

        print(
            "\nEvidence summary:"
        )

        print(
            verification["summary"]
        )


        # -----------------------------------------------------
        # 10. Compare with fact-check rating
        # -----------------------------------------------------

        print(
            "\n\nFACT-CHECK RATING"
        )

        print("-" * 70)

        print(
            source.get("rating")
        )


except Exception as error:

    print(
        "\nPipeline error:"
    )

    print(error)


print(
    "\n" + "=" * 70
)

print(
    "Full fact-check pipeline test completed."
)

print(
    "=" * 70
)