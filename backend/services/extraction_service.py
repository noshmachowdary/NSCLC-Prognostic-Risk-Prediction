"""
CT Feature Extraction Service

Pipeline:
  1. Load uploaded CT scan (.nii / .nii.gz / .dcm / .zip of DICOM)
  2. Run 3D U-Net segmentation to produce a tumor mask
  3. Run PyRadiomics extraction on CT + mask
  4. Return the 9 radiomic features expected by the RSF-A model
"""

from pathlib import Path
import tempfile
import os
import zipfile
import logging

import numpy as np
import SimpleITK as sitk

# PyRadiomics
from radiomics import featureextractor

# Torch for U-Net inference
import torch
import torch.nn as nn

# --------------------------------------------------
# Logging
# --------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --------------------------------------------------
# Paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
UNET_PATH = BASE_DIR / "models" / "best_lung_unet3d.pth"


# --------------------------------------------------
# 3D U-Net Architecture
# --------------------------------------------------

class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv3d(in_ch, out_ch, 3, padding=1),
            nn.BatchNorm3d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv3d(out_ch, out_ch, 3, padding=1),
            nn.BatchNorm3d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.conv(x)


class UNet3D(nn.Module):
    def __init__(self, in_channels=1, out_channels=1, base_features=16):
        super().__init__()
        f = base_features
        self.enc1 = ConvBlock(in_channels, f)
        self.enc2 = ConvBlock(f, f * 2)
        self.enc3 = ConvBlock(f * 2, f * 4)
        self.enc4 = ConvBlock(f * 4, f * 8)
        self.bottleneck = ConvBlock(f * 8, f * 16)
        self.up4 = nn.ConvTranspose3d(f * 16, f * 8, 2, stride=2)
        self.dec4 = ConvBlock(f * 16, f * 8)
        self.up3 = nn.ConvTranspose3d(f * 8, f * 4, 2, stride=2)
        self.dec3 = ConvBlock(f * 8, f * 4)
        self.up2 = nn.ConvTranspose3d(f * 4, f * 2, 2, stride=2)
        self.dec2 = ConvBlock(f * 4, f * 2)
        self.up1 = nn.ConvTranspose3d(f * 2, f, 2, stride=2)
        self.dec1 = ConvBlock(f * 2, f)
        self.out_conv = nn.Conv3d(f, out_channels, 1)
        self.pool = nn.MaxPool3d(2)

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        e4 = self.enc4(self.pool(e3))
        b = self.bottleneck(self.pool(e4))
        d4 = self.dec4(torch.cat([self.up4(b), e4], dim=1))
        d3 = self.dec3(torch.cat([self.up3(d4), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))
        return self.out_conv(d1)


# --------------------------------------------------
# Load U-Net Model
# --------------------------------------------------

def load_unet_model():
    if not UNET_PATH.exists():
        raise FileNotFoundError(
            f"U-Net model not found: {UNET_PATH}"
        )
    model = UNet3D(in_channels=1, out_channels=1, base_features=16)
    state_dict = torch.load(
        str(UNET_PATH),
        map_location="cpu",
        weights_only=False
    )
    if isinstance(state_dict, dict) and "model" in state_dict:
        state_dict = state_dict["model"]
    if isinstance(state_dict, dict) and "state_dict" in state_dict:
        state_dict = state_dict["state_dict"]
    model.load_state_dict(state_dict)
    model.eval()
    logger.info("3D U-Net model loaded successfully")
    return model


# Lazy-load so the model is only loaded when needed
_unet_model = None


def get_unet_model():
    global _unet_model
    if _unet_model is None:
        _unet_model = load_unet_model()
    return _unet_model


# --------------------------------------------------
# CT Scan Loading
# --------------------------------------------------

def load_ct_scan(file_path):
    """
    Load a CT scan from .nii, .nii.gz, .dcm, or .zip of DICOM files.
    Returns a SimpleITK image.
    """
    file_path = Path(file_path)
    suffix = "".join(file_path.suffixes).lower()

    if suffix in (".nii", ".nii.gz"):
        image = sitk.ReadImage(str(file_path))
        logger.info(f"Loaded NIfTI image: {image.GetSize()}")
        return image

    if suffix == ".dcm":
        reader = sitk.ImageSeriesReader()
        series_ids = reader.GetGDCMSeriesIDs(str(file_path.parent))
        if series_ids:
            series_files = reader.GetGDCMSeriesFileNames(
                str(file_path.parent), series_ids[0]
            )
            reader.SetFileNames(series_files)
        else:
            reader.SetFileNames([str(file_path)])
        image = reader.Execute()
        logger.info(f"Loaded DICOM image: {image.GetSize()}")
        return image

    if suffix == ".zip":
        extract_dir = file_path.parent / "dicom_extracted"
        extract_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(str(file_path), "r") as zf:
            zf.extractall(str(extract_dir))
        reader = sitk.ImageSeriesReader()
        series_ids = reader.GetGDCMSeriesIDs(str(extract_dir))
        if not series_ids:
            raise ValueError(
                "No DICOM series found in the uploaded zip file."
            )
        series_files = reader.GetGDCMSeriesFileNames(
            str(extract_dir), series_ids[0]
        )
        reader.SetFileNames(series_files)
        image = reader.Execute()
        logger.info(f"Loaded DICOM series from zip: {image.GetSize()}")
        return image

    raise ValueError(
        f"Unsupported file format: {suffix}. "
        "Please upload .nii, .nii.gz, .dcm, or .zip"
    )


# --------------------------------------------------
# 3D U-Net Segmentation
# --------------------------------------------------

def segment_tumor(ct_image):
    """
    Run 3D U-Net inference on a CT scan to produce a tumor mask.
    Returns a SimpleITK binary mask image.
    """
    model = get_unet_model()

    # Convert to numpy array
    ct_array = sitk.GetArrayFromImage(ct_image).astype(np.float32)

    # Normalize HU values to [0, 1]
    ct_min = float(ct_array.min())
    ct_max = float(ct_array.max())
    if ct_max - ct_min > 0:
        ct_array = (ct_array - ct_min) / (ct_max - ct_min)

    original_shape = ct_array.shape

    # U-Net expects a power-of-2-ish depth; pad/crop to manageable size
    # Process in patches if volume is large
    target_depth = min(original_shape[0], 64)

    if original_shape[0] > target_depth:
        start = (original_shape[0] - target_depth) // 2
        ct_array = ct_array[start:start + target_depth]

    # Resize spatial dimensions to 128x128 if larger
    target_h = min(original_shape[1], 128)
    target_w = min(original_shape[2], 128)

    # Simple center crop for spatial dims
    if original_shape[1] > target_h:
        start_h = (original_shape[1] - target_h) // 2
        ct_array = ct_array[:, start_h:start_h + target_h, :]
    if original_shape[2] > target_w:
        start_w = (original_shape[2] - target_w) // 2
        ct_array = ct_array[:, :, start_w:start_w + target_w]

    input_tensor = torch.from_numpy(ct_array)
    input_tensor = input_tensor.unsqueeze(0).unsqueeze(0)  # [1, 1, D, H, W]

    logger.info(f"Running U-Net inference on shape: {input_tensor.shape}")

    with torch.no_grad():
        output = model(input_tensor)

    # Sigmoid + threshold
    mask_array = torch.sigmoid(output).squeeze().numpy()
    mask_array = (mask_array > 0.5).astype(np.uint8)

    # Pad back to original shape with zeros
    full_mask = np.zeros(original_shape, dtype=np.uint8)
    d_offset = (original_shape[0] - mask_array.shape[0]) // 2
    h_offset = (original_shape[1] - mask_array.shape[1]) // 2
    w_offset = (original_shape[2] - mask_array.shape[2]) // 2
    full_mask[
        d_offset:d_offset + mask_array.shape[0],
        h_offset:h_offset + mask_array.shape[1],
        w_offset:w_offset + mask_array.shape[2],
    ] = mask_array

    # If mask is empty (no tumor detected), create a small central ROI
    if full_mask.sum() == 0:
        logger.warning(
            "U-Net produced empty mask. "
            "Creating central ROI for feature extraction."
        )
        d, h, w = original_shape
        full_mask[
            d // 4: 3 * d // 4,
            h // 4: 3 * h // 4,
            w // 4: 3 * w // 4,
        ] = 1

    # Convert to SimpleITK, inheriting spacing/origin
    mask_image = sitk.GetImageFromArray(full_mask)
    mask_image.CopyInformation(ct_image)

    logger.info(
        f"Segmentation complete. "
        f"Tumor voxels: {int(full_mask.sum())}"
    )
    return mask_image


# --------------------------------------------------
# PyRadiomics Feature Extraction
# --------------------------------------------------

# The 9 features expected by the RSF-A model
REQUIRED_FEATURES = [
    "original_glszm_SizeZoneNonUniformity",
    "original_shape_MeshVolume",
    "original_shape_MajorAxisLength",
    "original_gldm_SmallDependenceHighGrayLevelEmphasis",
    "original_firstorder_Energy",
    "original_firstorder_Kurtosis",
    "original_shape_Maximum2DDiameterSlice",
    "original_glszm_GrayLevelNonUniformityNormalized",
    "original_firstorder_Maximum",
]


def extract_radiomic_features(ct_image, mask_image):
    """
    Run PyRadiomics extraction on the CT + mask pair.
    Returns a dict with the 9 required radiomic features.
    """
    extractor = featureextractor.RadiomicsFeatureExtractor()

    # Configure extractor for 3D features
    extractor.enableFeatureClassByName("firstorder", enabled=True)
    extractor.enableFeatureClassByName("shape", enabled=True)
    extractor.enableFeatureClassByName("glszm", enabled=True)
    extractor.enableFeatureClassByName("gldm", enabled=True)

    # Disable other classes we don't need
    extractor.enableFeatureClassByName("glcm", enabled=False)
    extractor.enableFeatureClassByName("glrlm", enabled=False)
    extractor.enableFeatureClassByName("ngtdm", enabled=False)

    # Run extraction
    logger.info("Running PyRadiomics feature extraction...")

    result = extractor.execute(ct_image, mask_image)

    # Extract only the required features
    features = {}
    for key in REQUIRED_FEATURES:
        if key in result:
            features[key] = float(result[key])
        else:
            logger.warning(
                f"Feature '{key}' not found in extraction result. "
                "Using 0.0 as fallback."
            )
            features[key] = 0.0

    logger.info(
        f"PyRadiomics extraction complete. "
        f"Features extracted: {len(features)}"
    )
    return features


# --------------------------------------------------
# Full Pipeline
# --------------------------------------------------

def extract_features_from_ct(file_path):
    """
    Full pipeline: load CT -> segment tumor -> extract radiomics.
    Returns a dict with the 9 required features.
    """
    # Step 1: Load CT scan
    logger.info("Step 1: Loading CT scan...")
    ct_image = load_ct_scan(file_path)

    # Step 2: 3D U-Net Segmentation
    logger.info("Step 2: Segmenting tumor with 3D U-Net...")
    mask_image = segment_tumor(ct_image)

    # Step 3: PyRadiomics Feature Extraction
    logger.info("Step 3: Extracting features via PyRadiomics...")
    features = extract_radiomic_features(ct_image, mask_image)

    return features
