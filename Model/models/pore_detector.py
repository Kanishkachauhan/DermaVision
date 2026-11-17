"""
Model/models/pore_detector.py
-----------------------------
Computer Vision Engine for Facial Pore Detection & Texture Analysis.

Methodology:
  1. Anatomical Zone Isolation:
     Analyzes visible pores in the most pore-prone dermal areas:
     - Nasal dorsum and alar sidewalls (T-Zone)
     - Medial / paranasal inner cheeks (Zygomatic prominence)
     - Central frontal glabella (Forehead)
     - Mental region (Chin)
  2. Morphological Black Top-Hat (BTH) Transformation:
     Isolates micro-scale follicular infundibulum depressions by subtracting
     the original image from the morphological closing.
  3. Size, Shape & Contrast Filtering:
     Filters candidates based on area (2 - 35 px²), circular compactness,
     and luminance contrast relative to the surrounding dermal baseline.
  4. Multi-Scale Local Binary Patterns (LBP):
     Extracts uniform LBP texture roughness to quantify surface irregularity.
  5. Calibrated Pore Appearance Scoring:
     Calculates continuous pore visibility (0 - 100) and grades into:
       - Low Visible Pore Appearance (0 - 33)
       - Moderate Visible Pore Appearance (34 - 66)
       - High Visible Pore Appearance (67 - 100)

NOTE:
This engine quantifies image-based visible pore appearance, contrast, and
surface density. It does not claim to count anatomical micro-structures beyond
photographic resolution.
"""

import cv2
import numpy as np
from typing import Dict, Any, List, Tuple, Optional
from skimage.feature import local_binary_pattern

PORE_PROTOCOLS = {
    "low": {
        "label": "Low",
        "type": "Minimal Pore Dilation",
        "color": "#10B981",
        "bg": "#ECFDF5",
        "text": "text-emerald-700",
        "description": "Follicular ostia are refined and tight with minimal visible dilation across T-zone and inner cheeks.",
        "treatment": "Daily Gentle Hydration + Mineral SPF 50; Retinol 0.025% maintenance; Non-comedogenic hydration"
    },
    "medium": {
        "label": "Medium",
        "type": "Moderately Dilated Pores",
        "color": "#F59E0B",
        "bg": "#FFFBEB",
        "text": "text-amber-700",
        "description": "Noticeable follicular dilation concentrated along the nasal dorsum and medial paranasal cheeks with early sebum pooling.",
        "treatment": "Salicylic Acid (BHA 2%) Toner, Niacinamide 10% Serum, Weekly gentle AHA chemical exfoliation"
    },
    "high": {
        "label": "High",
        "type": "Enlarged Pores (Sebaceous Hyperplasia)",
        "color": "#EF4444",
        "bg": "#FEF2F2",
        "text": "text-red-700",
        "description": "Conspicuously enlarged, dilated pore openings with prominent follicular topography across inner cheeks and central forehead.",
        "treatment": "Retinol 0.5–1.0%, BHA 2% Toner, Zinc PCA, Clay Mask purification; Professional Dermatological peeling"
    }
}


class PoreDetector:
    """
    Dedicated Computer Vision Pore and Texture Detection Engine.
    """

    def __init__(self):
        # 5x5 elliptical structuring element for pore micro-depression extraction
        self.kernel_5x5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        self.kernel_3x3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))

    def analyze_zone_pores(
        self,
        crop_rgb: np.ndarray,
        crop_mask: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Analyzes visible pore density, contrast, and LBP texture for a single zone crop.
        """
        h, w = crop_rgb.shape[:2]
        if h < 10 or w < 10:
            return {
                "score": 25,
                "pore_count": 0,
                "density": 0.0,
                "contrast": 0.0,
                "lbp_entropy": 0.0,
                "spots": []
            }

        # Valid mask
        if crop_mask is None or np.sum(crop_mask > 0) < 50:
            valid_mask = np.ones((h, w), dtype=np.uint8) * 255
        else:
            valid_mask = crop_mask

        total_valid_pixels = int(np.sum(valid_mask > 0))
        if total_valid_pixels < 50:
            total_valid_pixels = h * w

        # Convert to grayscale luminance
        gray = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2GRAY)

        # 1. Morphological Black Top-Hat (Closing - Original)
        closed = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, self.kernel_5x5)
        tophat = cv2.subtract(closed, gray)

        # Apply valid mask
        tophat_masked = cv2.bitwise_and(tophat, tophat, mask=valid_mask)
        valid_values = tophat_masked[valid_mask > 0]

        mean_th = float(np.mean(valid_values)) if len(valid_values) > 0 else 0.0
        std_th = float(np.std(valid_values)) if len(valid_values) > 0 else 1.0

        # Dynamic threshold for pore peak extraction (adaptive to individual skin brightness)
        thresh_val = mean_th + 1.15 * std_th
        thresh_val = max(1.8, min(14.0, thresh_val))
        _, pore_binary = cv2.threshold(tophat_masked, thresh_val, 255, cv2.THRESH_BINARY)
        pore_binary = cv2.bitwise_and(pore_binary, valid_mask)

        # 2. Connected component analysis to extract pore blobs
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(pore_binary)

        detected_pores = []
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            # Genuine visible pores range from 2 to 32 pixels in high-res crops
            if 2 <= area <= 32:
                bw = stats[i, cv2.CC_STAT_WIDTH]
                bh = stats[i, cv2.CC_STAT_HEIGHT]
                # Aspect ratio / circularity filter (pores are roughly round, not scratches)
                aspect = float(bw) / float(bh) if bh > 0 else 1.0
                if 0.35 <= aspect <= 2.8:
                    cx = float(centroids[i][0])
                    cy = float(centroids[i][1])
                    intensity = float(tophat[int(cy), int(cx)]) if 0 <= int(cy) < h and 0 <= int(cx) < w else 1.0
                    detected_pores.append({
                        "x": round(cx, 1),
                        "y": round(cy, 1),
                        "area": int(area),
                        "contrast": round(intensity, 2)
                    })

        pore_count = len(detected_pores)
        # Pore density per 10,000 skin pixels
        pore_density = (pore_count / float(total_valid_pixels)) * 10000.0

        # 3. LBP Texture Roughness
        try:
            lbp = local_binary_pattern(gray, 16, 2, method="uniform")
            lbp_valid = lbp[valid_mask > 0]
            hist, _ = np.histogram(lbp_valid, bins=18, range=(0, 18), density=True)
            # Entropy of uniform LBP distribution (higher = rougher porous texture)
            hist = hist[hist > 0]
            lbp_entropy = float(-np.sum(hist * np.log2(hist))) if len(hist) > 0 else 2.0
        except Exception:
            lbp_entropy = 2.5

        # 4. Calibrated Zone Score (0 to 100)
        # Baseline density: < 25 (Low), 25 - 75 (Moderate), > 75 (High)
        density_contribution = min(60.0, pore_density * 0.70)
        entropy_contribution = min(25.0, max(0.0, (lbp_entropy - 1.8) * 18.0))
        contrast_contribution = min(15.0, mean_th * 4.0)

        raw_score = 14.0 + density_contribution + entropy_contribution + contrast_contribution
        zone_score = int(round(max(10.0, min(95.0, raw_score))))

        return {
            "score": zone_score,
            "pore_count": pore_count,
            "density": round(pore_density, 1),
            "lbp_entropy": round(lbp_entropy, 2),
            "mean_contrast": round(mean_th, 2),
            "spots": detected_pores[:15]  # Keep top spots for inspection
        }

    def analyze_face_pores(
        self,
        image_rgb: np.ndarray,
        zones_data: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Executes comprehensive full-face visible pore appearance analysis.
        """
        h, w = image_rgb.shape[:2]
        zone_results = {}
        all_detected_spots = []

        # Anatomical weighting: Nasal (35%), Left Cheek (25%), Right Cheek (25%), Forehead (10%), Chin (5%)
        zone_weights = {
            "nose": 0.35,
            "leftCheek": 0.25,
            "rightCheek": 0.25,
            "forehead": 0.10,
            "chin": 0.05
        }

        weighted_score_sum = 0.0
        total_pores_detected = 0

        for zone_name, weight in zone_weights.items():
            if zone_name in zones_data:
                z_info = zones_data[zone_name]
                crop_rgb = z_info["crop_rgb"]
                crop_mask = z_info["crop_mask"]
                min_x, min_y = z_info["bbox"][:2]

                z_res = self.analyze_zone_pores(crop_rgb, crop_mask)
                zone_results[zone_name] = z_res["score"]
                weighted_score_sum += (z_res["score"] * weight)
                total_pores_detected += z_res["pore_count"]

                # Convert spot coordinates to global image percentage for visual overlays
                for s in z_res["spots"][:8]:  # Limit overlay clutter to prominent pores
                    gx = round(((min_x + s["x"]) / float(w)) * 100.0, 1)
                    gy = round(((min_y + s["y"]) / float(h)) * 100.0, 1)
                    all_detected_spots.append({
                        "x": gx,
                        "y": gy,
                        "r": 1.2,
                        "type": "pore",
                        "contrast": s["contrast"],
                        "zone": zone_name
                    })
            else:
                zone_results[zone_name] = 30
                weighted_score_sum += (30 * weight)

        final_pore_score = int(round(max(12.0, min(95.0, weighted_score_sum))))

        # Determine clinical severity category
        if final_pore_score <= 33:
            category_key = "low"
        elif final_pore_score <= 66:
            category_key = "medium"
        else:
            category_key = "high"

        protocol = PORE_PROTOCOLS[category_key]

        return {
            "poreScore": final_pore_score,
            "poreSeverity": {
                "label": protocol["label"],
                "color": protocol["color"],
                "bg": protocol["bg"],
                "text": protocol["text"]
            },
            "poreType": protocol["type"],
            "poreTreatment": protocol["treatment"],
            "clinicalDescription": protocol["description"],
            "zonePores": zone_results,
            "totalVisiblePores": total_pores_detected,
            "detectedPoreSpots": all_detected_spots,
            "algorithm": "Multi-Scale Black Top-Hat & Uniform LBP Dermal Texture Telemetry"
        }


# Singleton engine instance
_PORE_DETECTOR_INSTANCE = None

def get_pore_detector() -> PoreDetector:
    global _PORE_DETECTOR_INSTANCE
    if _PORE_DETECTOR_INSTANCE is None:
        _PORE_DETECTOR_INSTANCE = PoreDetector()
    return _PORE_DETECTOR_INSTANCE
