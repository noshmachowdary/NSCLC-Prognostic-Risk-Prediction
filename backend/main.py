from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any

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