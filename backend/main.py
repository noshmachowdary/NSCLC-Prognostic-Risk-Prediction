from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any
import time

from services.rag_service import ask_rag
from services.prediction_service import predict_patient_risk


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
        # Read uploaded file
        # ----------------------------------------------------

        contents = await file.read()

        if not contents:
            raise ValueError("Uploaded file is empty.")

        print(
            f"Received CT file: {file.filename} "
            f"({len(contents) / 1024 / 1024:.2f} MB)"
        )

        # ----------------------------------------------------
        # Step 1: 3D U-Net Segmentation
        # (Placeholder — connect your segmentation model here)
        # ----------------------------------------------------

        print("Stage 1: Segmenting Tumor with 3D U-Net...")

        # TODO: Load best_lung_unet3d.pth and run inference
        #       on the uploaded CT scan to produce a tumor mask.

        # ----------------------------------------------------
        # Step 2: PyRadiomics Feature Extraction
        # (Placeholder — connect PyRadiomics here)
        # ----------------------------------------------------

        print("Stage 2: Extracting Features via PyRadiomics...")

        # TODO: Run pyradiomics on the CT + tumor mask
        #       to extract the full radiomic feature set.

        # ----------------------------------------------------
        # Return extracted features
        # Replace these placeholder values with actual
        # extraction results from your pipeline.
        # ----------------------------------------------------

        extraction_time = time.time() - start_time

        return {
            "success": True,
            "data": {
                "original_shape_MeshVolume": 42000,
                "sphericity": 0.72,
                "mean_intensity": -450,
                "original_firstorder_Energy": 85000,
                "original_firstorder_Entropy": 6.8,
                "original_firstorder_Contrast": 120,
                "extraction_time_seconds": round(
                    extraction_time, 2
                )
            }
        }

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        print("EXTRACTION ERROR:", str(e))

        raise HTTPException(
            status_code=500,
            detail="An error occurred during feature extraction."
        )