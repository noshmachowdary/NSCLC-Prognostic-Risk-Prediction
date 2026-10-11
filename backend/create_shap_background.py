from pathlib import Path

import joblib
import pandas as pd
import shap


# --------------------------------------------------
# PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    BASE_DIR
    / "data"
    / "multimodal_dataset_422_cleaned.csv"
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
# CHECK FILES
# --------------------------------------------------

if not DATA_PATH.exists():
    raise FileNotFoundError(
        f"Dataset not found:\n{DATA_PATH}"
    )

if not FEATURE_COLUMNS_PATH.exists():
    raise FileNotFoundError(
        f"Feature columns file not found:\n"
        f"{FEATURE_COLUMNS_PATH}"
    )


# --------------------------------------------------
# LOAD DATASET
# --------------------------------------------------

print("=" * 70)
print("Creating SHAP background dataset")
print("=" * 70)

df = pd.read_csv(DATA_PATH)

print("Dataset shape:", df.shape)


# --------------------------------------------------
# CLINICAL FEATURES
# --------------------------------------------------

clinical_cols = [
    "age",
    "Overall.Stage",
    "Histology",
    "gender"
]

clinical_df = df[clinical_cols].copy()

clinical_encoded = pd.get_dummies(
    clinical_df,
    columns=[
        "Overall.Stage",
        "Histology",
        "gender"
    ],
    drop_first=True
)

clinical_encoded = clinical_encoded.astype(float)


# --------------------------------------------------
# RADIOMIC FEATURES
# --------------------------------------------------

stable_radiomics = [
    "original_glszm_SizeZoneNonUniformity",
    "original_shape_MeshVolume",
    "original_shape_MajorAxisLength",
    "original_gldm_SmallDependenceHighGrayLevelEmphasis",
    "original_firstorder_Energy",
    "original_firstorder_Kurtosis",
    "original_shape_Maximum2DDiameterSlice",
    "original_glszm_GrayLevelNonUniformityNormalized",
    "original_firstorder_Maximum"
]

X_radio = df[stable_radiomics].copy()


# --------------------------------------------------
# CREATE MULTIMODAL FEATURE MATRIX
# --------------------------------------------------

X_multimodal = pd.concat(
    [
        clinical_encoded.reset_index(drop=True),
        X_radio.reset_index(drop=True)
    ],
    axis=1
)

X_multimodal = X_multimodal.astype(float)


print("Total features:", X_multimodal.shape[1])
print("Total patients:", X_multimodal.shape[0])


# --------------------------------------------------
# VERIFY FEATURE ORDER
# --------------------------------------------------

feature_columns = list(
    joblib.load(FEATURE_COLUMNS_PATH)
)

X_multimodal = X_multimodal.reindex(
    columns=feature_columns
)

if X_multimodal.isnull().any().any():
    raise ValueError(
        "NaN values detected after feature alignment."
    )


# --------------------------------------------------
# CREATE EXACT SHAP BACKGROUND
# --------------------------------------------------

background = shap.sample(
    X_multimodal,
    50,
    random_state=42
)


# --------------------------------------------------
# SAVE
# --------------------------------------------------

joblib.dump(
    background,
    BACKGROUND_PATH
)


print("\nSHAP background created successfully.")

print("Background shape:", background.shape)

print("\nBackground features:")
print(background.columns.tolist())

print("\nSaved to:")
print(BACKGROUND_PATH)

print("=" * 70)