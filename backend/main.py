from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any
import time
import tempfile
import os
import traceback

from services.rag_service import ask_rag
from services.prediction_service import predict_patient_risk
from services.extraction_service import extract_features_from_ct


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="Medical AI Backend",
    description="Backend API for Medical AI prediction and RAG",
    version="1.0.0"
)


# ============================================================
# CORS — allow the frontend to talk to this API
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# REQUEST MODELS
# ============================================================

class QuestionRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=1,
        description="Medical question"
    )


class PredictionRequest(BaseModel):
    features: Dict[str, Any] = Field(
        ...,
        description="Patient and radiomic features"
    )


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": "Medical AI Backend is running",
        "status": "success"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "service": "medical-ai-backend"
    }


# ============================================================
# RAG / MEDICAL ASSISTANT
# ============================================================

@app.post("/ask")
def ask_question(request: QuestionRequest):

    try:

        result = ask_rag(
            request.question
        )

        return {
            "success": True,
            "data": result
        }

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        print("RAG API ERROR:", str(e))

        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing the question."
        )


# ============================================================
# RSF-A PREDICTION
# ============================================================

@app.post("/predict")
def predict(request: PredictionRequest):

    try:

        result = predict_patient_risk(
            request.features
        )

        return {
            "success": True,
            "data": result
        }

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except RuntimeError as e:

        print("PREDICTION ERROR:", str(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    except Exception as e:

        print("UNEXPECTED PREDICTION ERROR:", str(e))

        raise HTTPException(
            status_code=500,
            detail="An error occurred while generating the prediction."
        )


# ============================================================
# CT FEATURE EXTRACTION
# ============================================================

@app.post("/extract-features")
async def extract_features(file: UploadFile = File(...)):

    """
    Accept a CT scan file (.zip, .dcm, .nii, .nii.gz),
    run 3D U-Net segmentation + PyRadiomics extraction,
    and return the extracted radiomic features.
    """

    try:

        start_time = time.time()

        # ----------------------------------------------------
        # Validate file extension
        # ----------------------------------------------------

        filename = (file.filename or "").lower()

        valid_extensions = (
            ".zip", ".dcm", ".nii", ".nii.gz"
        )

        if not any(
            filename.endswith(ext)
            for ext in valid_extensions
        ):
            raise ValueError(
                "Unsupported file type. "
                "Please upload .zip, .dcm, .nii, or .nii.gz"
            )

        # ----------------------------------------------------
        # Save uploaded file to a temporary file on disk
        # ----------------------------------------------------

        contents = await file.read()

        if not contents:
            raise ValueError("Uploaded file is empty.")

        print(
            f"Received CT file: {file.filename} "
            f"({len(contents) / 1024 / 1024:.2f} MB)"
        )

        suffix = ""
        if filename.endswith(".nii.gz"):
            suffix = ".nii.gz"
        elif filename.endswith(".nii"):
            suffix = ".nii"
        elif filename.endswith(".dcm"):
            suffix = ".dcm"
        elif filename.endswith(".zip"):
            suffix = ".zip"

        tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        try:
            with os.fdopen(tmp_fd, "wb") as tmp_file:
                tmp_file.write(contents)

            print(f"Saved to temporary file: {tmp_path}")

            # ------------------------------------------------
            # Step 1: 3D U-Net Segmentation
            # ------------------------------------------------

            print("Stage 1: Segmenting Tumor with 3D U-Net...")

            # ------------------------------------------------
            # Step 2: PyRadiomics Feature Extraction
            # ------------------------------------------------

            print("Stage 2: Extracting Features via PyRadiomics...")

            features = extract_features_from_ct(tmp_path)

            extraction_time = time.time() - start_time

            print(
                f"Feature extraction complete in "
                f"{extraction_time:.2f}s"
            )

            return {
                "success": True,
                "data": {
                    **features,
                    "extraction_time_seconds": round(
                        extraction_time, 2
                    )
                }
            }
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                print(f"Cleaned up temporary file: {tmp_path}")
            # Clean up extracted DICOM directory if it was created
            tmp_dir = os.path.dirname(tmp_path)
            dicom_dir = os.path.join(tmp_dir, "dicom_extracted")
            if os.path.exists(dicom_dir):
                import shutil
                shutil.rmtree(dicom_dir, ignore_errors=True)

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        print("EXTRACTION ERROR:", str(e))
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during feature extraction: {str(e)}"
        )