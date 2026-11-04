"""
Model/audit_redness_model.py
----------------------------
Independent evaluation & audit of Hugging Face model:
`varun1505/face-characteristics` for facial redness detection.

Evaluates:
  1. Official HF model example images (including official `images/skin_redness.jpg`)
  2. Ground-truth annotated redness images (Roboflow redness dataset)
  3. Ground-truth non-redness control images (Dark circle / acne / normal facial datasets)
  4. Accuracy, Precision, Recall, Confusion Matrix, and Threshold Sensitivity analysis
"""

import os
import glob
import json
import urllib.request
import io
import torch
import numpy as np
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification

LOCAL_MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "models/face_characteristics"))

def run_audit():
    print("=" * 80)
    print("DERMAVISION: AUDIT & VERIFICATION OF varun1505/face-characteristics")
    print("=" * 80)

    # 1. Load model & processor
    device = torch.device("mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu"))
    print(f"[*] Hardware Execution Device: {device}")

    try:
        processor = AutoImageProcessor.from_pretrained(LOCAL_MODEL_DIR)
        model = AutoModelForImageClassification.from_pretrained(LOCAL_MODEL_DIR)
        model.to(device)
        model.eval()
        print("[+] Model & Image Processor loaded successfully from local storage.")
    except Exception as e:
        print(f"[-] FAILED to load model: {e}")
        return

    # Check configuration
    print(f"[*] Model Architecture: {model.__class__.__name__}")
    print(f"[*] id2label dictionary: {model.config.id2label}")
    print(f"[*] Number of classes: {model.config.num_labels}")
    
    redness_id = None
    for k, v in model.config.id2label.items():
        if v.lower() == "skin redness":
            redness_id = int(k)
            break
    print(f"[*] Identified 'skin redness' Class ID: {redness_id}")

    test_records = []

    # 2. Official Hugging Face Example Images
    print("\n--- TEST GROUP A: Official Hugging Face Example Images ---")
    hf_images = [
        ("skin_redness.jpg", True, "Official positive redness example"),
        ("acne.jpg", False, "Acne confound image"),
        ("eyes_dark_circles.jpg", False, "Dark circles control"),
        ("puffy_eyes.jpg", False, "Puffy eyes control"),
        ("skin_pigmentation.jpg", False, "Pigmentation confound"),
        ("skin_texture.jpg", False, "Skin texture control"),
        ("wrinkled_face.jpg", False, "Wrinkles control")
    ]
    base_hf_url = "https://huggingface.co/varun1505/face-characteristics/resolve/main/images/"

    for img_name, is_red, note in hf_images:
        url = base_hf_url + img_name
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read()
                pil_img = Image.open(io.BytesIO(raw)).convert("RGB")
            
            inputs = processor(images=pil_img, return_tensors="pt")
            inputs = {k: v.to(device) for k, v in inputs.items()}
            with torch.no_grad():
                out = model(**inputs)
                logits = out.logits[0]
                probs = torch.nn.functional.softmax(logits, dim=-1).cpu().numpy()
            
            top_id = int(np.argmax(probs))
            top_label = model.config.id2label[top_id]
            top_conf = float(probs[top_id])
            red_score = float(probs[redness_id])
            red_logit = float(logits[redness_id].cpu().item())
            
            match = (top_id == redness_id) if is_red else (top_id != redness_id)

            test_records.append({
                "group": "Official HF Examples",
                "id": f"HF: {img_name}",
                "expected_redness": is_red,
                "note": note,
                "top_prediction": top_label,
                "top_confidence": round(top_conf, 4),
                "redness_score": round(red_score, 4),
                "redness_logit": round(red_logit, 3),
                "top1_matches_expected": match,
                "threshold_0_20_detected": red_score >= 0.20,
                "threshold_0_30_detected": red_score >= 0.30
            })
            print(f"  {img_name:24} -> Top-1: {top_label:18} ({top_conf:.3f}) | Redness Prob: {red_score:.4f} | Match: {match}")
        except Exception as e:
            print(f"  [-] Failed testing {img_name}: {e}")

    # 3. Ground-Truth Redness Images (Roboflow Redness Dataset)
    print("\n--- TEST GROUP B: Ground-Truth Labeled Redness Images ---")
    pos_paths = glob.glob("Model/DATASET/redness/redness.v1i.yolov8/valid/images/*.jpg")
    if len(pos_paths) < 15:
        pos_paths += glob.glob("Model/DATASET/redness/redness.v1i.yolov8/train/images/*.jpg")[:(20 - len(pos_paths))]

    for p in pos_paths[:15]:
        fname = os.path.basename(p)
        try:
            pil_img = Image.open(p).convert("RGB")
            inputs = processor(images=pil_img, return_tensors="pt")
            inputs = {k: v.to(device) for k, v in inputs.items()}
            with torch.no_grad():
                out = model(**inputs)
                logits = out.logits[0]
                probs = torch.nn.functional.softmax(logits, dim=-1).cpu().numpy()

            top_id = int(np.argmax(probs))
            top_label = model.config.id2label[top_id]
            top_conf = float(probs[top_id])
            red_score = float(probs[redness_id])
            red_logit = float(logits[redness_id].cpu().item())
            match = (top_id == redness_id)

            test_records.append({
                "group": "Ground-Truth Redness",
                "id": fname,
                "expected_redness": True,
                "note": "Roboflow Redness Ground-Truth",
                "top_prediction": top_label,
                "top_confidence": round(top_conf, 4),
                "redness_score": round(red_score, 4),
                "redness_logit": round(red_logit, 3),
                "top1_matches_expected": match,
                "threshold_0_20_detected": red_score >= 0.20,
                "threshold_0_30_detected": red_score >= 0.30
            })
            print(f"  {fname[:30]:30} -> Top-1: {top_label:18} ({top_conf:.3f}) | Redness Prob: {red_score:.4f} | Top1=Redness: {match}")
        except Exception as e:
            print(f"  [-] Error testing {fname}: {e}")

    # 4. Negative Control Images (Dark Circles / Clear Facial Images)
    print("\n--- TEST GROUP C: Negative Control Images (No Redness / Other Features) ---")
    neg_paths = glob.glob("Model/DATASET/darkcircle/Dark Circles Detection.v3i.yolov8/valid/images/*.jpg")[:15]

    for p in neg_paths:
        fname = os.path.basename(p)
        try:
            pil_img = Image.open(p).convert("RGB")
            inputs = processor(images=pil_img, return_tensors="pt")
            inputs = {k: v.to(device) for k, v in inputs.items()}
            with torch.no_grad():
                out = model(**inputs)
                logits = out.logits[0]
                probs = torch.nn.functional.softmax(logits, dim=-1).cpu().numpy()

            top_id = int(np.argmax(probs))
            top_label = model.config.id2label[top_id]
            top_conf = float(probs[top_id])
            red_score = float(probs[redness_id])
            red_logit = float(logits[redness_id].cpu().item())
            match = (top_id != redness_id)

            test_records.append({
                "group": "Negative Controls",
                "id": fname,
                "expected_redness": False,
                "note": "Periorbital Dark Circles / Normal Face",
                "top_prediction": top_label,
                "top_confidence": round(top_conf, 4),
                "redness_score": round(red_score, 4),
                "redness_logit": round(red_logit, 3),
                "top1_matches_expected": match,
                "threshold_0_20_detected": red_score >= 0.20,
                "threshold_0_30_detected": red_score >= 0.30
            })
            print(f"  {fname[:30]:30} -> Top-1: {top_label:18} ({top_conf:.3f}) | Redness Prob: {red_score:.4f} | Correct Rejection: {match}")
        except Exception as e:
            print(f"  [-] Error testing {fname}: {e}")

    # 5. Statistical Aggregation
    print("\n" + "=" * 80)
    print("AUDIT EVALUATION SUMMARY & METRICS")
    print("=" * 80)
    
    total_samples = len(test_records)
    positives = [r for r in test_records if r["expected_redness"] is True]
    negatives = [r for r in test_records if r["expected_redness"] is False]
    
    print(f"Total Evaluated Images: {total_samples}")
    print(f"  - Positive (Redness) Ground-Truth: {len(positives)}")
    print(f"  - Negative (Non-Redness Controls): {len(negatives)}")

    # Top-1 metrics
    pos_top1_correct = sum(1 for r in positives if r["top1_matches_expected"])
    neg_top1_correct = sum(1 for r in negatives if r["top1_matches_expected"])
    overall_top1_acc = (pos_top1_correct + neg_top1_correct) / total_samples

    print(f"\n[Top-1 Argmax Classification Performance]:")
    print(f"  - True Positive Top-1 Hit Rate (Sensitivity/Recall): {pos_top1_correct}/{len(positives)} ({pos_top1_correct/len(positives)*100:.1f}%)")
    print(f"  - True Negative Top-1 Rejection Rate (Specificity): {neg_top1_correct}/{len(negatives)} ({neg_top1_correct/len(negatives)*100:.1f}%)")
    print(f"  - Overall Accuracy: {pos_top1_correct + neg_top1_correct}/{total_samples} ({overall_top1_acc*100:.1f}%)")

    # Score distribution
    pos_scores = [r["redness_score"] for r in positives]
    neg_scores = [r["redness_score"] for r in negatives]

    print(f"\n[Redness Softmax Probability Distribution]:")
    print(f"  - Positives: Mean = {np.mean(pos_scores):.4f}, Std = {np.std(pos_scores):.4f}, Min = {np.min(pos_scores):.4f}, Max = {np.max(pos_scores):.4f}")
    print(f"  - Negatives: Mean = {np.mean(neg_scores):.4f}, Std = {np.std(neg_scores):.4f}, Min = {np.min(neg_scores):.4f}, Max = {np.max(neg_scores):.4f}")

    # Threshold evaluation
    for th in [0.15, 0.20, 0.25, 0.30]:
        tp = sum(1 for r in positives if r["redness_score"] >= th)
        fp = sum(1 for r in negatives if r["redness_score"] >= th)
        fn = len(positives) - tp
        tn = len(negatives) - fp
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * (prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
        print(f"  - Threshold >= {th:.2f}: TP={tp:2d}, FP={fp:2d}, TN={tn:2d}, FN={fn:2d} | Prec={prec*100:.1f}%, Rec={rec*100:.1f}%, F1={f1*100:.1f}%")

    # Save results to json
    results_path = os.path.join(os.path.dirname(__file__), "redness_audit_results.json")
    with open(results_path, "w") as f:
        json.dump({
            "total_samples": total_samples,
            "metrics": {
                "top1_sensitivity": round(pos_top1_correct/len(positives), 4),
                "top1_specificity": round(neg_top1_correct/len(negatives), 4),
                "top1_overall_accuracy": round(overall_top1_acc, 4),
                "pos_mean_score": round(float(np.mean(pos_scores)), 4),
                "neg_mean_score": round(float(np.mean(neg_scores)), 4),
            },
            "records": test_records
        }, f, indent=2)
    print(f"\n[+] Detailed benchmark report saved to: {results_path}")

if __name__ == "__main__":
    run_audit()
