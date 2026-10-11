from pathlib import Path

import joblib
import pandas as pd
import numpy as np
import shap


# --------------------------------------------------
# PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "RSF_A_final_model.pkl"
)

FEATURE_COLUMNS_PATH = (
    BASE_DIR
    / "models"
    / "RSF_A_feature_columns.pkl"
)

BACKGROUND_PATH = (
    BASE_DIR
    / "models"
    / "shap_background.pkl"
)


# --------------------------------------------------
# LOAD MODEL
# --------------------------------------------------

rsf_model = joblib.load(MODEL_PATH)

feature_columns = list(
    joblib.load(FEATURE_COLUMNS_PATH)
)

background = joblib.load(BACKGROUND_PATH)

background = background[
    feature_columns
]


# --------------------------------------------------
# RSF PREDICTION FUNCTION FOR SHAP
# --------------------------------------------------

def rsf_predict(X):

    if not isinstance(X, pd.DataFrame):
        X = pd.DataFrame(
            X,
            columns=feature_columns
        )

    return rsf_model.predict(X)


# --------------------------------------------------
# CREATE SHAP EXPLAINER
# --------------------------------------------------

explainer = shap.Explainer(
    rsf_predict,
    background,
    algorithm="permutation"
)


# --------------------------------------------------
# FEATURE DISPLAY NAMES
# --------------------------------------------------

FEATURE_DISPLAY_NAMES = {
    "age": "Age",

    "Overall.Stage_II": "Overall Stage II",
    "Overall.Stage_IIIa": "Overall Stage IIIa",
    "Overall.Stage_IIIb": "Overall Stage IIIb",

    "Histology_large cell": "Histology - Large Cell",
    "Histology_nos": "Histology - NOS",
    "Histology_squamous cell carcinoma": "Histology - Squamous Cell Carcinoma",

    "gender_male": "Gender - Male",

    "original_glszm_SizeZoneNonUniformity":
        "Size Zone Non-Uniformity",

    "original_shape_MeshVolume":
        "Mesh Volume",

    "original_shape_MajorAxisLength":
        "Major Axis Length",

    "original_gldm_SmallDependenceHighGrayLevelEmphasis":
        "Small Dependence High Gray Level Emphasis",

    "original_firstorder_Energy":
        "First Order Energy",

    "original_firstorder_Kurtosis":
        "First Order Kurtosis",

    "original_shape_Maximum2DDiameterSlice":
        "Maximum 2D Diameter Slice",

    "original_glszm_GrayLevelNonUniformityNormalized":
        "Gray Level Non-Uniformity Normalized",

    "original_firstorder_Maximum":
        "First Order Maximum"
}


# --------------------------------------------------
# EXPLAIN ONE PATIENT
# --------------------------------------------------

def explain_patient(input_data: dict):

    patient_df = pd.DataFrame(
        [input_data]
    )

    # Ensure exact model feature order
    patient_df = patient_df.reindex(
        columns=feature_columns,
        fill_value=0
    )

    # Convert all features to numeric
    for column in feature_columns:

        patient_df[column] = pd.to_numeric(
            patient_df[column],
            errors="raise"
        )

    # --------------------------------------------------
    # CALCULATE SHAP VALUES
    # --------------------------------------------------

    shap_values = explainer(
        patient_df,
        max_evals=1000
    )

    values = np.asarray(
        shap_values.values
    )

    # One patient -> one feature vector
    if values.ndim > 1:
        values = values[0]

    # --------------------------------------------------
    # BUILD FEATURE CONTRIBUTIONS
    # --------------------------------------------------

    contributions = []

    for feature, value, shap_value in zip(
        feature_columns,
        patient_df.iloc[0].values,
        values
    ):

        shap_value = float(shap_value)

        if shap_value > 0:
            direction = "increases_risk"
            direction_display = "Increases predicted risk score"

        elif shap_value < 0:
            direction = "decreases_risk"
            direction_display = "Decreases predicted risk score"

        else:
            direction = "neutral"
            direction_display = "Neutral"

        contributions.append(
            {
                "feature": feature,

                "display_name": FEATURE_DISPLAY_NAMES.get(
                    feature,
                    feature
                ),

                "value": float(value),

                "shap_value": shap_value,

                "absolute_shap_value": abs(shap_value),

                "direction": direction,

                "direction_display": direction_display
            }
        )

    # Highest contribution first
    contributions.sort(
        key=lambda x: x["absolute_shap_value"],
        reverse=True
    )

    # --------------------------------------------------
    # RETURN RESULT
    # --------------------------------------------------

    return {
        "top_features": contributions[:5],
        "all_features": contributions
    }