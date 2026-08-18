import os
import sys
import tempfile

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Allow Python to find the models folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from models.image_detector import ImageDetector


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


print("Loading VeriFact Image Detector...")
detector = ImageDetector()
print("VeriFact ML API is ready.")


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "VeriFact ML API",
        "model": "prithivMLmods/deepfake-detector-model-v1"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": detector is not None
    }


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
        suffix = os.path.splitext(file.filename or ".jpg")[1]

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_file.write(contents)
            temporary_path = temp_file.name

        result = detector.predict(temporary_path)

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

        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)
