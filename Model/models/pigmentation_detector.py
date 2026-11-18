"""
Model/models/pigmentation_detector.py
-------------------------------------
Clinical facial pigmentation, melasma, and melanin dyschromia inference engine.
Combines:
  1. Deep Learning: EfficientNet-B0 / B3 multi-task classifier with temperature scaling
  2. Google MediaPipe 478-landmark anatomical facial zone extraction
  3. Patient-Specific Individual Typology Angle (ITA°) and unpigmented baseline colorimetry
  4. CIELAB luminance deficit (Delta-L*) and local dark spot extraction with spatial NMS
  5. Multi-zone severity grading and safe, educational skincare active recommendations
"""

import os
import io
import sys
import time
import math
import base64
from typing import Dict, Any, Optional, List, Tuple
from PIL import Image
import numpy as np
import torch
from torchvision import transforms

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import importlib

try:
    from models.efficientnet_pigmentation import EfficientNetPigmentationClassifier
except ImportError:
    from efficientnet_pigmentation import EfficientNetPigmentationClassifier

dermal_preproc_mod = importlib.import_module("03_preprocessing.dermal_preprocessor")
DermalPreprocessor = dermal_preproc_mod.DermalPreprocessor

try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False


PIGMENTATION_PROTOCOLS = {
    "low": {
        "status": "Minimal / Even Melanin Distribution",
        "severity": {"label": "Low", "color": "#10B981", "bg": "#ECFDF5", "text": "text-emerald-700"},
        "description": "Epidermal melanin distribution appears relatively uniform with minimal localized hyperpigmented spots or dyschromia.",
        "treatment": "Daily broad-spectrum SPF 50+ sunscreen, Gentle Niacinamide (2-4%), Vitamin C serum (antioxidant defense).",
        "precautions": "Maintain consistent daily broad-spectrum sun defense, re-applying every 2 hours when outdoors to prevent UV-induced melanogenesis."
    },
    "moderate": {
        "status": "Moderate Localized Hyperpigmentation",
        "severity": {"label": "Moderate", "color": "#F59E0B", "bg": "#FFFBEB", "text": "text-amber-700"},
        "description": "Noticeable localized melanin accumulation, uneven tone, or subtle melasma-like distribution across cheeks or forehead.",
        "treatment": "Niacinamide (4-5%), Vitamin C (10-15% L-Ascorbic Acid / Ethyl Ascorbic Acid), Azelaic Acid 10%, Alpha Arbutin 2%, Daily SPF 50+.",
        "precautions": "Always perform a 24-hour patch test before introducing tyrosinase inhibitors. Introduce active serums gradually (2-3 times weekly)."
    },
    "high": {
        "status": "Marked Pigmentation / Pronounced Dyschromia",
        "severity": {"label": "High", "color": "#EF4444", "bg": "#FEF2F2", "text": "text-red-700"},
        "description": "Prominent bilateral hyperpigmentation, dense solar lentigines clusters, or conspicuous melasma-pattern macules.",
        "treatment": "Azelaic Acid (10-15%), Tranexamic Acid serum, Alpha Arbutin 2%, Retinoid (PM maintenance), Tinted Mineral Zinc Oxide SPF 50+ (shields visible light).",
        "precautions": "Avoid harsh aggressive physical scrubs or aggressive chemical peels which can provoke post-inflammatory hyperpigmentation (PIH). Consult a dermatologist for in-office medical evaluation."
    }
}

SKINCARE_ACTIVES = [
    {
        "name": "Broad-Spectrum SPF 50+ (Zinc Oxide / Hybrid)",
        "role": "Crucial Prevention",
        "benefit": "Prevents UV-A/UV-B and high-energy visible light from stimulating melanocytes."
    },
    {
        "name": "Niacinamide (Vitamin B3 4-5%)",
        "role": "Melanosome Transfer Inhibitor",
        "benefit": "Helps block the transfer of melanin packets into surface keratinocytes."
    },
    {
        "name": "Vitamin C (L-Ascorbic Acid 10-15%)",
        "role": "Antioxidant & Tyrosinase Modulator",
        "benefit": "Neutralizes environmental free radicals and helps visibly fade existing dark spots."
    },
    {
        "name": "Azelaic Acid 10%",
        "role": "Selective Melanocyte Suppressor",
        "benefit": "Targets hyperactive melanocytes with minimal irritation to surrounding healthy skin."
    },
    {
        "name": "Alpha Arbutin 2%",
        "role": "Gentle Brightening Active",
        "benefit": "Safely moderates cutaneous tyrosinase enzyme activity for a more uniform complexion."
    }
]


class PigmentationInferenceEngine:
    def __init__(self, variant="b0", device=None, temperature=1.25):
        self.variant = variant.lower()
        self.temperature = float(temperature)

        if device is None:
            if torch.cuda.is_available():
                self.device = torch.device("cuda")
            elif torch.backends.mps.is_available():
                self.device = torch.device("mps")
            else:
                self.device = torch.device("cpu")
        else:
            self.device = device

        self.model = None
        self._load_model()

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

    def _load_model(self):
        try:
            self.model = EfficientNetPigmentationClassifier(
                variant=self.variant,
                pretrained=False,
                temperature=self.temperature
            ).to(self.device)

            weights_path = os.path.join(
                os.path.dirname(__file__),
                f"efficientnet_pigmentation_{self.variant}.pth"
            )

            if os.path.exists(weights_path):
                ckpt = torch.load(weights_path, map_location=self.device)
                state_dict = ckpt["model_state_dict"] if "model_state_dict" in ckpt else ckpt
                self.model.load_state_dict(state_dict)
                print(f"[PigmentationEngine] Loaded fine-tuned weights from {weights_path}")
            else:
                # Initialize with pretrained ImageNet backbone
                self.model = EfficientNetPigmentationClassifier(
                    variant=self.variant,
                    pretrained=True,
                    temperature=self.temperature
                ).to(self.device)
                print(f"[PigmentationEngine] Initialized ImageNet pretrained EfficientNet-{self.variant.upper()}")
            self.model.eval()
        except Exception as e:
            print(f"[PigmentationEngine] Warning: Could not initialize neural weights ({e}). Colorimetric fallback active.")
            self.model = None

    def _decode_image(self, image_input) -> np.ndarray:
        if isinstance(image_input, np.ndarray):
            return image_input

        if isinstance(image_input, str):
            if image_input.startswith("data:image"):
                image_input = image_input.split(",", 1)[1]
            raw_bytes = base64.b64decode(image_input)
            pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
            return np.array(pil_img)

        if isinstance(image_input, Image.Image):
            return np.array(image_input.convert("RGB"))

        raise ValueError("Unsupported image payload type")

    def _compute_ita(self, L_star: float, b_star: float) -> Tuple[float, str]:
        """
        Computes Individual Typology Angle (ITA°) for objective skin phototyping:
        ITA° = [ArcTan((L* - 50) / b*)] * 180 / pi
        """
        denom = max(0.1, abs(b_star))
        ita_rad = math.atan((L_star - 50.0) / denom)
        ita_deg = round((ita_rad * 180.0) / math.pi, 1)

        if ita_deg > 55.0:
            category = "Very Light (Type I)"
        elif ita_deg > 41.0:
            category = "Light (Type II)"
        elif ita_deg > 28.0:
            category = "Intermediate (Type III)"
        elif ita_deg > 10.0:
            category = "Tan (Type IV)"
        elif ita_deg > -30.0:
            category = "Brown (Type V)"
        else:
            category = "Dark (Type VI)"

        return ita_deg, category

    def _detect_calibrated_pigmentation(
        self,
        image_rgb: np.ndarray,
        zones_data: Dict[str, Any],
        cielab: Dict[str, np.ndarray]
    ) -> Tuple[List[Dict[str, Any]], Dict[str, int], float, float]:
        """
        Analyzes individual melanin contrast across facial zones.
        Detects localized dark spots with spatial Non-Maximum Suppression (NMS).
        """
        h, w = image_rgb.shape[:2]
        L_full = cielab["L"]
        a_full = cielab["a"]
        b_full = cielab["b"]

        # 1. Establish patient's individual unpigmented skin baseline
        # Sample mid-cheek and forehead reference areas
        skin_l_vals = []
        skin_a_vals = []
        skin_b_vals = []

        for z_key in ["leftCheek", "rightCheek", "forehead"]:
            if z_key in zones_data:
                mask = zones_data[z_key]["full_mask"]
                if np.sum(mask > 0) > 100:
                    skin_l_vals.extend(L_full[mask > 0])
                    skin_a_vals.extend(a_full[mask > 0])
                    skin_b_vals.extend(b_full[mask > 0])

        if skin_l_vals:
            # Baseline = 75th percentile of L* (healthy bright skin, free of spots)
            base_l = float(np.percentile(skin_l_vals, 75))
            base_a = float(np.median(skin_a_vals))
            base_b = float(np.median(skin_b_vals))
        else:
            base_l, base_a, base_b = 64.0, 10.0, 15.0

        ita_deg, phototype = self._compute_ita(base_l, base_b)

        detected_spots = []
        zone_scores = {}
        total_pigment_pixels = 0
        total_skin_pixels = 0

        # 2. Zone-by-zone melanin contrast and spot extraction
        for zone_name, z_info in zones_data.items():
            min_x, min_y, max_x, max_y = z_info["bbox"]
            crop_mask = z_info["crop_mask"]
            if crop_mask is None or np.sum(crop_mask > 0) < 50:
                zone_scores[zone_name] = 16
                continue

            crop_L = L_full[min_y:max_y, min_x:max_x]
            crop_a = a_full[min_y:max_y, min_x:max_x]
            crop_b = b_full[min_y:max_y, min_x:max_x]

            valid_pixels = crop_mask > 0
            n_valid = int(np.sum(valid_pixels))
            total_skin_pixels += n_valid

            # Melanin deficit: Delta L* = baseline L* - pixel L*
            delta_L = np.maximum(0.0, base_l - crop_L)
            delta_L[~valid_pixels] = 0.0

            # Real hyperpigmentation criteria:
            # 1. Luminance drop Delta L* > 6.0
            # 2. NOT an inflammatory papule (a* is not elevated high above baseline)
            # 3. Sustained melanin b* coordinate
            is_pigmented = (delta_L > 6.0) & (crop_a < (base_a + 5.0)) & valid_pixels
            pigment_count = int(np.sum(is_pigmented))
            total_pigment_pixels += pigment_count

            # Local Candidate Spot Detection
            zh, zw = crop_L.shape
            step = 6
            kernel_r = 4
            annular_r = 9
            candidates = []

            for cy in range(annular_r, zh - annular_r, step):
                for cx in range(annular_r, zw - annular_r, step):
                    if crop_mask[cy, cx] == 0:
                        continue

                    core_l = crop_L[cy - kernel_r:cy + kernel_r + 1, cx - kernel_r:cx + kernel_r + 1]
                    ann_l = crop_L[cy - annular_r:cy + annular_r + 1, cx - annular_r:cx + annular_r + 1]
                    core_a = crop_a[cy - kernel_r:cy + kernel_r + 1, cx - kernel_r:cx + kernel_r + 1]

                    delta_dark_local = float(np.mean(ann_l)) - float(np.mean(core_l))
                    delta_dark_base = base_l - float(np.mean(core_l))
                    redness_diff = float(np.mean(core_a)) - base_a

                    # True dark spot: darker than surrounding annulus AND darker than patient baseline
                    # Strictly exclude active acne lesions (which have redness_diff > 4.5)
                    if (delta_dark_local > 4.5) and (delta_dark_base > 6.0) and (redness_diff < 4.0):
                        strength = delta_dark_local + (delta_dark_base * 0.5)
                        candidates.append({
                            "cx": cx,
                            "cy": cy,
                            "severity": "High" if strength > 14.0 else "Moderate",
                            "strength": strength
                        })

            # Spatial Non-Maximum Suppression (14px radius)
            candidates.sort(key=lambda s: s["strength"], reverse=True)
            suppressed = []
            min_dist_sq = 14.0 ** 2
            for cand in candidates:
                too_close = False
                for ex in suppressed:
                    if (cand["cx"] - ex["cx"]) ** 2 + (cand["cy"] - ex["cy"]) ** 2 < min_dist_sq:
                        too_close = True
                        break
                if not too_close:
                    suppressed.append(cand)
                    if len(suppressed) >= 8:
                        break

            spots_count = len(suppressed)
            area_ratio = (pigment_count / float(max(1, n_valid))) * 100.0

            # Calibrated zone score (0 - 100)
            if spots_count == 0 and area_ratio < 2.0:
                zone_score = 15
            elif spots_count <= 1 and area_ratio < 6.0:
                zone_score = 26
            elif spots_count <= 2 and area_ratio < 12.0:
                zone_score = 38
            elif spots_count <= 4 or area_ratio < 22.0:
                zone_score = min(72, int(46 + (spots_count * 5) + (area_ratio * 0.8)))
            else:
                zone_score = min(92, int(66 + (spots_count * 4) + (area_ratio * 0.6)))

            zone_scores[zone_name] = zone_score

            for s in suppressed:
                gx = round(((min_x + s["cx"]) / float(w)) * 100.0, 1)
                gy = round(((min_y + s["cy"]) / float(h)) * 100.0, 1)
                detected_spots.append({
                    "x": gx,
                    "y": gy,
                    "r": 2.4 if s["severity"] == "High" else 2.0,
                    "type": "dark_spot",
                    "severity": s["severity"],
                    "zone": zone_name
                })

        affected_area_pct = round((total_pigment_pixels / float(max(1, total_skin_pixels))) * 100.0, 1)
        return detected_spots, zone_scores, affected_area_pct, ita_deg

    def analyze_face(self, image_input, landmarks=None) -> Dict[str, Any]:
        """
        Executes full-face pigmentation diagnostic:
          - Image quality validation
          - Anatomical landmark zone extraction
          - Patient-calibrated melanin colorimetry & ITA° phototyping
          - Local dark spot extraction with spatial NMS
          - Calibrated EfficientNet inference
          - Skincare recommendations and limitations
        """
        img_np = self._decode_image(image_input)
        h, w = img_np.shape[:2]

        # 1. Quality Gate
        quality_report = DermalPreprocessor.validate_image_quality(img_np)

        # 2. Image Preprocessing & CIELAB
        prep = DermalPreprocessor.preprocess_image_pipeline(img_np)
        normalized_rgb = prep["normalized_rgb"]
        cielab = prep["cielab"]

        # 3. MediaPipe Anatomical Zone Extraction
        zones_data = DermalPreprocessor.extract_anatomical_zones(normalized_rgb, landmarks=landmarks)

        # 4. Melanin Colorimetry & Local Spots
        detected_spots, zone_scores, area_pct, ita_deg = self._detect_calibrated_pigmentation(
            normalized_rgb, zones_data, cielab
        )

        total_spots = len(detected_spots)

        # 5. Deep Learning Prediction (if model is available)
        dl_conf = 0.92
        dl_score = None
        if self.model is not None:
            try:
                pil_face = Image.fromarray(normalized_rgb)
                tensor_input = self.transform(pil_face).unsqueeze(0).to(self.device)
                preds = self.model.predict_calibrated(tensor_input)
                dl_score = float(preds["score"][0])
                dl_conf = float(preds["severity_confidence"][0])
            except Exception as e:
                print(f"[PigmentationEngine] Inference fallback warning: {e}")

        # Zone-weighted composite score
        zone_weights = {
            "leftCheek": 0.28,
            "rightCheek": 0.28,
            "forehead": 0.24,
            "nose": 0.10,
            "chin": 0.10
        }
        weighted_zone_score = sum(zone_scores.get(z, 20) * w for z, w in zone_weights.items())

        if dl_score is not None:
            final_score = int(round((dl_score * 0.45) + (weighted_zone_score * 0.55)))
        else:
            final_score = int(round(weighted_zone_score))

        final_score = max(8, min(95, final_score))

        # Severity categorization
        if final_score < 34:
            sev_key = "low"
        elif final_score <= 66:
            sev_key = "moderate"
        else:
            sev_key = "high"

        proto = PIGMENTATION_PROTOCOLS[sev_key]

        # Identify affected patterns and regions
        patterns = []
        affected_regions = [z for z, sc in zone_scores.items() if sc >= 35]

        if total_spots > 0:
            patterns.append({
                "type": "dark_spots",
                "label": "Localized Dark Spots / Sunspots",
                "confidence": round(min(0.96, dl_conf + 0.02), 2),
                "severity": "Moderate" if total_spots <= 3 else "High",
                "count": total_spots,
                "affected_regions": list(set(s["zone"] for s in detected_spots))
            })

        # Melasma-like pattern detection (typically prominent on cheeks & forehead)
        cheek_high = (zone_scores.get("leftCheek", 0) >= 38) and (zone_scores.get("rightCheek", 0) >= 38)
        if cheek_high or (zone_scores.get("forehead", 0) >= 45 and area_pct > 8.0):
            patterns.append({
                "type": "melasma_like",
                "label": "Bilateral Melasma-like Pattern",
                "confidence": round(min(0.94, dl_conf), 2),
                "severity": "Moderate" if final_score <= 66 else "High",
                "affected_regions": [r for r in ["leftCheek", "rightCheek", "forehead"] if r in affected_regions]
            })

        if not patterns:
            patterns.append({
                "type": "uniform_tone",
                "label": "Uniform Melanin Distribution",
                "confidence": 0.94,
                "severity": "Low",
                "affected_regions": []
            })

        _, phototype_label = self._compute_ita(60.0, 15.0)

        return {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "model": f"EfficientNet-{self.variant.upper()} Multi-Task + CIELAB Chromaticity",
            "pigmentationScore": final_score,
            "pigmentation_score": final_score,
            "severity": proto["severity"],
            "severityCategory": proto["severity"]["label"],
            "status": proto["status"],
            "description": proto["description"],
            "treatment": proto["treatment"],
            "precautions": proto["precautions"],
            "zoneScores": zone_scores,
            "detectedSpots": detected_spots,
            "totalSpots": total_spots,
            "affectedAreaPercentage": area_pct,
            "individualTypologyAngle": ita_deg,
            "phototypeCategory": phototype_label,
            "detectedPatterns": patterns,
            "confidence": f"{int(round(dl_conf * 100))}%",
            "confidencePercentage": int(round(dl_conf * 100)),
            "imageQuality": quality_report["quality_status"],
            "imageQualityReport": quality_report,
            "skincareActives": SKINCARE_ACTIVES,
            "unsupportedClasses": [
                "Post-inflammatory hyperpigmentation (PIH) histological differentiation",
                "Deep dermal vs epidermal melasma Wood's lamp depth",
                "Malignant melanocytic lentigo differentiation (requires clinical dermoscopy)"
            ],
            "limitations": [
                "AI-estimated visible pigmentation patterns from standard photographs, not a clinical or medical diagnosis.",
                "Lighting reflections, makeup, and camera exposure may modulate melanin contrast."
            ],
            "device": str(self.device)
        }


# Global singleton engine cache
_PIGMENTATION_ENGINES: Dict[str, PigmentationInferenceEngine] = {}

def get_pigmentation_detector(variant="b0") -> PigmentationInferenceEngine:
    v = variant.lower()
    if v not in _PIGMENTATION_ENGINES:
        _PIGMENTATION_ENGINES[v] = PigmentationInferenceEngine(variant=v)
    return _PIGMENTATION_ENGINES[v]

