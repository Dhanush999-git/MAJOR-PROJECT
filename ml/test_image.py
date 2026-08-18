import os
import torch
from PIL import Image
from transformers import pipeline

MODEL_NAME = "capcheck/ai-human-generated-image-detection"
IMAGE_FOLDER = "test_images"

print("=" * 60)
print("VeriFact - Pretrained Image Detector Evaluation")
print("=" * 60)

device = 0 if torch.cuda.is_available() else -1

print(f"\nGPU available: {torch.cuda.is_available()}")

if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"CUDA: {torch.version.cuda}")

print("\nLoading pretrained model...")
print(f"Model: {MODEL_NAME}")

detector = pipeline(
    "image-classification",
    model=MODEL_NAME,
    device=device
)

print("Model loaded successfully.")

if not os.path.exists(IMAGE_FOLDER):
    print(f"\nERROR: Folder '{IMAGE_FOLDER}' not found.")
    raise SystemExit(1)

files = [
    f for f in os.listdir(IMAGE_FOLDER)
    if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
]

if not files:
    print("\nERROR: No images found in test_images.")
    raise SystemExit(1)

print(f"\nFound {len(files)} test images.")

print("\n" + "=" * 60)
print("MODEL PREDICTIONS")
print("=" * 60)

for filename in sorted(files):

    path = os.path.join(IMAGE_FOLDER, filename)

    try:
        image = Image.open(path).convert("RGB")

        results = detector(image)

        print(f"\n{filename}")
        print("-" * 40)

        for result in results:
            label = result["label"]
            score = result["score"] * 100

            print(f"{label}: {score:.2f}%")

    except Exception as e:
        print(f"\nERROR processing {filename}: {e}")

print("\n" + "=" * 60)
print("Evaluation completed.")
print("=" * 60)