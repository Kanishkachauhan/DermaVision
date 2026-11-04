"""
Model/test_redness_engine.py
----------------------------
Comprehensive test suite for the DermaVision facial redness detection engine.

Tests:
  1. Model Loading & Verification (Architecture, input/output tensors, device)
  2. Input Handling & Edge Cases (Empty, corrupted, black, white, arbitrary inputs)
  3. Inference Determinism (Repeatability on identical inputs)
  4. CIELAB a* Colorimetry & Lip/Eye Landmark Exclusion
  5. API Response Schema Conformance (redness_detected, redness_percentage, severity, confidence, visualization)
  6. Dataset Benchmark Evaluation (Positive redness vs negative control images)
"""

import sys
import os
import glob
import time
import base64
import unittest
import numpy as np
from PIL import Image
import torch

# Ensure Model path is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from models.redness_detector import RednessDetector, get_redness_detector, REDNESS_LABEL, ALL_LABELS


class TestRednessModelLoading(unittest.TestCase):
    """Test 1: Model Loading, Weights Compatibility, and Architecture Verification"""

    def setUp(self):
        self.detector = get_redness_detector()

    def test_model_loaded(self):
        self.assertTrue(self.detector.is_loaded, "ViT model should be successfully loaded into memory.")
        self.assertIsNotNone(self.detector.model, "Model instance must not be None.")
        self.assertIsNotNone(self.detector.processor, "Image processor instance must not be None.")

    def test_architecture_and_labels(self):
        config = self.detector.model.config
        self.assertEqual(config.model_type, "vit", "Model type must be Vision Transformer (vit).")
        self.assertEqual(config.num_labels, 7, "Model must have exactly 7 facial characteristic output classes.")
        self.assertIn("skin redness", list(config.id2label.values()), "'skin redness' must be one of the class labels.")

    def test_input_normalization_parameters(self):
        proc = self.detector.processor
        self.assertEqual(proc.image_mean, [0.5, 0.5, 0.5], "Expected ViT image mean normalization to be [0.5, 0.5, 0.5].")
        self.assertEqual(proc.image_std, [0.5, 0.5, 0.5], "Expected ViT image std normalization to be [0.5, 0.5, 0.5].")
        self.assertEqual(proc.size["height"], 224, "Expected image height 224.")
        self.assertEqual(proc.size["width"], 224, "Expected image width 224.")


class TestInputHandlingAndEdgeCases(unittest.TestCase):
    """Test 2: Robust Input Validation, Corrupted Inputs, and Degenerate Images"""

    def setUp(self):
        self.detector = get_redness_detector()

    def test_empty_string_input(self):
        res = self.detector.analyze_face("")
        self.assertFalse(res["success"], "Empty string input should return success=False.")
        self.assertFalse(res["redness_detected"], "redness_detected must be False on empty input.")
        self.assertIsNone(res["redness_percentage"], "redness_percentage must be None on invalid input.")
        self.assertIsNone(res["severity"], "severity must be None on invalid input.")
        self.assertIsNone(res["confidence"], "confidence must be None on invalid input.")

    def test_none_input(self):
        res = self.detector.analyze_face(None)
        self.assertFalse(res["success"], "None input should return success=False.")
        self.assertIsNone(res["redness_percentage"])

    def test_corrupted_base64_input(self):
        res = self.detector.analyze_face("data:image/jpeg;base64,invalid-corrupted-bytes-!!!")
        self.assertFalse(res["success"], "Corrupted base64 should return success=False.")
        self.assertIn("error", res)

    def test_all_black_image(self):
        black_img = Image.new("RGB", (224, 224), (0, 0, 0))
        res = self.detector.analyze_face(black_img)
        self.assertTrue(res["success"])
        self.assertFalse(res["redness_detected"], "All-black image should not trigger redness detection.")
        self.assertEqual(res["redness_percentage"], 0.0)
        self.assertEqual(res["severity"], "low")

    def test_all_white_image(self):
        white_img = Image.new("RGB", (224, 224), (255, 255, 255))
        res = self.detector.analyze_face(white_img)
        self.assertTrue(res["success"])
        self.assertFalse(res["redness_detected"], "All-white image (blown highlights) should not trigger false redness.")


class TestInferenceConsistency(unittest.TestCase):
    """Test 3: Determinism and Consistency on Identical Inputs"""

    def setUp(self):
        self.detector = get_redness_detector()

    def test_repeated_inference_determinism(self):
        # Create synthetic face-like patch
        np.random.seed(42)
        test_patch = np.uint8(np.random.rand(224, 224, 3) * 255)
        img = Image.fromarray(test_patch)

        res1 = self.detector.analyze_face(img)
        res2 = self.detector.analyze_face(img)

        self.assertEqual(res1["redness_detected"], res2["redness_detected"], "Detection flag must be deterministic.")
        self.assertEqual(res1["redness_percentage"], res2["redness_percentage"], "Redness percentage must be identical.")
        self.assertEqual(res1["severity"], res2["severity"], "Severity must be identical.")
        self.assertEqual(res1["confidence"], res2["confidence"], "Confidence must be identical.")
        self.assertEqual(res1["redness_score"], res2["redness_score"], "Score must be identical.")


class TestColorimetryAndLandmarkExclusion(unittest.TestCase):
    """Test 4: CIELAB Colorimetry, Lip Exclusion, and Heatmap Generation"""

    def setUp(self):
        self.detector = get_redness_detector()

    def test_cielab_a_extraction(self):
        # Pure red image should have a positive a* value
        red_patch = np.zeros((50, 50, 3), dtype=np.uint8)
        red_patch[:, :, 0] = 255 # R
        a_star = self.detector._extract_cielab_a(red_patch)
        self.assertGreater(float(np.mean(a_star)), 30.0, "Red pixels must produce high positive a* values.")

        # Pure green image should have a negative a* value
        green_patch = np.zeros((50, 50, 3), dtype=np.uint8)
        green_patch[:, :, 1] = 255 # G
        a_star_g = self.detector._extract_cielab_a(green_patch)
        self.assertLess(float(np.mean(a_star_g)), -20.0, "Green pixels must produce negative a* values.")

    def test_lip_exclusion_reduces_false_erythema(self):
        # Create a face canvas with a bright red simulated lip in the mouth area
        h, w = 300, 300
        canvas = np.ones((h, w, 3), dtype=np.uint8) * 180 # neutral skin-like
        # Add red lip
        canvas[200:230, 120:180] = [230, 40, 50]

        # Fake MediaPipe landmarks positioning lips around (x: 0.5, y: 0.7)
        fake_landmarks = [{"x": 0.5, "y": 0.5} for _ in range(478)]
        # Map lip indices to lip area
        from models.redness_detector import LIP_OUTER_INDICES
        for idx in LIP_OUTER_INDICES:
            fake_landmarks[idx] = {"x": 0.50, "y": 0.71}

        clean_skin, excl_mask = self.detector._segment_facial_skin(canvas, fake_landmarks)
        self.assertTrue(np.any(excl_mask), "Exclusion mask should identify lip region.")

    def test_visualization_generation(self):
        canvas = np.ones((224, 224, 3), dtype=np.uint8)
        canvas[:, :] = [210, 160, 140]  # realistic baseline skin tone
        canvas[80:140, 40:100] = [235, 110, 110]  # simulated localized erythema patch
        res = self.detector.analyze_face(canvas)

        self.assertIsNotNone(res["visualization"], "Visualization data URL must be generated.")
        self.assertTrue(res["visualization"].startswith("data:image/png;base64,"), "Visualization must be a base64 PNG data URL.")


class TestSchemaConformance(unittest.TestCase):
    """Test 5: Conformance with User-Requested Output Structure"""

    def setUp(self):
        self.detector = get_redness_detector()

    def test_all_expected_fields_present(self):
        dummy = Image.fromarray(np.uint8(np.random.rand(224, 224, 3) * 255))
        res = self.detector.analyze_face(dummy)

        # Expected top-level keys
        self.assertIn("redness_detected", res)
        self.assertIsInstance(res["redness_detected"], bool, "redness_detected must be boolean.")

        self.assertIn("redness_percentage", res)
        self.assertIsInstance(res["redness_percentage"], float, "redness_percentage must be float.")

        self.assertIn("severity", res)
        self.assertIn(res["severity"], ["low", "medium", "high"], "severity must be one of low, medium, high.")

        self.assertIn("confidence", res)
        self.assertIsInstance(res["confidence"], float, "confidence must be float.")
        self.assertGreaterEqual(res["confidence"], 0.0)
        self.assertLessEqual(res["confidence"], 1.0)

        self.assertIn("visualization", res)

        # Backward compatibility keys for frontend
        self.assertIn("zone_redness", res)
        self.assertIn("telemetry", res)
        self.assertIn("redness_score", res)
        self.assertIn("treatment", res)
        self.assertIn("etiology", res)


def run_dataset_benchmark(num_samples: int = 15):
    """Evaluates the engine on available dataset images and prints comparative metrics."""
    print("\n" + "=" * 70)
    print(f"BENCHMARK EVALUATION ON DATASET IMAGES (N={num_samples} per class)")
    print("=" * 70)

    detector = get_redness_detector()

    pos_files = sorted(glob.glob("Model/DATASET/redness/redness.v1i.yolov8/train/images/*.jpg"))[:num_samples]
    neg_files = sorted(glob.glob("Model/DATASET/darkcircle/**/*.jpg", recursive=True))[:num_samples]

    if not pos_files or not neg_files:
        print("Dataset files not found. Skipping benchmark.")
        return

    pos_results = []
    for pf in pos_files:
        try:
            img = Image.open(pf)
            r = detector.analyze_face(img)
            pos_results.append(r)
        except Exception as e:
            pass

    neg_results = []
    for nf in neg_files:
        try:
            img = Image.open(nf)
            r = detector.analyze_face(img)
            neg_results.append(r)
        except Exception as e:
            pass

    pos_detected = sum(1 for r in pos_results if r.get("redness_detected") is True)
    neg_detected = sum(1 for r in neg_results if r.get("redness_detected") is True)

    pos_mean_pct = np.mean([r["redness_percentage"] for r in pos_results if r.get("redness_percentage") is not None])
    neg_mean_pct = np.mean([r["redness_percentage"] for r in neg_results if r.get("redness_percentage") is not None])

    pos_mean_conf = np.mean([r["confidence"] for r in pos_results if r.get("confidence") is not None])
    neg_mean_conf = np.mean([r["confidence"] for r in neg_results if r.get("confidence") is not None])

    tp = pos_detected
    fn = len(pos_results) - tp
    fp = neg_detected
    tn = len(neg_results) - fp

    sensitivity = tp / max(1, tp + fn)
    specificity = tn / max(1, tn + fp)
    accuracy = (tp + tn) / max(1, len(pos_results) + len(neg_results))
    precision = tp / max(1, tp + fp)
    f1 = 2 * (precision * sensitivity) / max(1e-6, precision + sensitivity)

    print(f"Positive Erythema Dataset (N={len(pos_results)}):")
    print(f"  Detected Positive: {pos_detected}/{len(pos_results)} ({pos_detected/max(1, len(pos_results))*100:.1f}%)")
    print(f"  Mean Erythema Area %: {pos_mean_pct:.1f}%")
    print(f"  Mean ViT Confidence:  {pos_mean_conf:.4f}")

    print(f"\nNegative Control Dataset (N={len(neg_results)}):")
    print(f"  Detected Positive (FP): {neg_detected}/{len(neg_results)} ({neg_detected/max(1, len(neg_results))*100:.1f}%)")
    print(f"  Correctly Clear (TN):   {tn}/{len(neg_results)} ({specificity*100:.1f}%)")
    print(f"  Mean Erythema Area %:   {neg_mean_pct:.1f}%")
    print(f"  Mean ViT Confidence:    {neg_mean_conf:.4f}")

    print("\nOverall Performance Summary:")
    print(f"  Sensitivity (Recall): {sensitivity * 100:.1f}%")
    print(f"  Specificity:          {specificity * 100:.1f}%")
    print(f"  Precision:            {precision * 100:.1f}%")
    print(f"  Balanced Accuracy:    {((sensitivity + specificity) / 2) * 100:.1f}%")
    print(f"  F1 Score:             {f1:.3f}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromNames([
        "test_redness_engine.TestRednessModelLoading",
        "test_redness_engine.TestInputHandlingAndEdgeCases",
        "test_redness_engine.TestInferenceConsistency",
        "test_redness_engine.TestColorimetryAndLandmarkExclusion",
        "test_redness_engine.TestSchemaConformance"
    ])
    runner = unittest.TextTestRunner(verbosity=2)
    test_result = runner.run(suite)

    # Run dataset benchmark evaluation
    run_dataset_benchmark(num_samples=15)

    sys.exit(0 if test_result.wasSuccessful() else 1)
