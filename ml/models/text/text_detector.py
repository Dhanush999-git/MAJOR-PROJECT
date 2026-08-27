import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


# ============================================================
# MODEL CONFIGURATION
# ============================================================

MODEL_NAME = "GhostFaith/distilbert-fakenews"


class TextDetector:

    def __init__(self):

        print("=" * 60)
        print("Loading VeriFact Text Detection Model")
        print("=" * 60)

        print(f"Model: {MODEL_NAME}")

        # ----------------------------------------------------
        # Select device
        # ----------------------------------------------------

        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        print(f"Device: {self.device}")

        # ----------------------------------------------------
        # Load tokenizer
        # ----------------------------------------------------

        self.tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME
        )

        # ----------------------------------------------------
        # Load pretrained model
        # ----------------------------------------------------

        self.model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_NAME
        )

        # ----------------------------------------------------
        # Move model to GPU / CPU
        # ----------------------------------------------------

        self.model.to(self.device)

        # ----------------------------------------------------
        # Evaluation mode
        # ----------------------------------------------------

        self.model.eval()

        print("Text model loaded successfully.")
        print("=" * 60)

    # ========================================================
    # PREDICT
    # ========================================================

    def predict(self, text: str):

        # ----------------------------------------------------
        # Validate input
        # ----------------------------------------------------

        if not text or not text.strip():

            raise ValueError(
                "Text cannot be empty."
            )

        # ----------------------------------------------------
        # Tokenize
        # ----------------------------------------------------

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
        )

        # ----------------------------------------------------
        # Move tensors to device
        # ----------------------------------------------------

        inputs = {
            key: value.to(self.device)
            for key, value in inputs.items()
        }

        # ----------------------------------------------------
        # Run model
        # ----------------------------------------------------

        with torch.no_grad():

            outputs = self.model(
                **inputs
            )

        # ----------------------------------------------------
        # Convert logits to probabilities
        # ----------------------------------------------------

        probabilities = torch.softmax(
            outputs.logits,
            dim=-1,
        )[0]

        # ----------------------------------------------------
        # Get prediction
        # ----------------------------------------------------

        predicted_class = int(
            torch.argmax(
                probabilities
            ).item()
        )

        confidence = float(
            probabilities[predicted_class].item()
        )

        # ----------------------------------------------------
        # Model labels
        # ----------------------------------------------------

        raw_label = self.model.config.id2label.get(
            predicted_class,
            str(predicted_class),
        )

        label = raw_label.upper()

        # ----------------------------------------------------
        # GhostFaith/distilbert-fakenews mapping
        #
        # Class 0 = REAL
        # Class 1 = FAKE
        # ----------------------------------------------------

        if predicted_class == 0:

            final_label = "REAL"

        elif predicted_class == 1:

            final_label = "FAKE"

        else:

            final_label = label

        # ----------------------------------------------------
        # Build probability response
        # ----------------------------------------------------

        probability_result = {
            str(
                self.model.config.id2label.get(
                    index,
                    str(index)
                )
            ): round(
                float(probabilities[index].item()),
                4
            )
            for index in range(
                len(probabilities)
            )
        }

        # ----------------------------------------------------
        # Return result
        # ----------------------------------------------------

        return {

            "label": final_label,

            "raw_label": raw_label,

            "confidence": round(
                confidence,
                4
            ),

            "probabilities": probability_result,

            "model": MODEL_NAME,

            "device": str(
                self.device
            ),
        }