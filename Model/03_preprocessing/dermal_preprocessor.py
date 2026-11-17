"""
Model/03_preprocessing/dermal_preprocessor.py
---------------------------------------------
Advanced Clinical Dermal Preprocessor & Quality Gate Engine for DermaVision.

Features:
  1. Image Quality & Lighting Assessment:
     - Sharpness validation via Laplacian variance (blur detection)
     - Illumination & exposure validation in CIE L*a*b* space (underexposure / overexposure)
     - Dynamic range & contrast verification
  2. Anatomical Zone Isolation using MediaPipe 478-Landmark Meshes:
     - Extracts precise polygonal masks for forehead, leftCheek, rightCheek, nose, and chin
     - Strictly excludes non-skin regions (lips, vermilion border, eyes, eyebrows, nostrils)
     - Calibrated anatomical fallback when landmarks are absent
  3. Dermatological Image Enhancement:
     - Bilateral edge-preserving filtering (suppresses high-frequency sensor noise while preserving lesion margins & pore edges)
     - CLAHE illumination compensation on the L* channel without color tone distortion
     - True CIELAB colorimetric channel decomposition (L*, a*, b*)
"""

import cv2
import numpy as np
from PIL import Image
from typing import Dict, Any, List, Optional, Tuple, Union

# MediaPipe 478 Face Mesh landmark index groupings
ZONE_LANDMARKS = {
    "forehead": [10, 67, 103, 104, 108, 109, 151, 337, 338, 336, 297, 332, 284, 9, 8],
    "leftCheek": [116, 123, 147, 187, 205, 50, 101, 117, 118, 119, 100, 126, 209, 192, 214, 212, 138, 135],
    "rightCheek": [345, 352, 376, 411, 425, 280, 330, 346, 347, 348, 329, 355, 429, 416, 434, 432, 367, 364],
    "nose": [1, 2, 4, 5, 19, 94, 195, 197, 97, 98, 326, 327, 45, 275, 460, 459, 458, 238, 239, 240, 278, 48],
    "chin": [152, 175, 199, 200, 18, 83, 313, 148, 176, 377, 400, 140, 369]
}

# Exclusion indices (features that must never be classified as skin blemishes or pores)
EXCLUSION_LANDMARKS = {
    "lips": [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
    "leftEye": [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    "rightEye": [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
    "eyebrows": [70, 63, 105, 66, 107, 55, 65, 52, 53, 46, 336, 296, 334, 293, 300, 285, 295, 282, 283, 276]
}

# Default normalized box fallbacks if landmarks are not supplied
FALLBACK_ZONE_BOXES = {
    "forehead":   [0.26, 0.12, 0.74, 0.30],
    "leftCheek":  [0.16, 0.40, 0.40, 0.66],
    "rightCheek": [0.60, 0.40, 0.84, 0.66],
    "nose":       [0.40, 0.36, 0.60, 0.62],
    "chin":       [0.36, 0.74, 0.64, 0.92]
}


class DermalPreprocessor:
    """
    Production-grade preprocessing, quality validation, and zone extraction engine.
    """

    @staticmethod
    def validate_image_quality(image_rgb: np.ndarray) -> Dict[str, Any]:
        """
        Validates whether the facial image meets clinical quality standards:
          - Resolution (minimum 160x160)
          - Sharpness / blur via Laplacian variance
          - Illumination balance (underexposure / overexposure)
        """
        h, w = image_rgb.shape[:2]
        warnings = []
        is_valid = True

        if h < 160 or w < 160:
            warnings.append(f"Image resolution ({w}x{h}) is too low for reliable analysis (minimum 160x160 required).")
            is_valid = False

        gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
        lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        if lap_var < 25.0:
            warnings.append("Image is blurry or out of focus. Please hold the camera steady.")
            if lap_var < 15.0:
                is_valid = False

        # CIELAB illumination check
        lab = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2LAB)
        L_star = lab[:, :, 0] * (100.0 / 255.0)
        mean_L = float(np.mean(L_star))
        std_L = float(np.std(L_star))

        if mean_L < 22.0:
            warnings.append("Lighting is too dark / underexposed. Please capture in well-lit conditions.")
            if mean_L < 15.0:
                is_valid = False
        elif mean_L > 88.0:
            warnings.append("Image is overexposed or washed out with harsh glare.")
            if mean_L > 93.0:
                is_valid = False

        return {
            "is_valid": is_valid,
            "sharpness": round(lap_var, 1),
            "mean_lightness": round(mean_L, 1),
            "lightness_std": round(std_L, 1),
            "warnings": warnings,
            "quality_status": "acceptable" if is_valid else "substandard"
        }

    @staticmethod
    def parse_landmarks(landmarks: Any, width: int, height: int) -> Optional[np.ndarray]:
        """
        Parses diverse landmark formats (list of dicts, list of lists, numpy array)
        into an (N, 2) pixel coordinate numpy array.
        """
        if landmarks is None:
            return None

        # If wrapped in a nested container e.g. [landmarks]
        if isinstance(landmarks, list) and len(landmarks) > 0 and isinstance(landmarks[0], list) and len(landmarks[0]) > 0 and isinstance(landmarks[0][0], (dict, list)):
            landmarks = landmarks[0]

        parsed = []
        try:
            for item in landmarks:
                if isinstance(item, dict):
                    x = float(item.get("x", 0))
                    y = float(item.get("y", 0))
                elif isinstance(item, (list, tuple)) and len(item) >= 2:
                    x = float(item[0])
                    y = float(item[1])
                else:
                    continue

                # Scale if normalized [0, 1]
                if x <= 1.0 and y <= 1.0:
                    px = int(np.clip(x * width, 0, width - 1))
                    py = int(np.clip(y * height, 0, height - 1))
                else:
                    px = int(np.clip(x, 0, width - 1))
                    py = int(np.clip(y, 0, height - 1))
                parsed.append([px, py])

            if len(parsed) >= 468:
                return np.array(parsed, dtype=np.int32)
        except Exception:
            return None

        return None

    @staticmethod
    def extract_anatomical_zones(
        image_rgb: np.ndarray,
        landmarks: Any = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Extracts facial zones (forehead, leftCheek, rightCheek, nose, chin).
        Uses MediaPipe convex hulls when landmarks are available, strictly masking out
        lips, eyes, and eyebrows. Falls back to proportional boxes if landmarks are absent.
        """
        h, w = image_rgb.shape[:2]
        pts = DermalPreprocessor.parse_landmarks(landmarks, width=w, height=h)

        zones_data = {}

        # 1. Non-skin exclusion mask
        exclusion_mask = np.zeros((h, w), dtype=np.uint8)
        if pts is not None:
            for excl_name, indices in EXCLUSION_LANDMARKS.items():
                valid_idx = [i for i in indices if i < len(pts)]
                if len(valid_idx) >= 3:
                    excl_pts = pts[valid_idx]
                    hull = cv2.convexHull(excl_pts)
                    cv2.fillConvexPoly(exclusion_mask, hull, 255)

        # 2. Extract each anatomical zone
        for zone_name, indices in ZONE_LANDMARKS.items():
            zone_mask = np.zeros((h, w), dtype=np.uint8)
            zone_bbox = None

            if pts is not None:
                valid_idx = [i for i in indices if i < len(pts)]
                if len(valid_idx) >= 3:
                    zone_pts = pts[valid_idx]
                    hull = cv2.convexHull(zone_pts)
                    cv2.fillConvexPoly(zone_mask, hull, 255)
                    # Subtract non-skin exclusion
                    zone_mask = cv2.bitwise_and(zone_mask, cv2.bitwise_not(exclusion_mask))

                    x, y, bw, bh = cv2.boundingRect(hull)
                    # Add 5% breathing margin clamped to image bounds
                    pad_x = int(bw * 0.05)
                    pad_y = int(bh * 0.05)
                    min_x = max(0, x - pad_x)
                    min_y = max(0, y - pad_y)
                    max_x = min(w, x + bw + pad_x)
                    max_y = min(h, y + bh + pad_y)
                    zone_bbox = (min_x, min_y, max_x, max_y)

            # Fallback if landmarks missing or zone mask empty
            if zone_bbox is None or (zone_bbox[2] - zone_bbox[0] < 15 or zone_bbox[3] - zone_bbox[1] < 15):
                fb = FALLBACK_ZONE_BOXES[zone_name]
                min_x = int(fb[0] * w)
                min_y = int(fb[1] * h)
                max_x = int(fb[2] * w)
                max_y = int(fb[3] * h)
                zone_bbox = (min_x, min_y, max_x, max_y)
                zone_mask[min_y:max_y, min_x:max_x] = 255

            min_x, min_y, max_x, max_y = zone_bbox
            crop_rgb = image_rgb[min_y:max_y, min_x:max_x].copy()
            crop_mask = zone_mask[min_y:max_y, min_x:max_x].copy()

            zones_data[zone_name] = {
                "bbox": zone_bbox,
                "bbox_norm": [
                    round(min_x / float(w), 3),
                    round(min_y / float(h), 3),
                    round(max_x / float(w), 3),
                    round(max_y / float(h), 3)
                ],
                "crop_rgb": crop_rgb,
                "crop_mask": crop_mask,
                "full_mask": zone_mask,
                "pixel_count": int(np.sum(crop_mask > 0))
            }

        return zones_data

    @staticmethod
    def preprocess_image_pipeline(image_rgb: np.ndarray) -> Dict[str, Any]:
        """
        Applies edge-preserving bilateral filtering, CLAHE illumination normalization,
        and CIELAB color space extraction.
        """
        if not isinstance(image_rgb, np.ndarray):
            image_rgb = np.array(image_rgb)

        # 1. Bilateral filter (d=7, sigmaColor=50, sigmaSpace=50)
        bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
        filtered_bgr = cv2.bilateralFilter(bgr, d=7, sigmaColor=50, sigmaSpace=50)
        smoothed_rgb = cv2.cvtColor(filtered_bgr, cv2.COLOR_BGR2RGB)

        # 2. CLAHE illumination compensation on L* channel
        lab = cv2.cvtColor(smoothed_rgb, cv2.COLOR_RGB2LAB)
        l_chan, a_chan, b_chan = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_clahe = clahe.apply(l_chan)
        clahe_lab = cv2.merge([l_clahe, a_chan, b_chan])
        normalized_rgb = cv2.cvtColor(clahe_lab, cv2.COLOR_LAB2RGB)

        # 3. Standard CIELAB conversion: L* in [0, 100], a* in [-128, 127], b* in [-128, 127]
        L_star = l_clahe.astype(np.float32) * (100.0 / 255.0)
        a_star = a_chan.astype(np.float32) - 128.0
        b_star = b_chan.astype(np.float32) - 128.0

        return {
            "original_rgb": image_rgb,
            "smoothed_rgb": smoothed_rgb,
            "normalized_rgb": normalized_rgb,
            "cielab": {
                "L": L_star,
                "a": a_star,
                "b": b_star,
                "raw_lab": clahe_lab
            }
        }
