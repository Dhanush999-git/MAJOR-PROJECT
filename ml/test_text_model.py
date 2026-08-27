from models.text.text_detector import TextDetector


# ============================================================
# LOAD MODEL
# ============================================================

detector = TextDetector()


# ============================================================
# TEST TEXT
# ============================================================

test_text = """
Scientists have announced a major breakthrough in
renewable energy technology after years of research.
"""


# ============================================================
# PREDICT
# ============================================================

result = detector.predict(
    test_text
)


# ============================================================
# DISPLAY RESULT
# ============================================================

print()
print("=" * 60)
print("VERIFACT TEXT MODEL RESULT")
print("=" * 60)

print(
    f"Prediction : {result['label']}"
)

print(
    f"Raw Label  : {result['raw_label']}"
)

print(
    f"Confidence : {result['confidence']}"
)

print(
    f"Model      : {result['model']}"
)

print(
    f"Device     : {result['device']}"
)

print()
print("Probabilities:")

for label, probability in result["probabilities"].items():

    print(
        f"  {label}: {probability}"
    )

print("=" * 60)