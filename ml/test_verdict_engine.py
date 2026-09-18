from services.verdict_engine import VerdictEngine


print("=" * 70)
print("VeriFact Verdict Engine Test")
print("=" * 70)


engine = VerdictEngine()


tests = [

    {
        "name": "False fact-check + Refutes NLI",
        "rating": "False",
        "nli": {
            "final_verdict": "REFUTES",
            "confidence": 0.85
        }
    },

    {
        "name": "False fact-check + Supports NLI",
        "rating": "False",
        "nli": {
            "final_verdict": "SUPPORTS",
            "confidence": 0.80
        }
    },

    {
        "name": "True fact-check + Supports NLI",
        "rating": "True",
        "nli": {
            "final_verdict": "SUPPORTS",
            "confidence": 0.90
        }
    },

    {
        "name": "No fact-check + Refutes NLI",
        "rating": None,
        "nli": {
            "final_verdict": "REFUTES",
            "confidence": 0.82
        }
    },

    {
        "name": "No fact-check + Unknown NLI",
        "rating": None,
        "nli": {
            "final_verdict": "NOT_ENOUGH_INFO",
            "confidence": 0.95
        }
    }

]


for test in tests:

    print("\n" + "-" * 70)

    print(
        "\nTest:",
        test["name"]
    )

    result = engine.decide(
        factcheck_rating=test["rating"],
        nli_result=test["nli"]
    )

    print(
        "Final Verdict:",
        result["verdict"]
    )

    print(
        "Confidence:",
        result["confidence"]
    )

    print(
        "Reason:",
        result["reason"]
    )


print("\n" + "=" * 70)
print("Verdict engine test completed.")
print("=" * 70)