import os
import torch
from PIL import Image
from transformers import AutoImageProcessor, SiglipForImageClassification

MODEL_NAME = "prithivMLmods/deepfake-detector-model-v1"
IMAGE_FOLDER = "test_images"

print("=" * 60)
print("VeriFact - Model B Deepfake Detector")
print("=" * 60)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"\nDevice: {device}")

if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"CUDA: {torch.version.cuda}")

print("\nLoading Model B...")
print(MODEL_NAME)

processor = AutoImageProcessor.from_pretrained(MODEL_NAME)

model = SiglipForImageClassification.from_pretrained(
    MODEL_NAME
)

model = model.to(device)
model.eval()

print("Model B loaded successfully.")

if not os.path.exists(IMAGE_FOLDER):
    print(f"\nERROR: {IMAGE_FOLDER} folder not found.")
    raise SystemExit(1)

files = [
    f for f in os.listdir(IMAGE_FOLDER)
    if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
]

if not files:
    print("\nERROR: No images found.")
    raise SystemExit(1)

print(f"\nFound {len(files)} images.")

print("\n" + "=" * 60)
print("MODEL B PREDICTIONS")
print("=" * 60)

for filename in sorted(files):

    path = os.path.join(IMAGE_FOLDER, filename)

    try:
        image = Image.open(path).convert("RGB")

        inputs = processor(
            images=image,
            return_tensors="pt"
        )

        inputs = {
            key: value.to(device)
            for key, value in inputs.items()
        }

        with torch.no_grad():
            outputs = model(**inputs)
            probabilities = torch.softmax(
                outputs.logits,
                dim=1
            )[0]

        fake_probability = probabilities[0].item() * 100
        real_probability = probabilities[1].item() * 100

        if fake_probability >= real_probability:
            verdict = "FAKE"
        else:
            verdict = "REAL"

        print(f"\n{filename}")
        print("-" * 40)
        print(f"Verdict: {verdict}")
        print(f"Fake:    {fake_probability:.2f}%")
        print(f"Real:    {real_probability:.2f}%")

    except Exception as e:
        print(f"\nERROR processing {filename}: {e}")

print("\n" + "=" * 60)
print("Model B evaluation completed.")
print("=" * 60)