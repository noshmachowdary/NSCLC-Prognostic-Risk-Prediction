from pathlib import Path
import time
from services.explainability_service import explain_patient
import joblib
import pandas as pd


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "models" / "RSF_A_final_model.pkl"
FEATURE_COLUMNS_PATH = BASE_DIR / "models" / "RSF_A_feature_columns.pkl"


# ============================================================
# LOAD MODEL AND FEATURE COLUMNS
# ============================================================

print("=" * 70)
print("Loading RSF-A prediction model...")
print("=" * 70)

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"RSF model not found: {MODEL_PATH}"
    )

if not FEATURE_COLUMNS_PATH.exists():
    raise FileNotFoundError(
        f"Feature columns file not found: {FEATURE_COLUMNS_PATH}"
    )


# Load trained Random Survival Forest
rsf_model = joblib.load(MODEL_PATH)

# Load the exact feature order used during training
feature_columns = joblib.load(FEATURE_COLUMNS_PATH)

feature_columns = list(feature_columns)


print("RSF-A model loaded successfully.")
print(f"Expected number of features: {len(feature_columns)}")

print("\nExpected feature columns:")

for i, feature in enumerate(feature_columns, start=1):
    print(f"  {i}. {feature}")

print("=" * 70)


# ============================================================
# PREDICT PATIENT RISK
# ============================================================

def predict_patient_risk(input_data: dict):
    """
    Generate risk score and survival curve using the
    trained Random Survival Forest model.
    """
    explanation = explain_patient(input_data)
    start_time = time.time()

    if not isinstance(input_data, dict):
        raise ValueError(
            "Input data must be a JSON object."
        )

    # --------------------------------------------------------
    # Convert incoming JSON into DataFrame
    # --------------------------------------------------------

    df = pd.DataFrame([input_data])

    # --------------------------------------------------------
    # Arrange columns exactly as used during model training
    #
    # Missing columns are filled with 0.
    # Extra columns are ignored.
    # --------------------------------------------------------

    df = df.reindex(
        columns=feature_columns,
        fill_value=0
    )

    # --------------------------------------------------------
    # Validate numeric values
    # --------------------------------------------------------

    for column in feature_columns:

        try:
            df[column] = pd.to_numeric(
                df[column],
                errors="raise"
            )

        except Exception:
            raise ValueError(
                f"Invalid value for feature '{column}'. "
                "All model features must be numeric."
            )

    # --------------------------------------------------------
    # Generate RSF risk score
    # --------------------------------------------------------

    try:

        risk_score = rsf_model.predict(df)[0]

    except Exception as e:

        raise RuntimeError(
            f"RSF risk prediction failed: {str(e)}"
        )

    # --------------------------------------------------------
    # Generate survival function
    # --------------------------------------------------------

    try:

        surv_funcs = rsf_model.predict_survival_function(df)

        survival_function = surv_funcs[0]

        times = survival_function.x.tolist()

        probabilities = survival_function.y.tolist()

    except Exception as e:

        raise RuntimeError(
            f"Survival curve generation failed: {str(e)}"
        )

    # --------------------------------------------------------
    # Prediction time
    # --------------------------------------------------------

    prediction_time = time.time() - start_time

    # --------------------------------------------------------
    # Return JSON-safe result
    # --------------------------------------------------------

    return {
        "risk_score": float(risk_score),

        "survival_curve": {
            "times": [float(x) for x in times],
            "probabilities": [float(x) for x in probabilities]
        },

        "explainability": explanation,

        "prediction_time_seconds": round(prediction_time, 4)
    }