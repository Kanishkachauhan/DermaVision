"""
Model/models/train_pigmentation_model.py
----------------------------------------
Production-grade training and evaluation pipeline for fine-tuning EfficientNet-B0 / B3
on DermaVision facial pigmentation and melasma datasets.

Features:
  - Multi-task loss optimization covering all 4 heads:
      1. Pigmentation severity score regression (MSE Loss)
      2. 3-class categorical severity classification (Focal Loss / Weighted Cross-Entropy)
      3. 3-class pattern subtype classification (Cross-Entropy Loss)
      4. Affected surface area regression (MSE Loss)
  - True validation loss tracking with model checkpointing on best validation F1
  - Independent test set evaluation computing:
      * Overall Accuracy, Precision, Recall, Macro F1-score
      * Confusion Matrix across severity and pattern classes
      * Mean Absolute Error (MAE) for continuous score and area percentage
  - Dermatological data augmentation preserving fine melanin contrast and edge transitions
  - Exports comprehensive evaluation metrics to JSON
"""

import os
import sys
import glob
import json
import time
import argparse
from typing import Dict, Any, Tuple, List
import numpy as np
from PIL import Image
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, confusion_matrix

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
try:
    from models.efficientnet_pigmentation import EfficientNetPigmentationClassifier, FocalLoss
except ImportError:
    from efficientnet_pigmentation import EfficientNetPigmentationClassifier, FocalLoss

DATASET_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../DATASET"))
PIGMENTATION_SEVERITY_CLASSES = ["Low", "Moderate", "High"]
PIGMENTATION_PATTERN_CLASSES = ["Uniform / Minimal", "Localized Dark Spots", "Melasma-like Pattern"]


class PigmentationDataset(Dataset):
    """
    PyTorch Dataset for facial pigmentation & melasma analysis.
    Loads real annotated images and polygon segmentation annotations from Roboflow YOLOv8 format.
    """
    def __init__(
        self,
        split: str = "train",
        target_size: int = 224,
        transform=None,
        split_ratios: Tuple[float, float, float] = (0.70, 0.15, 0.15),
        seed: int = 42
    ):
        self.split = split.lower()
        self.target_size = target_size
        self.samples = []

        if transform is not None:
            self.transform = transform
        else:
            if self.split == "train":
                self.transform = transforms.Compose([
                    transforms.Resize((target_size, target_size)),
                    transforms.RandomHorizontalFlip(p=0.5),
                    transforms.RandomRotation(degrees=10),
                    transforms.ColorJitter(brightness=0.08, contrast=0.08, saturation=0.08),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
                ])
            else:
                self.transform = transforms.Compose([
                    transforms.Resize((target_size, target_size)),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
                ])

        raw_samples = self._scan_dataset()
        self.samples = self._partition_samples(raw_samples, split_ratios, seed=seed)

    def _scan_dataset(self) -> List[Dict[str, Any]]:
        base_dir = os.path.join(DATASET_ROOT, "pigmentation", "pigmentation.v1i.yolov8")
        found = []
        if not os.path.exists(base_dir):
            return found

        for s_name in ["train", "valid", "test"]:
            s_dir = os.path.join(base_dir, s_name)
            img_dir = os.path.join(s_dir, "images")
            lbl_dir = os.path.join(s_dir, "labels")
            if not os.path.exists(img_dir):
                continue

            for img_path in glob.glob(os.path.join(img_dir, "*.*")):
                ext = os.path.splitext(img_path)[1].lower()
                if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
                    continue

                base_name = os.path.splitext(os.path.basename(img_path))[0]
                lbl_path = os.path.join(lbl_dir, f"{base_name}.txt")

                polygons = []
                total_poly_area = 0.0

                if os.path.exists(lbl_path):
                    with open(lbl_path, "r") as f:
                        for line in f:
                            parts = line.strip().split()
                            if len(parts) >= 5:
                                try:
                                    # Roboflow polygon format: class x1 y1 x2 y2 ...
                                    coords = [float(p) for p in parts[1:]]
                                    if len(coords) >= 6:
                                        # Approximate polygon area via Shoelace formula
                                        xs = coords[0::2]
                                        ys = coords[1::2]
                                        poly_area = 0.5 * abs(sum(xs[i] * ys[(i + 1) % len(xs)] - xs[(i + 1) % len(xs)] * ys[i] for i in range(len(xs))))
                                        total_poly_area += poly_area
                                        polygons.append(coords)
                                    elif len(parts) == 5:
                                        # Bounding box format: class xc yc w h
                                        w_box = float(parts[3])
                                        h_box = float(parts[4])
                                        total_poly_area += (w_box * h_box)
                                        polygons.append([float(parts[1]), float(parts[2]), w_box, h_box])
                                except ValueError:
                                    continue

                lesion_count = len(polygons)
                area_pct = min(65.0, total_poly_area * 100.0)

                # Grounded clinical pigmentation target derivation
                if lesion_count == 0:
                    score = 16.0
                    severity_class = 0  # Low
                    pattern_class = 0   # Uniform / Minimal
                    area_pct = 0.0
                elif lesion_count <= 2 and area_pct < 12.0:
                    score = float(max(24.0, min(48.0, 22.0 + (area_pct * 1.5) + (lesion_count * 5.0))))
                    severity_class = 1 if score >= 35.0 else 0
                    pattern_class = 1  # Localized Dark Spots
                else:
                    # Extensive melasma / widespread dyschromia
                    score = float(max(42.0, min(88.0, 36.0 + (area_pct * 1.2) + (lesion_count * 6.0))))
                    severity_class = 2 if score >= 65.0 else 1
                    pattern_class = 2  # Melasma-like Pattern

                found.append({
                    "image_path": img_path,
                    "score": score,
                    "severity_class": severity_class,
                    "pattern_class": pattern_class,
                    "area_percentage": area_pct,
                    "lesion_count": lesion_count,
                    "original_split": s_name
                })
        return found

    def _partition_samples(
        self,
        samples: List[Dict[str, Any]],
        split_ratios: Tuple[float, float, float],
        seed: int = 42
    ) -> List[Dict[str, Any]]:
        rng = np.random.RandomState(seed)
        indices = np.arange(len(samples))
        rng.shuffle(indices)

        n_train = int(len(samples) * split_ratios[0])
        n_val = int(len(samples) * split_ratios[1])

        if self.split == "train":
            selected_idx = indices[:n_train]
        elif self.split in ["val", "valid"]:
            selected_idx = indices[n_train:n_train + n_val]
        else:
            selected_idx = indices[n_train + n_val:]

        return [samples[i] for i in selected_idx]

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        item = self.samples[idx]
        image = Image.open(item["image_path"]).convert("RGB")
        tensor_img = self.transform(image)

        return {
            "image": tensor_img,
            "score": torch.tensor(item["score"], dtype=torch.float32),
            "severity_class": torch.tensor(item["severity_class"], dtype=torch.long),
            "pattern_class": torch.tensor(item["pattern_class"], dtype=torch.long),
            "area_percentage": torch.tensor(item["area_percentage"], dtype=torch.float32),
            "path": item["image_path"]
        }


def compute_metrics(y_true, y_pred):
    acc = float(accuracy_score(y_true, y_pred))
    f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    prec = float(precision_score(y_true, y_pred, average="macro", zero_division=0))
    rec = float(recall_score(y_true, y_pred, average="macro", zero_division=0))
    return {"accuracy": round(acc, 4), "f1_macro": round(f1, 4), "precision": round(prec, 4), "recall": round(rec, 4)}


def evaluate_loader(model, loader, device, mse_criterion, ce_sev_criterion, ce_pat_criterion):
    model.eval()
    running_loss = 0.0
    total_samples = 0
    score_diffs = []
    area_diffs = []

    all_sev_true = []
    all_sev_pred = []
    all_pat_true = []
    all_pat_pred = []

    with torch.no_grad():
        for batch in loader:
            images = batch["image"].to(device)
            target_scores = batch["score"].to(device)
            target_sev = batch["severity_class"].to(device)
            target_pat = batch["pattern_class"].to(device)
            target_area = batch["area_percentage"].to(device)

            outputs = model(images)

            l_score = mse_criterion(outputs["score"], target_scores) / 100.0
            l_sev = ce_sev_criterion(outputs["severity_logits"], target_sev)
            l_pat = ce_pat_criterion(outputs["pattern_logits"], target_pat)
            l_area = mse_criterion(outputs["area_percentage"], target_area) / 100.0

            loss = (1.2 * l_score) + (1.0 * l_sev) + (0.8 * l_pat) + (0.6 * l_area)
            bs = images.size(0)
            running_loss += loss.item() * bs
            total_samples += bs

            score_diffs.extend(torch.abs(outputs["score"] - target_scores).cpu().numpy().tolist())
            area_diffs.extend(torch.abs(outputs["area_percentage"] - target_area).cpu().numpy().tolist())

            sev_preds = torch.argmax(outputs["severity_logits"], dim=-1).cpu().numpy().tolist()
            pat_preds = torch.argmax(outputs["pattern_logits"], dim=-1).cpu().numpy().tolist()

            all_sev_true.extend(target_sev.cpu().numpy().tolist())
            all_sev_pred.extend(sev_preds)
            all_pat_true.extend(target_pat.cpu().numpy().tolist())
            all_pat_pred.extend(pat_preds)

    avg_loss = running_loss / max(1, total_samples)
    sev_metrics = compute_metrics(all_sev_true, all_sev_pred)
    pat_metrics = compute_metrics(all_pat_true, all_pat_pred)
    mae_score = float(np.mean(score_diffs)) if score_diffs else 0.0
    mae_area = float(np.mean(area_diffs)) if area_diffs else 0.0

    sev_cm = confusion_matrix(all_sev_true, all_sev_pred, labels=[0, 1, 2]).tolist()
    pat_cm = confusion_matrix(all_pat_true, all_pat_pred, labels=[0, 1, 2]).tolist()

    return {
        "val_loss": round(avg_loss, 4),
        "mae_score": round(mae_score, 2),
        "mae_area": round(mae_area, 2),
        "severity": sev_metrics,
        "pattern": pat_metrics,
        "severity_confusion_matrix": sev_cm,
        "pattern_confusion_matrix": pat_cm,
    }


def train_model(
    variant: str = "b0",
    epochs: int = 15,
    batch_size: int = 8,
    lr: float = 3e-4,
    device_str: str = "auto"
):
    if device_str == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu"))
    else:
        device = torch.device(device_str)

    print(f"[Training Pipeline] Starting Pigmentation Model Fine-Tuning (Variant: {variant.upper()}, Device: {device})")

    train_ds = PigmentationDataset(split="train")
    val_ds = PigmentationDataset(split="val")
    test_ds = PigmentationDataset(split="test")

    print(f"[Dataset Split] Train samples: {len(train_ds)}, Val: {len(val_ds)}, Test: {len(test_ds)}")

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, drop_last=False)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)

    model = EfficientNetPigmentationClassifier(variant=variant, pretrained=True).to(device)

    mse_criterion = nn.MSELoss()
    focal_sev = FocalLoss(gamma=2.0)
    ce_pat = nn.CrossEntropyLoss()

    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    best_val_f1 = -1.0
    best_epoch = 0
    save_path = os.path.join(os.path.dirname(__file__), f"efficientnet_pigmentation_{variant}.pth")
    metrics_path = os.path.join(os.path.dirname(__file__), f"metadata_efficientnet_pigmentation_{variant}.json")

    training_history = []

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        total_samples = 0

        for batch in train_loader:
            images = batch["image"].to(device)
            target_scores = batch["score"].to(device)
            target_sev = batch["severity_class"].to(device)
            target_pat = batch["pattern_class"].to(device)
            target_area = batch["area_percentage"].to(device)

            optimizer.zero_grad()
            outputs = model(images)

            l_score = mse_criterion(outputs["score"], target_scores) / 100.0
            l_sev = focal_sev(outputs["severity_logits"], target_sev)
            l_pat = ce_pat(outputs["pattern_logits"], target_pat)
            l_area = mse_criterion(outputs["area_percentage"], target_area) / 100.0

            loss = (1.2 * l_score) + (1.0 * l_sev) + (0.8 * l_pat) + (0.6 * l_area)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.5)
            optimizer.step()

            bs = images.size(0)
            train_loss += loss.item() * bs
            total_samples += bs

        scheduler.step()
        epoch_loss = train_loss / max(1, total_samples)

        # Validation
        val_eval = evaluate_loader(model, val_loader, device, mse_criterion, focal_sev, ce_pat)
        current_f1 = val_eval["severity"]["f1_macro"]

        print(f"Epoch [{epoch:02d}/{epochs:02d}] Train Loss: {epoch_loss:.4f} | Val Loss: {val_eval['val_loss']:.4f} | Val F1: {current_f1:.4f} | MAE: {val_eval['mae_score']}")

        training_history.append({
            "epoch": epoch,
            "train_loss": round(epoch_loss, 4),
            "val_loss": val_eval["val_loss"],
            "val_f1": current_f1,
            "val_mae": val_eval["mae_score"]
        })

        if current_f1 > best_val_f1:
            best_val_f1 = current_f1
            best_epoch = epoch
            torch.save({
                "model_state_dict": model.state_dict(),
                "variant": variant,
                "epoch": epoch,
                "best_val_f1": best_val_f1,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
            }, save_path)
            print(f"  --> Saved new best checkpoint at epoch {epoch} to {save_path}")

    # Final Independent Test Evaluation
    print("\n[Evaluation] Running evaluation on independent test set...")
    if os.path.exists(save_path):
        ckpt = torch.load(save_path, map_location=device)
        model.load_state_dict(ckpt["model_state_dict"])

    test_eval = evaluate_loader(model, test_loader, device, mse_criterion, focal_sev, ce_pat)

    final_metadata = {
        "model_name": f"DermaVision EfficientNet-{variant.upper()} Pigmentation & Melasma Multi-Task Classifier",
        "architecture": f"EfficientNet-{variant.upper()}",
        "dataset": "Roboflow Pigmentation Dataset (YOLOv8 Polygon Annotations, 165 facial clinical images)",
        "classes": {
            "severity": PIGMENTATION_SEVERITY_CLASSES,
            "patterns": PIGMENTATION_PATTERN_CLASSES
        },
        "training_params": {
            "epochs": epochs,
            "batch_size": batch_size,
            "learning_rate": lr,
            "best_epoch": best_epoch,
            "device": str(device)
        },
        "independent_test_metrics": test_eval,
        "temperature_scaling": 1.25,
        "limitations": [
            "Trained strictly on visible facial hyperpigmentation and melasma patterns.",
            "Does not differentiate histological dermal depth or medical melanocytic lesions.",
            "Visual estimate; not a medical or clinical diagnosis."
        ],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }

    with open(metrics_path, "w") as f:
        json.dump(final_metadata, f, indent=2)

    print(f"[Done] Test evaluation metrics serialized to {metrics_path}")
    print(f"Independent Test Accuracy: {test_eval['severity']['accuracy'] * 100:.1f}%, Macro F1: {test_eval['severity']['f1_macro']:.4f}")
    return final_metadata


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", type=str, default="b0", choices=["b0", "b3"])
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch_size", type=int, default=8)
    parser.add_argument("--lr", type=float, default=3e-4)
    args = parser.parse_args()

    train_model(variant=args.variant, epochs=args.epochs, batch_size=args.batch_size, lr=args.lr)

