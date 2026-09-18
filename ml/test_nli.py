from models.text_nli_detector import TextNLIVerifier


print("=" * 70)
print("VeriFact NLI Verification Test")
print("=" * 70)


verifier = TextNLIVerifier()


tests = [

    {
        "name": "TRUE TEST",

        "claim":
            "Earth revolves around the Sun.",

        "evidence":
            "Earth orbits the Sun once approximately every 365.25 days.",
    },

    {
        "name": "FALSE TEST",

        "claim":
            "Humans can survive indefinitely without oxygen.",

        "evidence":
            "Humans require oxygen for normal cellular respiration and survival.",
    },

    {
        "name": "UNKNOWN TEST",

        "claim":
            "The company will release a new smartphone next year.",

        "evidence":
            "The company currently sells smartphones in several countries.",
    },

]


for test in tests:

    print("\n" + "-" * 70)

    print(test["name"])

    print("\nClaim:")
    print(test["claim"])

    print("\nEvidence:")
    print(test["evidence"])

    try:

        result = verifier.predict(
            test["claim"],
            test["evidence"]
        )

        print("\nVerdict:")
        print(result["verdict"])

        print("\nConfidence:")
        print(result["confidence"])

        print("\nProbabilities:")
        print(result["probabilities"])

    except Exception as error:

        print("\nERROR:")
        print(error)


print("\n" + "=" * 70)
print("NLI testing completed.")
print("=" * 70)