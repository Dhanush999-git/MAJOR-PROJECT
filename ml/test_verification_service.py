from services.verification_service import VerificationService


def main():

    print("=" * 60)
    print("VERIFACT PRODUCTION VERIFICATION TEST")
    print("=" * 60)

    service = VerificationService()

    claims = [
        "The Earth revolves around the Sun",
        "The Earth is larger than the Sun",
        "The first human settlement on Mars will be established in 2032",
    ]

    for claim in claims:

        print()
        print()
        print("#" * 60)
        print(f"TEST CLAIM")
        print("#" * 60)

        print(claim)

        try:

            result = service.verify(claim)

            print()
            print("RESULT")
            print("-" * 60)

            print(f"Verdict: {result['verdict']}")
            print(f"Confidence: {result['confidence']}")
            print(f"Reason: {result['reason']}")

            print()
            print(
                f"Fact checks found: "
                f"{result['factcheck']['found']}"
            )

            print(
                f"Evidence passages: "
                f"{len(result['evidence']['results'])}"
            )

            print(
                f"NLI verdict: "
                f"{result['nli']['verdict']}"
            )

            print(
                f"NLI confidence: "
                f"{result['nli']['confidence']}"
            )

        except Exception as error:

            print()
            print("TEST FAILED")
            print(error)

    print()
    print("=" * 60)
    print("ALL TESTS COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
    