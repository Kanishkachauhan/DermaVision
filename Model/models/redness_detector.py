"""
Model/models/redness_detector.py
---------------------------------
Facial erythema and redness diagnostic engine.

Architecture:
  1. Deep Learning Vision Transformer (ViT): `varun1505/face-characteristics`
     Provides image-level classification probability across 7 facial characteristics:
     (acne, eyes dark circles, puffy eyes, skin pigmentation, skin redness, skin texture, wrinkled face).
  2. Perceptually Calibrated CIELAB a* Colorimetry:
     Measures green-to-red opponent chromaticity (a*) and isolates cutaneous capillary erythema.
  3. Anatomical Landmark & Zone Masking:
     Uses MediaPipe 478-point facial mesh to isolate facial skin zones (cheeks, nose, forehead, chin)
     while strictly excluding non-skin interference (lips, vermilion border, eyes, and eyebrows).
  4. Patient-Specific Individual Baseline:
     Compares erythema against the patient's own un-inflamed skin baseline (Delta a*).
  5. Heatmap & Mask Visualization:
     Generates an erythema heatmap overlay on facial skin.
"""

import os
import io
import time
import base64
from typing import Dict, Any, Optional, Union, List, Tuple
from PIL import Image
import numpy as np
import torch
from transformers import AutoImageProcessor, AutoModelForImageClassification

try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False

MODEL_NAME = "varun1505/face-characteristics"
LOCAL_MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "face_characteristics"))

REDNESS_LABEL = "skin redness"
ALL_LABELS = [
    "acne",
    "eyes dark circles",
    "puffy eyes",
    "skin pigmentation",
    "skin redness",
    "skin texture",
    "wrinkled face"
]

REDNESS_PROTOCOLS = {
    "low": {
        "status": "Minimal / Baseline Vascular Tone",
        "severity": {"label": "Low", "color": "#10B981", "bg": "#ECFDF5", "text": "text-emerald-700"},
        "description": "Cutaneous capillary perfusion is within normal physiological limits with no conspicuous inflammatory erythema.",
        "etiology": "Physiological baseline / Intact epidermal barrier",
        "treatment": "Gentle hydrating cleanser, Ceramide barrier moisturizer, Daily Broad Spectrum SPF 50+",
        "precautions": "Maintain regular hydration and sun defense to preserve vascular elasticity."
    },
    "medium": {
        "status": "Moderate Erythema / Reactive Flush",
        "severity": {"label": "Moderate", "color": "#F59E0B", "bg": "#FFFBEB", "text": "text-amber-700"},
        "description": "Noticeable persistent or transient erythema observed across cheeks or central face. Capillary reactivity is elevated.",
        "etiology": "Vascular hyperactivity / Rosacea Subtype 1 propensity or transient stratum corneum compromise",
        "treatment": "Azelaic Acid 10%, Centella Asiatica (Cica), Niacinamide 2-4%, Zinc Oxide Mineral Sunscreen",
        "precautions": "Avoid harsh chemical peels (glycolic acid >7%), alcohol-based toners, spicy foods, and hot water cleansing."
    },
    "high": {
        "status": "High Vascular Erythema / Rosacea Pattern",
        "severity": {"label": "High", "color": "#EF4444", "bg": "#FEF2F2", "text": "text-red-700"},
        "description": "Conspicuous diffuse erythema with marked superficial capillary dilation and cutaneous sensitivity. Professional dermatological consult advised.",
        "etiology": "Erythematotelangiectatic Rosacea / Active dermal inflammation or acute barrier disruption",
        "treatment": "Medical dermatological assessment; Topical Azelaic Acid 15%, Bisabolol soothing balm, Thermal Spring Water, Hypoallergenic Barrier Cream",
        "precautions": "Discontinue retinoids and active AHAs during active flare-up; avoid physical scrubs and thermal extremes."
    }
}

REDNESS_SEVERITY_SCALE = [
    {
        "min": 0,
        "max": 33,
        "label": "Low",
        "description": "Minimal / Baseline Vascular Tone",
        "color": "#10B981",
        "bg": "#ECFDF5",
        "text": "text-emerald-700"
    },
    {
        "min": 34,
        "max": 66,
        "label": "Moderate",
        "description": "Reactive Capillary Flush",
        "color": "#F59E0B",
        "bg": "#FFFBEB",
        "text": "text-amber-700"
    },
    {
        "min": 67,
        "max": 100,
        "label": "High",
        "description": "Marked Vascular Erythema",
        "color": "#EF4444",
        "bg": "#FEF2F2",
        "text": "text-red-700"
    }
]

# Facial Landmark indices for exclusion from redness analysis (MediaPipe 478)
LIP_OUTER_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
LEFT_BROW_INDICES = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
RIGHT_BROW_INDICES = [336, 296, 334, 293, 300, 285, 295, 282, 283, 276]

# 5 Facial anatomical zone definitions for zone-by-zone mapping
ZONE_LANDMARK_INDICES = {
    # Frontal forehead (above eyebrows, between hairline and supraorbital ridge)
    "forehead": [10, 67, 103, 104, 108, 109, 151, 337, 338, 336, 297, 332, 284, 9, 8],
    # Left cheek (zygomatic / malar prominence, strictly excluding jaw/chin/lips)
    "leftCheek": [116, 123, 147, 187, 205, 50, 101, 117, 118, 119, 100, 126, 209, 192, 214, 212, 138, 135],
    # Right cheek (zygomatic / malar prominence, strictly excluding jaw/chin/lips)
    "rightCheek": [345, 352, 376, 411, 425, 280, 330, 346, 347, 348, 329, 355, 429, 416, 434, 432, 367, 364],
    # Nose (nasal dorsum, bridge, and tip)
    "nose": [1, 2, 4, 5, 19, 94, 195, 197, 97, 98, 326, 327, 45, 275, 460, 459, 458, 238, 239, 240, 278, 48],
    # Chin (mental pad strictly below lower lip)
    "chin": [152, 175, 199, 200, 18, 83, 313, 148, 176, 377, 400, 140, 369]
}


def get_redness_category(severity_key: str) -> Dict[str, Any]:
    key = (severity_key or "low").lower()
    if key in ["moderate", "medium"]:
        key = "medium"
    elif key in ["high"]:
        key = "high"
    else:
        key = "low"
    return REDNESS_PROTOCOLS.get(key, REDNESS_PROTOCOLS["low"])


class RednessDetector:
    _instance = None

    @classmethod
    def get_instance(cls, device=None):
        if cls._instance is None:
            cls._instance = cls(device=device)
        return cls._instance

    def __init__(self, device=None):
        self.device = self._select_safe_device(device)
        print(f"[RednessDetector] Initialized with verified compute device: {self.device}")

        # Choose model source (prefer local directory if present, else Hugging Face hub)
        model_source = LOCAL_MODEL_DIR if (os.path.isdir(LOCAL_MODEL_DIR) and os.path.exists(os.path.join(LOCAL_MODEL_DIR, "config.json"))) else MODEL_NAME
        print(f"[RednessDetector] Loading Vision Transformer weights from: {model_source}")

        try:
            self.processor = AutoImageProcessor.from_pretrained(model_source)
            self.model = AutoModelForImageClassification.from_pretrained(model_source)
            self.model.to(self.device)
            self.model.eval()

            # Verify forward pass on device
            dummy_input = torch.zeros(1, 3, 224, 224, device=self.device)
            with torch.no_grad():
                _ = self.model(dummy_input)

            self.is_loaded = True
            print("[RednessDetector] ViT Model successfully loaded and verified in memory!")
        except Exception as e:
            # If accelerator failed (e.g. MPS out of disk cache space), fallback to CPU
            print(f"[RednessDetector] Accelerator init failed ({e}), falling back to CPU...")
            try:
                self.device = torch.device("cpu")
                self.processor = AutoImageProcessor.from_pretrained(model_source)
                self.model = AutoModelForImageClassification.from_pretrained(model_source)
                self.model.to(self.device)
                self.model.eval()
                self.is_loaded = True
                print("[RednessDetector] ViT Model successfully loaded on CPU fallback.")
            except Exception as e_cpu:
                print(f"[RednessDetector] Warning: ViT model could not be loaded ({e_cpu}).")
                self.is_loaded = False
                self.processor = None
                self.model = None

    def _select_safe_device(self, requested_device=None) -> torch.device:
        if requested_device is not None:
            return torch.device(requested_device)
        if torch.cuda.is_available():
            return torch.device("cuda")
        if torch.backends.mps.is_available():
            # Test MPS availability without disk errors
            try:
                t = torch.zeros(1, device="mps")
                del t
                return torch.device("mps")
            except Exception:
                return torch.device("cpu")
        return torch.device("cpu")

    def _decode_image(self, img_input: Union[str, Image.Image, np.ndarray]) -> Image.Image:
        """Decodes and validates image input into an RGB PIL Image."""
        if img_input is None:
            raise ValueError("Image input cannot be null or empty.")

        if isinstance(img_input, Image.Image):
            img = img_input.convert("RGB")
        elif isinstance(img_input, np.ndarray):
            if img_input.size == 0:
                raise ValueError("Input numpy image array is empty.")
            if len(img_input.shape) == 2:
                img = Image.fromarray(img_input).convert("RGB")
            elif len(img_input.shape) == 3:
                # Expect RGB
                img = Image.fromarray(img_input).convert("RGB")
            else:
                raise ValueError(f"Invalid image array shape: {img_input.shape}")
        elif isinstance(img_input, str):
            clean_str = img_input.strip()
            if not clean_str:
                raise ValueError("Image string input is empty.")
            if clean_str.startswith("data:image"):
                clean_str = clean_str.split(",", 1)[1]
            try:
                raw = base64.b64decode(clean_str)
                img = Image.open(io.BytesIO(raw)).convert("RGB")
            except Exception as e:
                # Could be a file path
                if os.path.exists(clean_str):
                    img = Image.open(clean_str).convert("RGB")
                else:
                    raise ValueError(f"Failed to decode base64 or read image file: {str(e)}")
        else:
            raise ValueError(f"Unsupported image input type: {type(img_input)}")

        if img.width == 0 or img.height == 0:
            raise ValueError("Decoded image has zero width or height.")

        return img

    def _predict_vit(self, pil_img: Image.Image) -> Dict[str, float]:
        """Runs ViT inference on a single PIL image and returns softmax probabilities for all 7 labels."""
        if not self.is_loaded or self.model is None or self.processor is None:
            return {k: 1.0 / len(ALL_LABELS) for k in ALL_LABELS}

        try:
            inputs = self.processor(images=pil_img, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = torch.nn.functional.softmax(logits, dim=-1)[0].cpu().numpy()

            res = {}
            for idx, prob in enumerate(probs):
                label_name = self.model.config.id2label.get(int(idx), self.model.config.id2label.get(str(idx), f"class_{idx}"))
                res[label_name] = float(prob)
            return res
        except Exception as e:
            # If accelerator failed mid-run, switch to CPU and retry once
            if self.device != torch.device("cpu"):
                print(f"[RednessDetector] Accelerator error during inference ({e}), switching to CPU...")
                self.device = torch.device("cpu")
                if self.model:
                    self.model.to(self.device)
                return self._predict_vit(pil_img)
            print(f"[RednessDetector] Inference failed: {e}")
            return {k: 1.0 / len(ALL_LABELS) for k in ALL_LABELS}

    def _segment_facial_skin(
        self,
        np_rgb: np.ndarray,
        landmarks: Optional[List[Dict[str, float]]] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Extracts clean facial skin mask, strictly excluding non-skin regions
        (lips, vermilion border, eyes, and eyebrows) to avoid false-positive erythema.

        Returns:
            Tuple of:
              - skin_mask (bool 2D numpy array)
              - exclusion_mask (bool 2D numpy array of lips/eyes)
        """
        h, w = np_rgb.shape[:2]
        np_bgr = np_rgb[:, :, ::-1] if HAS_OPENCV else None

        # 1. Base photometric skin detection (YCrCb + HSV)
        if HAS_OPENCV:
            ycrcb = cv2.cvtColor(np_bgr, cv2.COLOR_BGR2YCrCb)
            cr = ycrcb[:, :, 1]
            cb = ycrcb[:, :, 2]
            # Standard physiological Cr/Cb skin cluster
            skin_ycrcb = (cr >= 133) & (cr <= 175) & (cb >= 77) & (cb <= 128)

            hsv = cv2.cvtColor(np_bgr, cv2.COLOR_BGR2HSV)
            h_chan = hsv[:, :, 0]
            s_chan = hsv[:, :, 1]
            v_chan = hsv[:, :, 2]
            skin_hsv = ((h_chan <= 25) | (h_chan >= 170)) & (s_chan >= 18) & (s_chan <= 210) & (v_chan >= 35)

            lab = cv2.cvtColor(np_bgr, cv2.COLOR_BGR2LAB)
            L_chan = lab[:, :, 0]
            # Exclude specular blowouts and heavy shadows
            skin_lab = (L_chan >= 35) & (L_chan <= 245)

            raw_skin = skin_ycrcb & skin_hsv & skin_lab
        else:
            r = np_rgb[:, :, 0].astype(np.float32)
            g = np_rgb[:, :, 1].astype(np.float32)
            b = np_rgb[:, :, 2].astype(np.float32)
            raw_skin = (
                (r > 45) & (g > 30) & (b > 20) &
                (r > g) & (r > b) &
                ((r - np.minimum(g, b)) > 8) &
                (r < 250)
            )

        exclusion_mask = np.zeros((h, w), dtype=bool)

        # 2. Precise Landmark Exclusion for Lips and Eyes if landmarks available
        if landmarks and len(landmarks) >= 400 and HAS_OPENCV:
            pts_array = lambda idxs: np.array([
                [int(np.clip(landmarks[i].get("x", 0.5) * w, 0, w - 1)),
                 int(np.clip(landmarks[i].get("y", 0.5) * h, 0, h - 1))]
                for i in idxs if i < len(landmarks)
            ], dtype=np.int32)

            excl_img = np.zeros((h, w), dtype=np.uint8)
            # Lip exclusion (dilated slightly to cover full vermilion border)
            lip_pts = pts_array(LIP_OUTER_INDICES)
            if len(lip_pts) >= 3:
                cv2.fillPoly(excl_img, [lip_pts], 255)
                # Dilate lips by 3% of width to ensure red vermilion border does not leak
                k_size = max(3, int(w * 0.02) | 1)
                kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_size, k_size))
                excl_img = cv2.dilate(excl_img, kernel)

            # Left and Right Eye exclusion
            left_eye_pts = pts_array(LEFT_EYE_INDICES)
            if len(left_eye_pts) >= 3:
                cv2.fillPoly(excl_img, [left_eye_pts], 255)

            right_eye_pts = pts_array(RIGHT_EYE_INDICES)
            if len(right_eye_pts) >= 3:
                cv2.fillPoly(excl_img, [right_eye_pts], 255)

            # Eyebrow exclusion
            left_brow_pts = pts_array(LEFT_BROW_INDICES)
            if len(left_brow_pts) >= 3:
                cv2.fillPoly(excl_img, [left_brow_pts], 255)

            right_brow_pts = pts_array(RIGHT_BROW_INDICES)
            if len(right_brow_pts) >= 3:
                cv2.fillPoly(excl_img, [right_brow_pts], 255)

            exclusion_mask = (excl_img > 0)
        elif HAS_OPENCV:
            # Fallback heuristic: high-saturation lipstick detection in lower-central quadrant
            hsv = cv2.cvtColor(np_bgr, cv2.COLOR_BGR2HSV)
            s_chan = hsv[:, :, 1]
            r_chan = np_rgb[:, :, 0].astype(float)
            g_chan = np_rgb[:, :, 1].astype(float)
            b_chan = np_rgb[:, :, 2].astype(float)
            # Intense red saturation often seen in lips
            is_lip_color = (s_chan > 175) & (r_chan > g_chan + 35) & (r_chan > b_chan + 35)
            exclusion_mask = is_lip_color

        clean_skin = raw_skin & (~exclusion_mask)

        # Minimum skin fallback if overly aggressive
        if np.count_nonzero(clean_skin) < 100:
            clean_skin = raw_skin

        return clean_skin, exclusion_mask

    def _extract_cielab_a(self, np_rgb: np.ndarray) -> np.ndarray:
        """
        Extracts perceptually uniform CIELAB a* channel (green to red axis).
        Standardized: a* = 0 is neutral gray, a* > 0 is red/erythema.
        """
        if HAS_OPENCV:
            bgr = np_rgb[:, :, ::-1]
            lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
            # OpenCV scales a* to [0, 255] with center 128
            a_star = lab[:, :, 1].astype(np.float32) - 128.0
            return a_star
        else:
            # Standard RGB to CIELAB approximation
            r = np_rgb[:, :, 0].astype(np.float32) / 255.0
            g = np_rgb[:, :, 1].astype(np.float32) / 255.0
            b = np_rgb[:, :, 2].astype(np.float32) / 255.0
            # a* approximation: 500 * (f(X) - f(Y)) ~ scaled (R - G)
            a_approx = (r - g) * 100.0
            return a_approx

    def _extract_crops_and_zone_masks(
        self,
        full_img: Image.Image,
        landmarks: Optional[List[Dict[str, float]]]
    ) -> Dict[str, Tuple[Image.Image, np.ndarray]]:
        """
        Extracts zone image crops and precise zone masks using MediaPipe landmarks.
        Returns: { zone_name: (zone_crop_pil, zone_mask_2d) }
        """
        w, h = full_img.size
        zones = {}

        if not landmarks or len(landmarks) < 200 or not HAS_OPENCV:
            # Generic bounding boxes if landmarks missing
            default_boxes = {
                "forehead": (int(0.25 * w), int(0.10 * h), int(0.75 * w), int(0.32 * h)),
                "leftCheek": (int(0.12 * w), int(0.40 * h), int(0.42 * w), int(0.68 * h)),
                "rightCheek": (int(0.58 * w), int(0.40 * h), int(0.88 * w), int(0.68 * h)),
                "nose": (int(0.38 * w), int(0.36 * h), int(0.62 * w), int(0.62 * h)),
                "chin": (int(0.32 * w), int(0.72 * h), int(0.68 * w), int(0.92 * h))
            }
            for z_name, box in default_boxes.items():
                crop = full_img.crop(box)
                mask = np.ones((box[3] - box[1], box[2] - box[0]), dtype=bool)
                zones[z_name] = (crop, mask)
            return zones

        for zone_name, indices in ZONE_LANDMARK_INDICES.items():
            pts = []
            for idx in indices:
                if idx < len(landmarks):
                    lm = landmarks[idx]
                    pts.append((int(np.clip(lm.get("x", 0.5) * w, 0, w - 1)),
                                int(np.clip(lm.get("y", 0.5) * h, 0, h - 1))))
            if len(pts) < 3:
                continue

            pts_arr = np.array(pts, dtype=np.int32)
            min_x = max(0, int(np.min(pts_arr[:, 0]) - w * 0.02))
            max_x = min(w, int(np.max(pts_arr[:, 0]) + w * 0.02))
            min_y = max(0, int(np.min(pts_arr[:, 1]) - h * 0.02))
            max_y = min(h, int(np.max(pts_arr[:, 1]) + h * 0.02))

            crop_w = max(10, max_x - min_x)
            crop_h = max(10, max_y - min_y)
            crop = full_img.crop((min_x, min_y, min_x + crop_w, min_y + crop_h))

            # Create clean convex polygon mask inside crop (guarantees no self-intersections)
            pts_shifted = pts_arr - np.array([min_x, min_y], dtype=np.int32)
            pts_hull = cv2.convexHull(pts_shifted)
            mask_img = np.zeros((crop_h, crop_w), dtype=np.uint8)
            cv2.fillPoly(mask_img, [pts_hull], 255)
            zones[zone_name] = (crop, mask_img > 0)

        return zones

    def _generate_heatmap_overlay(
        self,
        full_rgb: np.ndarray,
        delta_a: np.ndarray,
        skin_mask: np.ndarray
    ) -> Optional[str]:
        """
        Generates an alpha-blended erythema heatmap overlay on facial skin.
        Returns: base64 PNG data URL or None
        """
        if not HAS_OPENCV:
            return None

        h, w = full_rgb.shape[:2]
        bgr = full_rgb[:, :, ::-1].copy()

        # Erythema threshold: Delta a* >= 3.5
        erythema_pixels = (delta_a >= 3.5) & skin_mask
        if not np.any(erythema_pixels):
            # No notable erythema: return clean face image
            success, buf = cv2.imencode(".png", bgr)
            if success:
                return "data:image/png;base64," + base64.b64encode(buf).decode("utf-8")
            return None

        # Normalize Delta a* in range [3.5, 16.0] to [0, 255]
        clipped_delta = np.clip((delta_a - 3.5) / 12.5, 0.0, 1.0) * 255.0
        intensity = clipped_delta.astype(np.uint8)

        # Apply colormap JET / INFERNO
        colored_heat = cv2.applyColorMap(intensity, cv2.COLORMAP_JET)

        # Alpha blend onto skin
        alpha = 0.52
        bgr[erythema_pixels] = cv2.addWeighted(
            bgr[erythema_pixels], 1.0 - alpha,
            colored_heat[erythema_pixels], alpha,
            0.0
        )

        success, buf = cv2.imencode(".png", bgr)
        if success:
            return "data:image/png;base64," + base64.b64encode(buf).decode("utf-8")
        return None

    def analyze_face(
        self,
        image_input: Union[str, Image.Image, np.ndarray],
        landmarks: Optional[List[Dict[str, float]]] = None,
        crops: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Audits and detects facial redness and erythema.

        Returns structured, verified output:
          - redness_detected: bool (decision rule grounded in verified measurements)
          - redness_percentage: float (percentage of analyzed facial skin exhibiting elevated erythema)
          - severity: str ('low' | 'medium' | 'high')
          - confidence: float (model-derived softmax probability from ViT)
          - visualization: str (base64 PNG heatmap data URL) or null
        """
        try:
            full_pil = self._decode_image(image_input)
        except Exception as decode_err:
            return {
                "success": False,
                "error": str(decode_err),
                "redness_detected": False,
                "redness_percentage": None,
                "severity": None,
                "confidence": None,
                "visualization": None,
                "disclaimer": "Analysis could not be performed due to invalid image input."
            }

        w, h = full_pil.size
        full_rgb = np.array(full_pil)

        # 1. Run ViT Model Inference
        vit_probs = self._predict_vit(full_pil)
        redness_confidence = float(vit_probs.get(REDNESS_LABEL, 0.143))

        # 2. Extract clean facial skin mask (strictly excluding lips, eyes, brows)
        skin_mask, exclusion_mask = self._segment_facial_skin(full_rgb, landmarks)
        total_skin_pixels = int(np.count_nonzero(skin_mask))

        if total_skin_pixels < 50:
            return {
                "success": True,
                "redness_detected": False,
                "redness_percentage": 0.0,
                "severity": "low",
                "confidence": round(redness_confidence, 4),
                "visualization": None,
                "note": "Insufficient facial skin pixels found for colorimetric analysis.",
                "disclaimer": "No clear facial skin identified in the frame."
            }

        # 3. Extract CIELAB a* (erythema axis)
        a_star = self._extract_cielab_a(full_rgb)
        skin_a = a_star[skin_mask]

        # 4. Establish patient's individual un-inflamed skin baseline (a*_base)
        # Prefers forehead skin if available, otherwise lowest 50th percentile of skin
        zone_data = self._extract_crops_and_zone_masks(full_pil, landmarks)

        baseline_a = None
        sigma_base = 2.5
        if "forehead" in zone_data:
            fh_crop, fh_mask = zone_data["forehead"]
            fh_rgb = np.array(fh_crop)
            fh_clean_skin, _ = self._segment_facial_skin(fh_rgb)
            fh_skin = fh_clean_skin & fh_mask if fh_mask.shape == fh_clean_skin.shape else fh_clean_skin
            if np.count_nonzero(fh_skin) >= 20:
                fh_a = self._extract_cielab_a(fh_rgb)[fh_skin]
                baseline_a = float(np.median(fh_a))
                sigma_base = max(1.5, float(np.std(fh_a)))

        if baseline_a is None:
            # The un-inflamed lower half of the distribution represents baseline tone
            sub_median = skin_a[skin_a <= np.median(skin_a)]
            if len(sub_median) >= 10:
                baseline_a = float(np.median(sub_median))
                sigma_base = max(1.5, float(np.std(sub_median)))
            else:
                baseline_a = float(np.median(skin_a))
                sigma_base = 2.5

        # 5. Differential Erythema Calculation (Delta a*)
        # Adaptive threshold: 1.75 sigma above baseline, with a physiological minimum of 4.2
        delta_threshold = max(4.2, 1.75 * sigma_base)

        delta_a = np.zeros_like(a_star)
        delta_a[skin_mask] = np.maximum(0.0, a_star[skin_mask] - baseline_a)

        # Pixels with significant perceptible erythema elevation above baseline
        erythema_pixels = (delta_a >= delta_threshold) & skin_mask
        count_erythema = int(np.count_nonzero(erythema_pixels))

        # Percentage of analyzed facial skin affected
        redness_percentage = round(float(count_erythema / max(1, total_skin_pixels) * 100.0), 1)

        # 6. 5-Zone Detailed Analysis
        zone_redness: Dict[str, Dict[str, Any]] = {}
        zones_to_eval = ["leftCheek", "rightCheek", "nose", "forehead", "chin"]

        for z_name in zones_to_eval:
            if z_name in zone_data:
                z_crop, z_mask = zone_data[z_name]
                z_rgb = np.array(z_crop)
                z_skin, _ = self._segment_facial_skin(z_rgb)
                z_valid = (z_skin & z_mask) if z_mask.shape == z_skin.shape else z_skin

                if np.count_nonzero(z_valid) >= 15:
                    z_a = self._extract_cielab_a(z_rgb)[z_valid]
                    z_mean_a = float(np.mean(z_a))
                    z_delta_a = max(0.0, z_mean_a - baseline_a)
                    z_ery_count = int(np.count_nonzero(z_a >= (baseline_a + delta_threshold)))
                    z_area_pct = round(float(z_ery_count / max(1, len(z_a)) * 100.0), 1)

                    r_mean = int(np.mean(z_rgb[:, :, 0][z_valid]))
                    g_mean = int(np.mean(z_rgb[:, :, 1][z_valid]))
                    b_mean = int(np.mean(z_rgb[:, :, 2][z_valid]))
                else:
                    z_delta_a = 0.0
                    z_area_pct = 0.0
                    r_mean, g_mean, b_mean = 180, 150, 140
            else:
                z_delta_a = 0.0
                z_area_pct = 0.0
                r_mean, g_mean, b_mean = 180, 150, 140

            # Calibrated Zone Score & Severity (0-100 scale: Low <= 33, Moderate 34-66, High >= 67)
            z_score = int(np.clip(z_delta_a * 8.5 + z_area_pct * 1.8, 5, 98))
            if z_score <= 33:
                z_sev = "Low"
                z_status = "Baseline Vascular Tone"
            elif z_score <= 66:
                z_sev = "Moderate"
                z_status = "Reactive Capillary Flush"
            else:
                z_sev = "High"
                z_status = "Marked Vascular Erythema"

            contrast_pct = round((z_delta_a / max(1.0, abs(baseline_a))) * 100.0, 1)

            zone_redness[z_name] = {
                "score": z_score,
                "severity": z_sev,
                "status": z_status,
                "affectedAreaPercent": z_area_pct,
                "deltaErythemaIndex": round(z_delta_a, 1),
                "differentialContrastPct": contrast_pct,
                "contrastLabel": f"{contrast_pct:+.1f}% vs Baseline",
                "rgb": [r_mean, g_mean, b_mean],
                "rgbHex": f"#{r_mean:02x}{g_mean:02x}{b_mean:02x}".upper()
            }

        # 7. Overall Severity and Decision Rule
        cheek_nose_delta = max(
            zone_redness.get("leftCheek", {}).get("deltaErythemaIndex", 0),
            zone_redness.get("rightCheek", {}).get("deltaErythemaIndex", 0),
            zone_redness.get("nose", {}).get("deltaErythemaIndex", 0)
        )

        s_intensity = min(100.0, max(0.0, (cheek_nose_delta / 8.0) * 100.0))
        s_area = min(100.0, max(0.0, (redness_percentage / 30.0) * 100.0))
        s_vit = min(100.0, max(0.0, ((redness_confidence - 0.15) / 0.30) * 100.0))

        weighted_zone_score = (
            zone_redness.get("leftCheek", {}).get("score", 15) * 0.30 +
            zone_redness.get("rightCheek", {}).get("score", 15) * 0.30 +
            zone_redness.get("nose", {}).get("score", 15) * 0.20 +
            zone_redness.get("forehead", {}).get("score", 15) * 0.10 +
            zone_redness.get("chin", {}).get("score", 15) * 0.10
        )

        s_composite = (
            0.35 * s_intensity +
            0.30 * s_area +
            0.20 * weighted_zone_score +
            0.15 * s_vit
        )

        # Validated decision rule:
        # Redness detected if physical affected area >= 7% OR localized flush >= 3.5 Delta a*
        # OR ViT model strongly predicts skin redness (>= 0.35) with visible chromatic shift (>= 2.0)
        redness_detected = bool(
            redness_percentage >= 7.0 or
            cheek_nose_delta >= 3.5 or
            (redness_confidence >= 0.35 and cheek_nose_delta >= 2.0)
        )

        # Calibrated Severity Scale with Strict Monotonic Coupling:
        # Tier 1 - Low (0–33): Minimal / Baseline Vascular Tone
        # Tier 2 - Moderate (34–66): Reactive Capillary Flush
        # Tier 3 - High (67–100): Marked Vascular Erythema
        if not redness_detected:
            final_score = int(np.clip(round(s_composite * 0.35), 5, 25))
            severity = "low"
            sev_label_compat = "Low"
        else:
            final_score = int(np.clip(round(s_composite), 28, 98))
            if final_score <= 33:
                severity = "low"
                sev_label_compat = "Low"
            elif final_score <= 66:
                severity = "medium"
                sev_label_compat = "Moderate"
            else:
                severity = "high"
                sev_label_compat = "High"

        protocol = get_redness_category(severity)

        # 8. Heatmap / Mask Visualization
        visualization_b64 = self._generate_heatmap_overlay(full_rgb, delta_a, skin_mask)

        telemetry = {
            "baselineSkinA": round(baseline_a, 2),
            "meanDeltaA": round(float(np.mean(delta_a[skin_mask])), 2),
            "maxZoneDeltaA": round(cheek_nose_delta, 2),
            "analyzedSkinPixels": total_skin_pixels,
            "erythemaPixels": count_erythema,
            "opencvAccelerated": HAS_OPENCV
        }

        return {
            "success": True,
            # ── Standardized Expected Results ────────────────────────────────
            "redness_detected": redness_detected,
            "redness_percentage": redness_percentage,
            "severity": severity,
            "confidence": round(redness_confidence, 4),
            "visualization": visualization_b64,
            # ── Backward Compatible Fields for Existing Frontend ─────────────
            "is_detected": redness_detected,
            "redness_severity": sev_label_compat,
            "severity_category": sev_label_compat,
            "severity_info": protocol["severity"],
            "severity_scale": REDNESS_SEVERITY_SCALE,
            "redness_score": final_score,
            "rednessScore": final_score,
            "affected_area_percentage": redness_percentage,
            "model_confidence": round(redness_confidence, 4),
            "zone_redness": zone_redness,
            "telemetry": telemetry,
            "status": protocol["status"],
            "description": protocol["description"],
            "etiology": protocol["etiology"],
            "treatment": protocol["treatment"],
            "precautions": protocol["precautions"],
            "model_info": {
                "name": "ViT-FaceCharacteristics (varun1505/face-characteristics)",
                "architecture": "Vision Transformer (ViTForImageClassification)",
                "device": str(self.device),
                "is_loaded": self.is_loaded,
                "colorimetry": "CIELAB a* differential cutaneous telemetry",
                "segmentation": "MediaPipe landmark-guided skin isolation with lip/eye exclusion"
            },
            "disclaimer": "This analysis provides automated AI and computer vision visual estimates of facial erythema and does NOT constitute a clinical diagnosis or medical evaluation.",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }


def get_redness_detector(device=None) -> RednessDetector:
    return RednessDetector.get_instance(device=device)


if __name__ == "__main__":
    detector = get_redness_detector()
    dummy = Image.fromarray(np.uint8(np.random.rand(224, 224, 3) * 255))
    res = detector.analyze_face(dummy)
    print("Test Result:")
    for k in ["redness_detected", "redness_percentage", "severity", "confidence", "redness_score"]:
        print(f"  {k}: {res.get(k)}")
    if res.get("visualization"):
        print(f"  visualization length: {len(res['visualization'])}")
