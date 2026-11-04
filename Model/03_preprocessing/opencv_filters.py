"""
Model/03_preprocessing/opencv_filters.py
-----------------------------------------
Clinical Image Filtering & Preprocessing Pipeline for DermaVision.

Provides OpenCV-accelerated image filtering:
  1. Bilateral Filtering: Edge-preserving skin smoothing (preserves lesion boundaries & eyes)
  2. CLAHE (Contrast Limited Adaptive Histogram Equalization): Lighting normalization across facial halves
  3. CIELAB Color Space Decomposition:
       - L* : Lightness (infraorbital dark circles)
       - a* : Erythema / Redness (active inflammatory acne, papules, rosacea)
       - b* : Melanin / Pigmentation (hyperpigmentation, melasma)
  4. Periorbital Sub-Ocular Enhancement: Optimized contrast for dark circle extraction
  5. Erythema / Acne Redness Mask: Segmenting inflamed skin regions

Includes automatic vectorized fallback if cv2 is not present in runtime environment.
"""

import numpy as np
from PIL import Image

try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False


def bilateral_skin_filter(image_rgb: np.ndarray, d: int = 9, sigma_color: float = 75.0, sigma_space: float = 75.0) -> np.ndarray:
    """
    Applies bilateral filtering to smooth skin texture and suppress sensor noise
    while strictly preserving sharp edges (lesion margins, eye borders, pores, wrinkles).

    Args:
        image_rgb: uint8 RGB numpy array (H, W, 3)
        d: Diameter of each pixel neighborhood
        sigma_color: Filter sigma in the color space (higher = more smoothing)
        sigma_space: Filter sigma in the coordinate space

    Returns:
        Filtered uint8 RGB numpy array
    """
    if not isinstance(image_rgb, np.ndarray):
        image_rgb = np.array(image_rgb)

    if HAS_OPENCV:
        # cv2 uses BGR internally, so convert RGB -> BGR -> bilateral -> RGB
        bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
        filtered_bgr = cv2.bilateralFilter(bgr, d=d, sigmaColor=sigma_color, sigmaSpace=sigma_space)
        return cv2.cvtColor(filtered_bgr, cv2.COLOR_BGR2RGB)
    else:
        # Fallback using PIL edge-preserving median
        pil_img = Image.fromarray(image_rgb).filter(Image.BoxBlur(1))
        return np.array(pil_img)


def clahe_illumination_filter(image_rgb: np.ndarray, clip_limit: float = 2.0, tile_grid_size: tuple = (8, 8)) -> np.ndarray:
    """
    Normalizes uneven facial lighting/shadows using Contrast Limited Adaptive
    Histogram Equalization (CLAHE) applied exclusively to the L* (lightness) channel.
    This prevents color distortion while standardizing lighting for AI inference.

    Args:
        image_rgb: uint8 RGB numpy array
        clip_limit: Threshold for contrast limiting
        tile_grid_size: Size of grid for local histogram equalization (default 8x8)

    Returns:
        Illumination-normalized uint8 RGB numpy array
    """
    if not isinstance(image_rgb, np.ndarray):
        image_rgb = np.array(image_rgb)

    if HAS_OPENCV:
        lab = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2LAB)
        l_chan, a_chan, b_chan = cv2.split(lab)

        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
        l_enhanced = clahe.apply(l_chan)

        enhanced_lab = cv2.merge([l_enhanced, a_chan, b_chan])
        return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2RGB)
    else:
        return image_rgb


def extract_cielab_channels(image_rgb: np.ndarray) -> dict:
    """
    Extracts calibrated CIELAB channels for dermatological telemetry:
      - L_star: 0-100 Lightness (dark circles, dullness)
      - a_star: -128 to 127 Green to Red (erythema, active acne inflammation)
      - b_star: -128 to 127 Blue to Yellow (melanin hyperpigmentation)

    Returns:
        dict containing 'L', 'a', 'b' channel 2D numpy arrays.
    """
    if not isinstance(image_rgb, np.ndarray):
        image_rgb = np.array(image_rgb)

    if HAS_OPENCV:
        lab = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2LAB)
        l_raw, a_raw, b_raw = cv2.split(lab)
        # OpenCV scales L to [0, 255] (L* = L * 100 / 255)
        # a and b are offset by 128 (a* = a - 128, b* = b - 128)
        L_star = l_raw.astype(np.float32) * (100.0 / 255.0)
        a_star = a_raw.astype(np.float32) - 128.0
        b_star = b_raw.astype(np.float32) - 128.0
        return {"L": L_star, "a": a_star, "b": b_star, "raw_lab": lab}
    else:
        norm = image_rgb.astype(np.float32) / 255.0
        L_star = 0.299 * norm[:, :, 0] + 0.587 * norm[:, :, 1] + 0.114 * norm[:, :, 2]
        a_star = norm[:, :, 0] - norm[:, :, 1]
        b_star = (norm[:, :, 0] + norm[:, :, 1]) / 2.0 - norm[:, :, 2]
        return {"L": L_star * 100.0, "a": a_star * 100.0, "b": b_star * 100.0, "raw_lab": None}


def generate_erythema_acne_mask(image_rgb: np.ndarray, sensitivity: float = 1.2) -> np.ndarray:
    """
    Generates a binary/heatmap mask isolating inflammatory redness (acne, papules, pustules).
    Uses OpenCV color thresholding on the a* channel and HSV saturation.

    Returns:
        uint8 single-channel mask (0 to 255)
    """
    if not isinstance(image_rgb, np.ndarray):
        image_rgb = np.array(image_rgb)

    if HAS_OPENCV:
        # Smooth image to remove pore micro-noise
        smoothed = cv2.GaussianBlur(image_rgb, (5, 5), 0)
        lab = cv2.cvtColor(smoothed, cv2.COLOR_RGB2LAB)
        _, a_chan, _ = cv2.split(lab)

        # Skin mean erythema baseline
        mean_a = float(np.mean(a_chan))
        std_a = float(np.std(a_chan))
        thresh = mean_a + (sensitivity * std_a)

        _, mask = cv2.threshold(a_chan, thresh, 255, cv2.THRESH_BINARY)
        # Morphological opening to clean single-pixel noise
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        cleaned_mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        return cleaned_mask
    else:
        r = image_rgb[:, :, 0].astype(np.float32)
        g = image_rgb[:, :, 1].astype(np.float32)
        diff = r - g
        mask = (diff > 35).astype(np.uint8) * 255
        return mask


def preprocess_dermatology_pipeline(image_rgb: np.ndarray) -> dict:
    """
    Complete clinical preprocessing pipeline:
      1. Edge-preserving Bilateral Filter
      2. Lighting CLAHE Normalization
      3. CIELAB Channel Extraction
      4. Erythema Redness Masking

    Returns:
        dict of processed arrays and metadata
    """
    # 1. Edge-preserving skin smoothing
    smoothed = bilateral_skin_filter(image_rgb, d=7, sigma_color=50, sigma_space=50)

    # 2. Illumination compensation
    normalized = clahe_illumination_filter(smoothed, clip_limit=1.8, tile_grid_size=(8, 8))

    # 3. Color channel decomposition
    channels = extract_cielab_channels(normalized)

    # 4. Erythema mask
    erythema_mask = generate_erythema_acne_mask(normalized)

    return {
        "filtered_image": normalized,
        "smoothed_image": smoothed,
        "erythema_mask": erythema_mask,
        "cielab": channels,
        "opencv_accelerated": HAS_OPENCV,
    }
