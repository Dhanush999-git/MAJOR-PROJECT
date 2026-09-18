from services.factcheck_service import FactCheckService
from services.evidence_verifier import EvidenceVerifier


print("=" * 70)
print("VeriFact Evidence Verification Test")
print("=" * 70)


try:

    factcheck = FactCheckService()

    verifier = EvidenceVerifier()

    claim = "COVID-19 vaccines contain tracking devices."

    print("\nOriginal Claim:")
    print(claim)

    print("\nSearching Google Fact Check...")

    results = factcheck.search(
        query=claim,
        page_size=5
    )

    print("\nFact-check results found:")
    print(len(results))

    if not results:

        print("\nNo fact-check evidence found.")

    else:

        for index, result in enumerate(
            results,
            start=1
        ):

            print("\n" + "-" * 70)

            print(f"Evidence #{index}")

            print("\nFact-check claim:")
            print(result.get("claim"))

            print("\nPublisher:")
            print(result.get("publisher"))

            print("\nRating:")
            print(result.get("rating"))

            evidence = result.get("claim")

            if evidence:

                verification = verifier.verify(
                    claim=claim,
                    evidence=evidence
                )

                print("\nNLI Verdict:")
                print(
                    verification.get("verdict")
                )

                print("\nNLI Confidence:")
                print(
                    verification.get("confidence")
                )

                print("\nNLI Probabilities:")
                print(
                    verification.get("probabilities")
                )


except Exception as error:

    print("\nEvidence verification error:")
    print(error)


print("\n" + "=" * 70)
print("Evidence verification test completed.")
print("=" * 70)