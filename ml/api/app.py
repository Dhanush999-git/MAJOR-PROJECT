import os
import sys
import tempfile

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ============================================================
# PYTHON PATH CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

sys.path.insert(0, BASE_DIR)


# ============================================================
# IMPORT MODELS
# ============================================================

from models.image_detector import ImageDetector
from models.text.text_detector import TextDetector


# ============================================================
# IMPORT VERIFICATION SERVICES
# ============================================================

from services.factcheck_service import FactCheckService
from services.web_evidence_service import WebEvidenceService
from services.evidence_nli_pipeline import EvidenceNLIPipeline
from services.verdict_engine import VerdictEngine


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="VeriFact ML API",
    version="1.0.0"
)


# ============================================================
# CORS CONFIGURATION
# ============================================================

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
# REQUEST MODELS
# ============================================================

class TextPredictionRequest(BaseModel):

    text: str


class TextVerificationRequest(BaseModel):

    text: str


# ============================================================
# LOAD MODELS AND SERVICES
# ============================================================

print("Loading VeriFact Image Detector...")

detector = ImageDetector()


print("Loading VeriFact Text Detector...")

text_detector = TextDetector()


print("Loading Fact Check Service...")

factcheck_service = FactCheckService()


print("Loading Web Evidence Service...")

web_evidence_service = WebEvidenceService()


print("Loading Evidence + NLI Pipeline...")

evidence_nli_pipeline = EvidenceNLIPipeline()


print("Loading Verdict Engine...")

verdict_engine = VerdictEngine()


print("VeriFact ML API is ready.")


# ============================================================
# ROOT ENDPOINT
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
# HEALTH ENDPOINT
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
async def predict_image(
    file: UploadFile = File(...)
):

    # --------------------------------------------------------
    # VALIDATE IMAGE TYPE
    # --------------------------------------------------------

    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp"
    }

    if file.content_type not in allowed_types:

        raise HTTPException(
            status_code=400,
            detail=(
                "Only JPG, PNG and WebP images "
                "are supported."
            )
        )


    # --------------------------------------------------------
    # READ UPLOADED FILE
    # --------------------------------------------------------

    contents = await file.read()

    if not contents:

        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )


    temporary_path = None


    try:

        # ----------------------------------------------------
        # CREATE TEMPORARY IMAGE FILE
        # ----------------------------------------------------

        suffix = os.path.splitext(
            file.filename or ".jpg"
        )[1]


        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_file.write(contents)

            temporary_path = temp_file.name


        # ----------------------------------------------------
        # RUN IMAGE DETECTOR
        # ----------------------------------------------------

        result = detector.predict(
            temporary_path
        )


        # ----------------------------------------------------
        # RETURN RESULT
        # ----------------------------------------------------

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

        # ----------------------------------------------------
        # DELETE TEMPORARY FILE
        # ----------------------------------------------------

        if (
            temporary_path
            and os.path.exists(temporary_path)
        ):

            os.remove(
                temporary_path
            )


# ============================================================
# TEXT PREDICTION
# ============================================================

@app.post("/predict/text")
async def predict_text(
    request: TextPredictionRequest
):

    # --------------------------------------------------------
    # VALIDATE TEXT
    # --------------------------------------------------------

    text = request.text.strip()

    if not text:

        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty."
        )


    try:

        # ----------------------------------------------------
        # RUN EXISTING TEXT CLASSIFIER
        # ----------------------------------------------------

        result = text_detector.predict(
            text
        )


        # ----------------------------------------------------
        # RETURN RESULT
        # ----------------------------------------------------

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


# ============================================================
# EVIDENCE-BASED TEXT VERIFICATION
# ============================================================

@app.post("/verify/text")
async def verify_text(
    request: TextVerificationRequest
):

    # --------------------------------------------------------
    # VALIDATE CLAIM
    # --------------------------------------------------------

    text = request.text.strip()

    if not text:

        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty."
        )


    try:

        # ====================================================
        # STEP 1
        # EXISTING ML TEXT CLASSIFIER
        # ====================================================

        classifier_result = text_detector.predict(
            text
        )


        # ====================================================
        # STEP 2
        # GOOGLE FACT CHECK SEARCH
        # ====================================================

        factcheck_results = factcheck_service.search(
            query=text,
            page_size=10
        )


        # ====================================================
        # STEP 3
        # WEB / NEWS EVIDENCE SEARCH
        # ====================================================

        web_results = web_evidence_service.search(
            claim=text,
            max_results=5
        )


        # ====================================================
        # STEP 4
        # COLLECT WEB EVIDENCE
        # ====================================================

        evidence_candidates = []


        for source in web_results:

            evidence_text = source.get(
                "evidence_text"
            )


            if not evidence_text:

                continue


            evidence_candidates.append(
                {
                    "evidence_text":
                        evidence_text,

                    "publisher":
                        source.get(
                            "publisher"
                        ),

                    "title":
                        source.get(
                            "title"
                        ),

                    "article_url":
                        source.get(
                            "article_url"
                        ),

                    "google_news_url":
                        source.get(
                            "google_news_url"
                        ),

                    "publisher_url":
                        source.get(
                            "publisher_url"
                        ),

                    "published":
                        source.get(
                            "published"
                        ),

                    "evidence_type":
                        source.get(
                            "evidence_type"
                        ),

                    "resolved":
                        source.get(
                            "resolved",
                            False
                        ),

                    "extracted":
                        source.get(
                            "extracted",
                            False
                        ),
                }
            )


        # ====================================================
        # STEP 5
        # EVIDENCE + NLI VERIFICATION
        # ====================================================

        evidence_verification = {

            "final_verdict":
                "NOT_ENOUGH_INFO",

            "confidence":
                0.0,

            "evidence_count":
                0,

            "evidence_results":
                [],
        }


        if evidence_candidates:

            evidence_verification = (
                evidence_nli_pipeline.verify_sources(
                    claim=text,
                    sources=evidence_candidates,
                    selection_top_k=3,
                    ranking_top_k=5,
                )
            )


        # ====================================================
        # STEP 6
        # FINAL VERDICT
        # ====================================================

        final_result = verdict_engine.decide(

            claim=text,

            factcheck_results=
                factcheck_results,

            nli_result=
                evidence_verification,
        )


        # ====================================================
        # STEP 7
        # RETURN COMPLETE VERIFICATION RESULT
        # ====================================================

        return {

            "success":
                True,

            "result": {

                "text":
                    text,

                "verdict":
                    final_result.get(
                        "verdict"
                    ),

                "confidence":
                    final_result.get(
                        "confidence"
                    ),

                "reason":
                    final_result.get(
                        "reason"
                    ),

                "factcheck_used":
                    final_result.get(
                        "factcheck_used",
                        False
                    ),

                "factcheck_similarity":
                    final_result.get(
                        "factcheck_similarity"
                    ),

                "classifier":
                    classifier_result,

                "fact_checks":
                    factcheck_results,

                "web_evidence":
                    web_results,

                "evidence_verification":
                    evidence_verification,
            }
        }


    # ========================================================
    # VALIDATION ERROR
    # ========================================================

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


    # ========================================================
    # GENERAL ERROR
    # ========================================================

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Text verification failed: {e}"
            )
        )