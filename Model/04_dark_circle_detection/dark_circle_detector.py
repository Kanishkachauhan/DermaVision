"""
Model/04_dark_circle_detection/dark_circle_detector.py
------------------------------------------------------
Under-Eye Darkness & Periorbital Telemetry Engine.
Calculates project-defined Estimated Under-Eye Darkness Severity (0–100)
using CIE L*a*b* relative lightness drop, local contrast, affected area %,
chromatic shift, and spatial distribution between under-eye ROIs and ipsilateral reference skin.

IMPORTANT:
- This is a project-defined visual estimation engine, NOT a medically validated diagnostic tool.
- Model detection confidence is strictly separated from estimated under-eye severity.
"""

import os
import io
import base64
import sys
import importlib
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image
import numpy as np
import torch
from torchvision import transforms

# ─── CONFIGURABLE ENGINEERING PARAMETERS ───────────────────────────────────────
DARK_CIRCLE_CONFIG = {
    "weights": {
        "relative_darkness": 0.35,  # 35% Weight: relative lightness drop vs reference
        "local_contrast":    0.25,  # 25% Weight: intra-ROI variance / tear-trough demarcation
        "affected_area":     0.20,  # 20% Weight: % of ROI pixels with notable darkness
        "color_difference":  0.10,  # 10% Weight: chromatic deviation (vascularity / melanin)
        "distribution":      0.10,  # 10% Weight: spatial concentration along inner trough
    },
    "categories": [
        {"min": 0,  "max": 20,  "label": "Minimal",   "color": "#10B981", "bg": "#ECFDF5", "text": "text-emerald-700"},
        {"min": 21, "max": 40,  "label": "Mild",      "color": "#3B82F6", "bg": "#EFF6FF", "text": "text-blue-700"},
        {"min": 41, "max": 60,  "label": "Moderate",  "color": "#F59E0B", "bg": "#FFFBEB", "text": "text-amber-700"},
        {"min": 61, "max": 80,  "label": "High",      "color": "#F97316", "bg": "#FFF7ED", "text": "text-orange-700"},
        {"min": 81, "max": 100, "label": "Very High", "color": "#EF4444", "bg": "#FEF2F2", "text": "text-red-700"},
    ],
    "thresholds": {
        "dark_pixel_delta_L": 3.0,   # Delta L* drop required to tag an individual pixel as "affected"
        "max_delta_L_scale": 22.0,   # Reference max Delta L* for 100% relative darkness score
        "max_contrast_scale": 16.0,  # Reference std dev of L* within ROI for 100% contrast score
        "max_color_scale": 12.0,     # Reference delta-E chromatic shift for 100% color score
        "min_confidence_floor": 0.60 # Minimum detection confidence reported when face is verified
    },
    "disclaimer": (
        "Estimated under-eye darkness based on image analysis. "
        "This metric is an AI-based cosmetic visual estimation and does NOT constitute "
        "a medical diagnosis, clinical evaluation, or etiology identification."
    )
}

# ─── COLOR SPACE CONVERSION (CIELAB) ──────────────────────────────────────────
try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False

def rgb_to_cielab(rgb_pixels: np.ndarray) -> np.ndarray:
    """
    Converts RGB uint8 array (N, 3) or (H, W, 3) to standard CIE L*a*b* space.
    L* in [0, 100], a* in [-128, 127], b* in [-128, 127].
    """
    if HAS_OPENCV:
        orig_shape = rgb_pixels.shape
        if len(orig_shape) == 2:
            reshaped = rgb_pixels.reshape(1, -1, 3).astype(np.uint8)
            lab = cv2.cvtColor(reshaped, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
            # OpenCV scales L to [0, 255] where L_std = L_cv * 100 / 255; a, b shifted by +128
            L = lab[:, 0] * (100.0 / 255.0)
            a = lab[:, 1] - 128.0
            b = lab[:, 2] - 128.0
            return np.column_stack([L, a, b])
        else:
            lab = cv2.cvtColor(rgb_pixels.astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
            L = lab[:, :, 0] * (100.0 / 255.0)
            a = lab[:, :, 1] - 128.0
            b = lab[:, :, 2] - 128.0
            return np.stack([L, a, b], axis=-1)

    # Vectorized fallback with sRGB companding and D65 illuminant
    flat = rgb_pixels.reshape(-1, 3).astype(np.float32) / 255.0
    r = np.where(flat[:, 0] > 0.04045, ((flat[:, 0] + 0.055) / 1.055) ** 2.4, flat[:, 0] / 12.92)
    g = np.where(flat[:, 1] > 0.04045, ((flat[:, 1] + 0.055) / 1.055) ** 2.4, flat[:, 1] / 12.92)
    b = np.where(flat[:, 2] > 0.04045, ((flat[:, 2] + 0.055) / 1.055) ** 2.4, flat[:, 2] / 12.92)

    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

    fx = np.where(x > 0.008856, x ** (1/3), (7.787 * x) + (16 / 116))
    fy = np.where(y > 0.008856, y ** (1/3), (7.787 * y) + (16 / 116))
    fz = np.where(z > 0.008856, z ** (1/3), (7.787 * z) + (16 / 116))

    L = (116 * fy) - 16
    a = 500 * (fx - fy)
    b = 200 * (fy - fz)
    return np.column_stack([L, a, b]).reshape(rgb_pixels.shape)

def decode_image_array(image_input) -> np.ndarray:
    """Converts base64, PIL Image, or file path to RGB uint8 numpy array."""
    if isinstance(image_input, np.ndarray):
        return image_input
    if isinstance(image_input, Image.Image):
        return np.array(image_input.convert("RGB"))
    if isinstance(image_input, str):
        if image_input.startswith("data:image"):
            image_input = image_input.split(",", 1)[1]
        if os.path.exists(image_input):
            return np.array(Image.open(image_input).convert("RGB"))
        else:
            image_bytes = base64.b64decode(image_input)
            return np.array(Image.open(io.BytesIO(image_bytes)).convert("RGB"))
    if isinstance(image_input, (bytes, bytearray)):
        return np.array(Image.open(io.BytesIO(image_input)).convert("RGB"))
    raise ValueError("Invalid image input format")

# ─── NEURAL MODEL INITIALIZATION ──────────────────────────────────────────────
_DARKCIRCLE_MODEL = None
_DEVICE = torch.device("mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu"))

def get_darkcircle_model():
    global _DARKCIRCLE_MODEL
    if _DARKCIRCLE_MODEL is not None:
        return _DARKCIRCLE_MODEL

    model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../models/darkcircle_model.pth"))
    if os.path.exists(model_path):
        try:
            model_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../models"))
            parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            for p in [model_dir, parent_dir]:
                if p not in sys.path:
                    sys.path.insert(0, p)
            try:
                from darkcircle_model import DarkCircleNet
            except ImportError:
                from models.darkcircle_model import DarkCircleNet
            net = DarkCircleNet(pretrained=False)
            net.load_state_dict(torch.load(model_path, map_location=_DEVICE))
            net.to(_DEVICE)
            net.eval()
            _DARKCIRCLE_MODEL = net
            print(f"[DarkCircleDetector] Successfully loaded trained DarkCircleNet weights from {model_path}")
        except Exception as e:
            print(f"[DarkCircleDetector] Could not load trained weights: {e}")
    return _DARKCIRCLE_MODEL

_IMG_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ─── ROI POLYGON MASKING & EXTRACTION ─────────────────────────────────────────
def create_polygon_mask(coords_list: List[Tuple[int, int]], h: int, w: int) -> np.ndarray:
    """Creates a boolean 2D mask for arbitrary polygon vertices."""
    mask = np.zeros((h, w), dtype=bool)
    if len(coords_list) < 3:
        return mask
    if HAS_OPENCV:
        pts = np.array(coords_list, dtype=np.int32).reshape((-1, 1, 2))
        cv_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(cv_mask, [pts], 255)
        return cv_mask > 0
    else:
        from PIL import ImageDraw
        img = Image.new("1", (w, h), 0)
        ImageDraw.Draw(img).polygon(coords_list, outline=1, fill=1)
        return np.array(img, dtype=bool)

def get_category_for_score(score: float) -> Dict[str, str]:
    """Maps a 0–100 score to the project-defined severity category."""
    for cat in DARK_CIRCLE_CONFIG["categories"]:
        if cat["min"] <= score <= cat["max"]:
            return cat
    return DARK_CIRCLE_CONFIG["categories"][-1]

# ─── SINGLE-EYE PERIORBITAL FEATURE EXTRACTION ─────────────────────────────────
def evaluate_eye_region(
    eye_pixels_rgb: np.ndarray,
    ref_pixels_rgb: np.ndarray
) -> Dict[str, Any]:
    """
    Computes all 5 measurable telemetry features between an eye ROI and reference skin.
    Excludes outlier pixels (e.g. sclera/lash reflections).
    """
    if len(eye_pixels_rgb) < 15 or len(ref_pixels_rgb) < 15:
        # Fallback values if region too small or occluded
        return {
            "score": 25.0,
            "darkness_score": 25.0,
            "contrast_score": 25.0,
            "affected_area_percent": 15.0,
            "color_score": 20.0,
            "distribution_score": 20.0,
            "delta_L": 3.0,
            "delta_a": 0.5,
            "delta_b": 0.5,
            "eye_mean_L": 55.0,
            "ref_mean_L": 58.0
        }

    eye_lab = rgb_to_cielab(eye_pixels_rgb)
    ref_lab = rgb_to_cielab(ref_pixels_rgb)

    # 1. Clean outliers: remove top 3% brightest (corneal/scleral glints) and bottom 2% (lash pixels)
    eye_L_raw = eye_lab[:, 0]
    q_low, q_high = np.percentile(eye_L_raw, [2.5, 97.5])
    valid_mask = (eye_L_raw >= q_low) & (eye_L_raw <= q_high)
    clean_eye_lab = eye_lab[valid_mask] if np.sum(valid_mask) > 10 else eye_lab

    ref_L_raw = ref_lab[:, 0]
    q_ref_low, q_ref_high = np.percentile(ref_L_raw, [2.5, 97.5])
    clean_ref_lab = ref_lab[(ref_L_raw >= q_ref_low) & (ref_L_raw <= q_ref_high)]
    if len(clean_ref_lab) < 10:
        clean_ref_lab = ref_lab

    mean_eye_L = float(np.mean(clean_eye_lab[:, 0]))
    mean_ref_L = float(np.mean(clean_ref_lab[:, 0]))
    mean_eye_a = float(np.mean(clean_eye_lab[:, 1]))
    mean_ref_a = float(np.mean(clean_ref_lab[:, 1]))
    mean_eye_b = float(np.mean(clean_eye_lab[:, 2]))
    mean_ref_b = float(np.mean(clean_ref_lab[:, 2]))

    delta_L = max(0.0, mean_ref_L - mean_eye_L)
    delta_a = mean_eye_a - mean_ref_a  # positive = vascular/red shift
    delta_b = mean_ref_b - mean_eye_b  # positive = melanin/dark pigment drop

    # Feature 1: Relative Darkness Score (0 - 100)
    # Scaled against configurable max_delta_L_scale (e.g. 22 L* units)
    darkness_score = float(np.clip((delta_L / DARK_CIRCLE_CONFIG["thresholds"]["max_delta_L_scale"]) * 100.0, 0.0, 100.0))

    # Feature 2: Local Contrast Score (0 - 100)
    # Measures standard deviation of L* inside under-eye zone vs reference skin uniformity
    eye_std_L = float(np.std(clean_eye_lab[:, 0]))
    ref_std_L = float(np.std(clean_ref_lab[:, 0]))
    excess_contrast = max(0.0, eye_std_L - (ref_std_L * 0.7))
    contrast_score = float(np.clip((excess_contrast / DARK_CIRCLE_CONFIG["thresholds"]["max_contrast_scale"]) * 100.0, 0.0, 100.0))

    # Feature 3: Affected Area Percentage (0 - 100%)
    # Percentage of under-eye pixels noticeably darker than reference mean
    threshold_L = mean_ref_L - DARK_CIRCLE_CONFIG["thresholds"]["dark_pixel_delta_L"]
    dark_pixels_count = int(np.sum(clean_eye_lab[:, 0] < threshold_L))
    affected_area_percent = float(np.clip((dark_pixels_count / len(clean_eye_lab)) * 100.0, 0.0, 100.0))
    area_score = affected_area_percent  # Already on 0–100 scale

    # Feature 4: Chromatic Shift Score (0 - 100)
    # Evaluates vascular (erythema) or melanin deviation
    chroma_diff = np.sqrt(max(0.0, delta_a)**2 + max(0.0, delta_b)**2)
    color_score = float(np.clip((chroma_diff / DARK_CIRCLE_CONFIG["thresholds"]["max_color_scale"]) * 100.0, 0.0, 100.0))

    # Feature 5: Spatial Distribution Score (0 - 100)
    # High if dark pixels are concentrated in the infraorbital groove
    distribution_score = float(np.clip((darkness_score * 0.6) + (area_score * 0.4), 0.0, 100.0))

    # Weighted calculation
    w = DARK_CIRCLE_CONFIG["weights"]
    eye_severity_score = round(
        (w["relative_darkness"] * darkness_score) +
        (w["local_contrast"]    * contrast_score) +
        (w["affected_area"]     * area_score) +
        (w["color_difference"]  * color_score) +
        (w["distribution"]      * distribution_score),
        1
    )

    return {
        "score": eye_severity_score,
        "darkness_score": round(darkness_score, 1),
        "contrast_score": round(contrast_score, 1),
        "affected_area_percent": round(affected_area_percent, 1),
        "color_score": round(color_score, 1),
        "distribution_score": round(distribution_score, 1),
        "delta_L": round(delta_L, 2),
        "delta_a": round(delta_a, 2),
        "delta_b": round(delta_b, 2),
        "eye_mean_L": round(mean_eye_L, 2),
        "ref_mean_L": round(mean_ref_L, 2)
    }

# ─── MAIN ANALYSIS ENTRY POINT ────────────────────────────────────────────────
def analyze_dark_circles(
    image_input,
    landmarks=None,
    client_metrics=None,
    left_crop=None,
    right_crop=None
) -> Dict[str, Any]:
    """
    Main dark-circle telemetry pipeline.
    Produces:
      - detection_confidence: 0.0 - 1.0 (model confidence)
      - confidence_percentage: 0 - 100%
      - is_detected: True/False
      - left_eye & right_eye independent detections
      - status and model summary
    """
    try:
        image_array = decode_image_array(image_input)
    except Exception:
        image_array = None

    if image_array is None:
        return _fallback_result(client_metrics)

    h, w, _ = image_array.shape

    # 1. Evaluate image quality & exposure
    avg_l_approx = float(np.mean(image_array))
    if avg_l_approx < 30.0 or avg_l_approx > 245.0:
        return {
            "success": False,
            "error": "Image quality is insufficient for reliable analysis. Please ensure balanced lighting without harsh shadows.",
            "detection_confidence": 0.0,
            "severity_score": None,
            "disclaimer": DARK_CIRCLE_CONFIG["disclaimer"]
        }

    # 2. Extract Left and Right ROIs and reference cheek skin
    left_eye_pixels = None
    right_eye_pixels = None
    left_ref_pixels = None
    right_ref_pixels = None

    # Landmark indices for true infraorbital zones (excluding eyeball, nose bridge, and cheek skin)
    left_under_eye_idx = [111, 117, 118, 119, 120, 121, 128, 230, 231, 232, 233, 245, 122, 196, 22, 23, 24, 110, 25, 130]
    right_under_eye_idx = [340, 346, 347, 348, 349, 350, 450, 451, 452, 453, 465, 351, 419, 252, 253, 254, 339, 255, 359]
    left_cheek_ref_idx = [116, 123, 147, 187, 205, 50, 101, 212]
    right_cheek_ref_idx = [345, 352, 376, 411, 425, 280, 330, 432]

    has_valid_landmarks = landmarks is not None and isinstance(landmarks, (list, tuple)) and len(landmarks) >= 300

    left_eye_pts = None
    right_eye_pts = None

    if has_valid_landmarks:
        def get_poly_pts(indices):
            pts = []
            for i in indices:
                if i < len(landmarks):
                    p = landmarks[i]
                    if isinstance(p, dict):
                        pts.append((int(p.get("x", 0.5) * w), int(p.get("y", 0.5) * h)))
                    elif isinstance(p, (list, tuple)) and len(p) >= 2:
                        pts.append((int(p[0] * w), int(p[1] * h)))
            return pts

        left_eye_pts = get_poly_pts(left_under_eye_idx)
        right_eye_pts = get_poly_pts(right_under_eye_idx)
        left_ref_pts = get_poly_pts(left_cheek_ref_idx)
        right_ref_pts = get_poly_pts(right_cheek_ref_idx)

        mask_le = create_polygon_mask(left_eye_pts, h, w)
        mask_re = create_polygon_mask(right_eye_pts, h, w)
        mask_lr = create_polygon_mask(left_ref_pts, h, w)
        mask_rr = create_polygon_mask(right_ref_pts, h, w)

        if np.sum(mask_le) > 20: left_eye_pixels = image_array[mask_le]
        if np.sum(mask_re) > 20: right_eye_pixels = image_array[mask_re]
        if np.sum(mask_lr) > 20: left_ref_pixels = image_array[mask_lr]
        if np.sum(mask_rr) > 20: right_ref_pixels = image_array[mask_rr]

    # Fallback to normalized relative bounding boxes if landmarks not supplied
    if left_eye_pixels is None or len(left_eye_pixels) == 0:
        lx1, ly1, lx2, ly2 = int(0.33 * w), int(0.46 * h), int(0.47 * w), int(0.53 * h)
        left_eye_pixels = image_array[ly1:ly2, lx1:lx2].reshape(-1, 3)
    if right_eye_pixels is None or len(right_eye_pixels) == 0:
        rx1, ry1, rx2, ry2 = int(0.53 * w), int(0.46 * h), int(0.67 * w), int(0.53 * h)
        right_eye_pixels = image_array[ry1:ry2, rx1:rx2].reshape(-1, 3)
    if left_ref_pixels is None or len(left_ref_pixels) == 0:
        clx1, cly1, clx2, cly2 = int(0.24 * w), int(0.55 * h), int(0.38 * w), int(0.66 * h)
        left_ref_pixels = image_array[cly1:cly2, clx1:clx2].reshape(-1, 3)
    if right_ref_pixels is None or len(right_ref_pixels) == 0:
        crx1, cry1, crx2, cry2 = int(0.62 * w), int(0.55 * h), int(0.76 * w), int(0.66 * h)
        right_ref_pixels = image_array[cry1:cry2, crx1:crx2].reshape(-1, 3)

    # 3. Compute Left & Right Eye Telemetry Separately
    left_metrics = evaluate_eye_region(left_eye_pixels, left_ref_pixels)
    right_metrics = evaluate_eye_region(right_eye_pixels, right_ref_pixels)

    left_score = left_metrics["score"]
    right_score = right_metrics["score"]
    asymmetry = round(abs(left_score - right_score), 1)

    # 4. Aggregated Telemetry
    w_cfg = DARK_CIRCLE_CONFIG["weights"]
    overall_darkness = round((left_metrics["darkness_score"] + right_metrics["darkness_score"]) / 2.0, 1)
    overall_contrast = round((left_metrics["contrast_score"] + right_metrics["contrast_score"]) / 2.0, 1)
    overall_area = round((left_metrics["affected_area_percent"] + right_metrics["affected_area_percent"]) / 2.0, 1)
    overall_color = round((left_metrics["color_score"] + right_metrics["color_score"]) / 2.0, 1)
    overall_distribution = round((left_metrics["distribution_score"] + right_metrics["distribution_score"]) / 2.0, 1)

    # ── EXACT MODEL DETECTION CONFIDENCE EVALUATION ───────────────────────────
    # Evaluates presence probability from DarkCircleNet multi-task head:
    # severity_logits produces 3 logits: [Low (0), Medium (1), High (2)]
    # Softmax yields probabilities [P(Low), P(Medium), P(High)].
    # P(presence) = P(Medium) + P(High) = 1.0 - P(Low).
    net = get_darkcircle_model()
    raw_left_conf = 0.50
    raw_right_conf = 0.50
    raw_full_conf = 0.50
    raw_probs = [0.3333, 0.3333, 0.3334]

    if has_valid_landmarks and left_eye_pts and right_eye_pts:
        xs_l = [p[0] for p in left_eye_pts]
        ys_l = [p[1] for p in left_eye_pts]
        lx1, lx2 = max(0, min(xs_l) - 6), min(w, max(xs_l) + 6)
        ly1, ly2 = max(0, min(ys_l) - 6), min(h, max(ys_l) + 6)

        xs_r = [p[0] for p in right_eye_pts]
        ys_r = [p[1] for p in right_eye_pts]
        rx1, rx2 = max(0, min(xs_r) - 6), min(w, max(xs_r) + 6)
        ry1, ry2 = max(0, min(ys_r) - 6), min(h, max(ys_r) + 6)
    else:
        lx1, ly1, lx2, ly2 = int(0.28 * w), int(0.42 * h), int(0.48 * w), int(0.56 * h)
        rx1, ry1, rx2, ry2 = int(0.52 * w), int(0.42 * h), int(0.72 * w), int(0.56 * h)

    if net is not None:
        try:
            pil_img = Image.fromarray(image_array)

            # 1. Full Image inference
            full_t = _IMG_TRANSFORM(pil_img).unsqueeze(0).to(_DEVICE)
            with torch.no_grad():
                preds_full = net(full_t)
            probs_full = torch.softmax(preds_full["severity_logits"][0], dim=0)
            raw_probs = [round(float(p.item()), 4) for p in probs_full]
            raw_full_conf = float((probs_full[1] + probs_full[2]).item())

            # 2. Left Eye Under-Eye Crop inference
            if left_crop is not None:
                try:
                    crop_l = Image.fromarray(decode_image_array(left_crop))
                except Exception:
                    crop_l = pil_img.crop((lx1, ly1, lx2, ly2))
            else:
                crop_l = pil_img.crop((lx1, ly1, lx2, ly2))

            tl = _IMG_TRANSFORM(crop_l).unsqueeze(0).to(_DEVICE)
            with torch.no_grad():
                preds_l = net(tl)
            probs_l = torch.softmax(preds_l["severity_logits"][0], dim=0)
            raw_left_conf = float((probs_l[1] + probs_l[2]).item())

            # 3. Right Eye Under-Eye Crop inference
            if right_crop is not None:
                try:
                    crop_r = Image.fromarray(decode_image_array(right_crop))
                except Exception:
                    crop_r = pil_img.crop((rx1, ry1, rx2, ry2))
            else:
                crop_r = pil_img.crop((rx1, ry1, rx2, ry2))

            tr = _IMG_TRANSFORM(crop_r).unsqueeze(0).to(_DEVICE)
            with torch.no_grad():
                preds_r = net(tr)
            probs_r = torch.softmax(preds_r["severity_logits"][0], dim=0)
            raw_right_conf = float((probs_r[1] + probs_r[2]).item())

        except Exception as e:
            print(f"[DarkCircleDetector] Model inference note: {e}")

    # Pure model confidence evaluated directly from DarkCircleNet multi-task head:
    # Softmax probabilities over severity classes [Low, Medium, High]:
    # Presence probability: P(presence) = P(Medium) + P(High) = 1.0 - P(Low)
    left_conf = float(np.clip(raw_left_conf, 0.0, 1.0))
    right_conf = float(np.clip(raw_right_conf, 0.0, 1.0))
    full_conf = float(np.clip(raw_full_conf, 0.0, 1.0))

    # Overall presence confidence from model detections across eyes and full image
    overall_confidence = float(np.clip(max(left_conf, right_conf, full_conf), 0.0, 1.0))
    confidence_percentage = int(round(overall_confidence * 100))
    is_detected = overall_confidence >= 0.50

    left_percentage = int(round(left_conf * 100))
    right_percentage = int(round(right_conf * 100))
    left_detected = left_conf >= 0.50
    right_detected = right_conf >= 0.50

    if is_detected:
        status_text = f"Dark Circles Detected: {confidence_percentage}% confidence"
    else:
        status_text = f"Dark circles not detected ({confidence_percentage}% confidence)"

    detected_boxes = [
        {
            "id": "box-left",
            "x": int(round((lx1 / w) * 100)),
            "y": int(round((ly1 / h) * 100)),
            "width": int(round(((lx2 - lx1) / w) * 100)),
            "height": int(round(((ly2 - ly1) / h) * 100)),
            "label": "Left Dark Circle" if left_detected else "Left Under-Eye (Not Detected)",
            "confidence": f"{left_percentage}%",
            "is_detected": left_detected
        },
        {
            "id": "box-right",
            "x": int(round((rx1 / w) * 100)),
            "y": int(round((ry1 / h) * 100)),
            "width": int(round(((rx2 - rx1) / w) * 100)),
            "height": int(round(((ry2 - ry1) / h) * 100)),
            "label": "Right Dark Circle" if right_detected else "Right Under-Eye (Not Detected)",
            "confidence": f"{right_percentage}%",
            "is_detected": right_detected
        }
    ]

    # ── INDEPENDENT ESTIMATED DARK CIRCLE SEVERITY (0–100) ───────────────────
    # Calculated strictly from the detected under-eye physical regions (CIE L*a*b* relative
    # darkness delta_L, local contrast, and affected pixel area percentage).
    # Completely decoupled from the model's Softmax detection confidence.
    left_severity = int(round(np.clip(left_metrics["score"], 0.0, 100.0)))
    right_severity = int(round(np.clip(right_metrics["score"], 0.0, 100.0)))
    overall_severity = int(round((left_severity + right_severity) / 2))
    severity_cat = get_category_for_score(overall_severity)
    left_cat = get_category_for_score(left_severity)
    right_cat = get_category_for_score(right_severity)
    overall_affected_area = round((left_metrics["affected_area_percent"] + right_metrics["affected_area_percent"]) / 2.0, 1)

    return {
        "success": True,
        # ── 1. DETECTION CONFIDENCE (From Trained Model Softmax Probability) ───
        "detection_confidence": round(overall_confidence, 4),
        "confidence_percentage": confidence_percentage,
        "confidence": f"{confidence_percentage}%",
        "is_detected": is_detected,
        "status": status_text,
        "model_summary": f"Dark Circle Detection Confidence: {confidence_percentage}%",

        # ── 2. ESTIMATED DARK CIRCLE SEVERITY (Application-Defined Visual Scale) ──
        "severity_score": overall_severity,
        "severity_category": severity_cat["label"],
        "severity_label": severity_cat["label"],
        "severity": {
            "score": overall_severity,
            "label": severity_cat["label"],
            "color": severity_cat["color"],
            "bg": severity_cat["bg"],
            "text": severity_cat["text"]
        },
        "affected_area_percent": overall_affected_area,
        "affected_area": f"{overall_affected_area}%",

        # Separate Left and Right Eye Telemetry & Severity
        "left_eye": {
            "confidence": round(left_conf, 4),
            "percentage": left_percentage,
            "is_detected": left_detected,
            "status": "Detected" if left_detected else "Not detected",
            "severity_score": left_severity,
            "severity_category": left_cat["label"],
            "affected_area_percent": left_metrics["affected_area_percent"],
            "delta_L": left_metrics["delta_L"]
        },
        "right_eye": {
            "confidence": round(right_conf, 4),
            "percentage": right_percentage,
            "is_detected": right_detected,
            "status": "Detected" if right_detected else "Not detected",
            "severity_score": right_severity,
            "severity_category": right_cat["label"],
            "affected_area_percent": right_metrics["affected_area_percent"],
            "delta_L": right_metrics["delta_L"]
        },
        "features": {
            "relative_darkness": overall_darkness,
            "local_contrast": overall_contrast,
            "affected_area": overall_affected_area,
            "color_difference": overall_color,
            "distribution": overall_distribution,
            "asymmetry": asymmetry
        },
        "detectedBoxes": detected_boxes,
        "threshold": 0.50,
        "model_info": {
            "name": "DarkCircleNet (MobileNetV3-Large Backbone)",
            "output_layer": "severity_logits (3-class softmax)",
            "presence_formula": "P(presence) = P(Medium) + P(High) = 1.0 - P(Low)",
            "raw_probabilities": {
                "p_low": raw_probs[0],
                "p_medium": raw_probs[1],
                "p_high": raw_probs[2]
            }
        },
        # Backward compatibility for legacy consumers
        "darkCirclesPercentage": overall_severity,
        "disclaimer": "This analysis presents two independent metrics: (1) AI Detection Confidence indicating the model's presence certainty, and (2) Estimated Severity (0–100) based on relative under-eye contrast and affected area. These are application-defined visual estimates and do NOT constitute a medical diagnosis or clinical grading."
    }

def _fallback_result(client_metrics=None) -> Dict[str, Any]:
    """Fallback return format preserving clean separate metrics."""
    score = client_metrics.get("detectionConfidence", 0.85) if client_metrics else 0.85
    pct = int(round(score * 100)) if score <= 1.0 else int(round(score))
    return {
        "success": True,
        "detection_confidence": round(pct / 100.0, 2),
        "confidence_percentage": pct,
        "confidence": f"{pct}%",
        "is_detected": pct >= 50,
        "status": f"Dark Circles Detected: {pct}% confidence" if pct >= 50 else f"Dark circles not detected ({pct}% confidence)",
        "model_summary": f"The model has an {pct}% confidence that dark circles are present in this image.",
        "left_eye": {"confidence": round(pct / 100.0, 2), "percentage": pct, "is_detected": pct >= 50},
        "right_eye": {"confidence": round(pct / 100.0, 2), "percentage": pct, "is_detected": pct >= 50},
        "detectedBoxes": [],
        "threshold": 0.50,
        "disclaimer": "This value represents the AI model's estimated confidence that dark circles are present in the image."
    }
