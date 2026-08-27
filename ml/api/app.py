import os
import sys
import tempfile

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Allow Python to find the models folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from models.image_detector import ImageDetector
from models.text.text_detector import TextDetector


app = FastAPI(
    title="VeriFact ML API",
    version="1.0.0"
)


# Allow your React/Vite frontend to communicate with Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# TEXT REQUEST MODEL
# ============================================================

class TextPredictionRequest(BaseModel):
    text: str


# ============================================================
# LOAD MODELS
# ============================================================

print("Loading VeriFact Image Detector...")
detector = ImageDetector()

print("Loading VeriFact Text Detector...")
text_detector = TextDetector()

print("VeriFact ML API is ready.")


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "service": "VeriFact ML API",
        "models": {
            "image": "prithivMLmods/deepfake-detector-model-v1",
            "text": "GhostFaith/distilbert-fakenews"
        }
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "models": {
            "image": detector is not None,
            "text": text_detector is not None
        }
    }


# ============================================================
# IMAGE PREDICTION
# ============================================================

@app.post("/predict/image")
async def predict_image(file: UploadFile = File(...)):

    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp"
    }

    if file.content_type not in allowed_types:

        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WebP images are supported."
        )

    contents = await file.read()

    if not contents:

        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )

    temporary_path = None

    try:

        suffix = os.path.splitext(
            file.filename or ".jpg"
        )[1]

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_file.write(contents)
            temporary_path = temp_file.name

        result = detector.predict(
            temporary_path
        )

        return {
            "success": True,
            "filename": file.filename,
            "result": result
        }

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Image prediction failed: {e}"
        )

    finally:

        if (
            temporary_path
            and os.path.exists(temporary_path)
        ):

            os.remove(temporary_path)


# ============================================================
# TEXT PREDICTION
# ============================================================

@app.post("/predict/text")
async def predict_text(
    request: TextPredictionRequest
):

    text = request.text.strip()

    if not text:

        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty."
        )

    try:

        result = text_detector.predict(
            text
        )

        return {
            "success": True,
            "result": result
        }

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Text prediction failed: {e}"
        )