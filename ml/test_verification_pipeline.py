from services.verification_pipeline import VerificationPipeline


print("=" * 70)
print("VeriFact Unified Verification Pipeline Test")
print("=" * 70)


pipeline = VerificationPipeline()


claims = [

    "Earth revolves around the Sun.",

    "COVID-19 vaccines contain tracking devices.",

    "Humans can survive indefinitely without oxygen.",

    "The company will release a revolutionary smartphone next year."

]


for claim in claims:

    print("\n\n")
    print("#" * 70)

    print("\nCLAIM:")
    print(claim)

    print("\nRunning verification...")

    try:

        result = pipeline.verify(
            claim
        )

        print("\n" + "-" * 70)

        print("FINAL RESULT")

        print("-" * 70)

        print(
            "Verdict:",
            result.get("verdict")
        )

        print(
            "Confidence:",
            result.get("confidence")
        )

        print(
            "Reason:",
            result.get("reason")
        )

        print(
            "Sources:",
            result.get("source_count", 0)
        )

    except Exception as error:

        print(
            "\nVerification error:"
        )

        print(error)


print("\n" + "=" * 70)

print(
    "Unified verification pipeline test completed."
)

print("=" * 70)