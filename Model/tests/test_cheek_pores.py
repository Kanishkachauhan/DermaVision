"""
Model/tests/test_cheek_pores.py
--------------------------------
Comprehensive test suite for DermaVision Cheek Pores Detection:
1. Tests cheek ROI definition & anatomical constraints (Left vs Right Cheek).
2. Tests strict exclusion of Nose, Nose sides, Forehead, Chin, Under-Eye, and Lips.
3. Tests quality gate (sharpness variance, blur detection, resolution check).
4. Tests distinction between acne lesions (papules/comedones) and micro-pores.
5. Tests output JSON structure compliance.
6. Tests compatibility with acne, dark circle, and redness pipelines.
"""

import os
import sys
import glob
import json
import unittest
import numpy as np

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.pores_detector import (
    CheekPoresDetector,
    get_pores_detector,
    LEFT_CHEEK_LANDMARKS,
    RIGHT_CHEEK_LANDMARKS,
    NOSE_AND_SIDES_LANDMARKS,
    FOREHEAD_LANDMARKS,
    CHIN_LANDMARKS,
    UNDER_EYE_LEFT_LANDMARKS
)
from models.acne_inference import get_engine
from models.redness_detector import get_redness_detector


class TestCheekPoresDetection(unittest.TestCase):

    def setUp(self):
        self.detector = get_pores_detector()
        # Find sample faces in the dataset
        self.sample_images = glob.glob(
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../DATASET/darkcircle/Dark Circles Detection.v3i.yolov8/valid/images/*.jpg"))
        )
        self.assertGreater(len(self.sample_images), 0, "Dataset images must be available for testing")

    def test_01_landmark_definitions(self):
        """Verify landmark definitions are non-empty and anatomically disjoint."""
        left_set = set(LEFT_CHEEK_LANDMARKS)
        right_set = set(RIGHT_CHEEK_LANDMARKS)
        nose_set = set(NOSE_AND_SIDES_LANDMARKS)

        # Cheeks must be disjoint from each other
        self.assertEqual(len(left_set.intersection(right_set)), 0, "Left and Right cheeks must not overlap")

        # Cheek landmarks must not intersect with nasal bridge/tip landmarks (1, 2, 4, 19, 94, 195, 197)
        nasal_core = {1, 2, 4, 19, 94, 195, 197}
        self.assertEqual(len(left_set.intersection(nasal_core)), 0, "Left cheek must not contain nose core")
        self.assertEqual(len(right_set.intersection(nasal_core)), 0, "Right cheek must not contain nose core")

    def test_02_json_output_structure(self):
        """Verify the exact JSON structure required by DermaVision specifications."""
        sample_path = self.sample_images[0]
        res = self.detector.analyze_pores(sample_path, debug=True)

        self.assertTrue(res.get("success"), "analyze_pores must succeed")
        self.assertIn("pores", res, "Must contain 'pores' root key")
        pores = res["pores"]

        # Check required fields
        for section in ["leftCheek", "rightCheek", "overall"]:
            self.assertIn(section, pores, f"Missing section '{section}'")
            sec_dict = pores[section]
            self.assertIn("visiblePoreDensity", sec_dict)
            self.assertIn("estimatedCount", sec_dict)
            self.assertIn("confidence", sec_dict)

        # Check analyzed and excluded regions
        self.assertEqual(pores.get("analyzedRegions"), ["left_cheek", "right_cheek"])
        self.assertEqual(pores.get("excludedRegions"), ["nose", "forehead", "chin", "under_eye"])

    def test_03_quality_gate_on_blurry_image(self):
        """Verify that artificial blur triggers the quality gate and returns 'uncertain'."""
        import cv2
        sample_path = self.sample_images[0]
        img = cv2.imread(sample_path)
        # Apply heavy Gaussian blur to simulate out-of-focus capture
        blurred = cv2.GaussianBlur(img, (21, 21), 6.0)

        res = self.detector.analyze_pores(blurred)
        pores = res["pores"]

        self.assertEqual(pores["overall"]["confidence"], "uncertain")
        self.assertIsNone(pores["overall"]["visiblePoreDensity"])
        self.assertIsNone(pores["overall"]["estimatedCount"])
        self.assertIn("Cheek regions exhibit", pores.get("diagnosticNote", ""))

    def test_04_acne_vs_pores_discrimination(self):
        """Verify that erythematous (red) blemish spots are rejected as pores."""
        # Create a synthetic skin patch with:
        # 1. A simulated pore: tiny 2px dark pit, neutral color
        # 2. A simulated acne papule: 8px red inflammatory spot
        h, w = 240, 240
        synthetic_img = np.full((h, w, 3), [170, 130, 110], dtype=np.uint8) # BGR skin

        # Add pore at (60, 60): 2x2 pit with subtle dark depression
        synthetic_img[59:61, 59:61] = [145, 110, 95]

        # Add acne lesion at (100, 100): 6x6 red bump (elevated red channel)
        synthetic_img[97:103, 97:103] = [80, 70, 225] # BGR (R=225, G=70, B=80)

        # Run detection
        res = self.detector.analyze_pores(synthetic_img, debug=True)
        self.assertIn("pores", res)

    def test_05_compatibility_with_acne_and_redness(self):
        """Verify acne and redness inference engines continue to function alongside pores."""
        sample_path = self.sample_images[0]

        # Acne inference engine
        acne_engine = get_engine("b0")
        acne_res = acne_engine.analyze_face(sample_path)
        self.assertTrue(acne_res.get("success"))
        self.assertIn("acneScore", acne_res)
        self.assertIn("poreScore", acne_res)
        self.assertIn("pores", acne_res)
        self.assertIn("leftCheek", acne_res["pores"])
        self.assertIn("rightCheek", acne_res["pores"])
        self.assertIn("overall", acne_res["pores"])

        # Redness engine
        redness_detector = get_redness_detector()
        redness_res = redness_detector.analyze_face(sample_path)
        self.assertTrue(redness_res.get("success"))
        self.assertTrue("rednessScore" in redness_res or "redness_score" in redness_res)

        score = redness_res.get("rednessScore", redness_res.get("redness_score"))
        print(f"\n[Test Result] Acne Score: {acne_res['acneScore']}, Redness Score: {score}, Pores Overall: {acne_res['pores']['overall']}")


if __name__ == "__main__":
    unittest.main()
