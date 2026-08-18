from pathlib import Path

import torch
from PIL import Image
from huggingface_hub import try_to_load_from_cache
from transformers import SiglipForImageClassification

try:
    # The PIL processor avoids an unnecessary torchvision runtime dependency.
    from transformers import SiglipImageProcessorPil
except ImportError:
    # Compatibility with Transformers versions that expose only the generic name.
    from transformers import SiglipImageProcessor as SiglipImageProcessorPil


MODEL_NAME = "prithivMLmods/deepfake-detector-model-v1"


def _resolve_model_source() -> str:
    """Use the complete local snapshot when the model is already cached."""
    cached_config = try_to_load_from_cache(MODEL_NAME, "config.json")
    if cached_config:
        return str(Path(cached_config).parent)
    return MODEL_NAME


class ImageDetector:
    def __init__(self):
        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        print(f"Loading image detector on: {self.device}")

        model_source = _resolve_model_source()

        self.processor = SiglipImageProcessorPil.from_pretrained(model_source)

        self.model = SiglipForImageClassification.from_pretrained(model_source)

        self.model = self.model.to(self.device)
        self.model.eval()

        print("Image detector loaded successfully.")

    def predict(self, image_path: str):
        image = Image.open(image_path).convert("RGB")

        inputs = self.processor(
            images=image,
            return_tensors="pt"
        )

        inputs = {
            key: value.to(self.device)
            for key, value in inputs.items()
        }

        with torch.no_grad():
            outputs = self.model(**inputs)
            probabilities = torch.softmax(
                outputs.logits,
                dim=1
            )[0]

        fake_probability = probabilities[0].item()
        real_probability = probabilities[1].item()

        if fake_probability >= real_probability:
            verdict = "FAKE"
            confidence = fake_probability
        else:
            verdict = "REAL"
            confidence = real_probability

        return {
            "verdict": verdict,
            "confidence": round(confidence * 100, 2),
            "fake_probability": round(fake_probability * 100, 2),
            "real_probability": round(real_probability * 100, 2),
            "model": MODEL_NAME
        }


# Simple standalone test
if __name__ == "__main__":
    detector = ImageDetector()

    result = detector.predict("test_images/test3.jpeg")

    print("\n" + "=" * 50)
    print("IMAGE DETECTOR RESULT")
    print("=" * 50)

    for key, value in result.items():
        print(f"{key}: {value}")
