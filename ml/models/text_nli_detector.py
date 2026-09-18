import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


MODEL_NAME = "Yuu-Xie/fever-nli-modernbert-large"


class TextNLIVerifier:
    def __init__(self):
        print("=" * 60)
        print("Loading VeriFact NLI Verification Model")
        print("=" * 60)
        print(f"Model: {MODEL_NAME}")

        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        print(f"Device: {self.device}")

        self.tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME
        )

        self.model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_NAME
        )

        self.model.to(self.device)
        self.model.eval()

        print("NLI model loaded successfully.")
        print("=" * 60)

    def predict(self, claim: str, evidence: str):
        if not claim or not claim.strip():
            raise ValueError("Claim cannot be empty.")

        if not evidence or not evidence.strip():
            raise ValueError("Evidence cannot be empty.")

        # IMPORTANT:
        # NLI expects:
        #
        # premise   = evidence
        # hypothesis = claim
        #
        # We are therefore checking:
        #
        # "Does this evidence support the user's claim?"
        inputs = self.tokenizer(
            evidence,
            claim,
            return_tensors="pt",
            truncation=True,
            max_length=256,
        )

        inputs = {
            key: value.to(self.device)
            for key, value in inputs.items()
        }

        with torch.no_grad():
            outputs = self.model(**inputs)

        probabilities = torch.softmax(
            outputs.logits,
            dim=-1
        )[0]

        predicted_class = int(
            torch.argmax(probabilities).item()
        )

        confidence = float(
            probabilities[predicted_class].item()
        )

        raw_label = self.model.config.id2label.get(
            predicted_class,
            str(predicted_class)
        )

        raw_label_lower = raw_label.lower()

        if "entail" in raw_label_lower:
            verdict = "SUPPORTS"

        elif "contrad" in raw_label_lower:
            verdict = "REFUTES"

        elif "neutral" in raw_label_lower:
            verdict = "NOT_ENOUGH_INFO"

        else:
            verdict = raw_label.upper()

        return {
            "claim": claim,
            "evidence": evidence,
            "verdict": verdict,
            "raw_label": raw_label,
            "confidence": round(confidence, 4),
            "probabilities": {
                self.model.config.id2label.get(
                    index,
                    str(index)
                ): round(
                    float(probabilities[index].item()),
                    4
                )
                for index in range(len(probabilities))
            },
            "model": MODEL_NAME,
            "device": str(self.device),
        }