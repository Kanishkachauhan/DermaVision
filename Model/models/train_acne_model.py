"""
Model/models/train_acne_model.py
--------------------------------
Production-grade training pipeline for fine-tuning EfficientNet-B0 / B3 on DermaVision
dermatological skin condition datasets.

Enhancements:
  - Multi-task loss optimization covering all 4 heads:
      1. Acne score regression (MSE Loss)
      2. 3-class severity classification (Focal / Class-Weighted Cross-Entropy Loss)
      3. 4-class condition subtype classification (Cross-Entropy Loss)
      4. Visible pore appearance regression (MSE Loss)
  - True validation loss tracking with model checkpointing on best validation metric
  - Independent test set evaluation computing Accuracy, Macro F1, and MAE
  - Rigorous data augmentation preserving skin texture
"""

import os
import sys
import argparse
import json
import time
from typing import Dict, Any, Tuple
import numpy as np
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, confusion_matrix

# Add parent path to import dataset_loader and models
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import importlib
dataset_module = importlib.import_module("01_dataset.dataset_loader")
get_data_loaders = dataset_module.get_data_loaders
ACNE_SEVERITY_CLASSES = dataset_module.ACNE_SEVERITY_CLASSES
ACNE_TYPE_CLASSES = dataset_module.ACNE_TYPE_CLASSES

from models.efficientnet_acne import EfficientNetAcneClassifier, FocalLoss


def compute_metrics(y_true, y_pred):
    acc = float(accuracy_score(y_true, y_pred))
    f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    prec = float(precision_score(y_true, y_pred, average="macro", zero_division=0))
    rec = float(recall_score(y_true, y_pred, average="macro", zero_division=0))
    return {"accuracy": round(acc, 4), "f1_macro": round(f1, 4), "precision": round(prec, 4), "recall": round(rec, 4)}


def evaluate_loader(model, loader, device, mse_criterion, ce_sev_criterion, ce_sub_criterion):
    model.eval()
    running_loss = 0.0
    total_samples = 0
    score_diffs = []
    pore_diffs = []

    all_sev_true = []
    all_sev_pred = []
    all_sub_true = []
    all_sub_pred = []

    with torch.no_grad():
        for batch in loader:
            images = batch["image"].to(device)
            target_scores = batch["score"].to(device)
            target_sev = batch["severity_class"].to(device)
            target_sub = batch["subtype"].to(device)
            target_pores = batch["pore_score"].to(device)

            outputs = model(images)

            l_score = mse_criterion(outputs["score"], target_scores) / 100.0
            l_sev = ce_sev_criterion(outputs["severity_logits"], target_sev)
            l_sub = ce_sub_criterion(outputs["subtype_logits"], target_sub)
            l_pore = mse_criterion(outputs["pore_score"], target_pores) / 100.0

            loss = (1.2 * l_score) + (1.0 * l_sev) + (0.8 * l_sub) + (0.6 * l_pore)
            bs = images.size(0)
            running_loss += loss.item() * bs
            total_samples += bs

            score_diffs.extend(torch.abs(outputs["score"] - target_scores).cpu().numpy().tolist())
            pore_diffs.extend(torch.abs(outputs["pore_score"] - target_pores).cpu().numpy().tolist())

            sev_preds = torch.argmax(outputs["severity_logits"], dim=-1).cpu().numpy().tolist()
            sub_preds = torch.argmax(outputs["subtype_logits"], dim=-1).cpu().numpy().tolist()

            all_sev_true.extend(target_sev.cpu().numpy().tolist())
            all_sev_pred.extend(sev_preds)
            all_sub_true.extend(target_sub.cpu().numpy().tolist())
            all_sub_pred.extend(sub_preds)

    avg_loss = running_loss / max(1, total_samples)
    mae_score = float(np.mean(score_diffs)) if score_diffs else 0.0
    mae_pore = float(np.mean(pore_diffs)) if pore_diffs else 0.0

    sev_metrics = compute_metrics(all_sev_true, all_sev_pred)
    sub_metrics = compute_metrics(all_sub_true, all_sub_pred)

    return {
        "loss": round(avg_loss, 4),
        "mae_score": round(mae_score, 2),
        "mae_pore": round(mae_pore, 2),
        "severity": sev_metrics,
        "subtype": sub_metrics,
        "total_samples": total_samples,
        "cm_severity": confusion_matrix(all_sev_true, all_sev_pred).tolist()
    }


def train_model(variant="b0", epochs=8, batch_size=16, lr=2e-4, device=None, seed=42):
    if device is None:
        if torch.cuda.is_available():
            device = torch.device("cuda")
        elif torch.backends.mps.is_available():
            device = torch.device("mps")
        else:
            device = torch.device("cpu")

    print(f"==================================================")
    print(f" Training EfficientNet-{variant.upper()} on DermaVision Datasets")
    print(f" Compute Device: {device}")
    print(f" Epochs: {epochs} | Batch Size: {batch_size} | LR: {lr}")
    print(f"==================================================")

    target_size = 300 if variant.lower() == "b3" else 224
    train_loader, valid_loader, test_loader, tr_ds, va_ds, te_ds = get_data_loaders(
        target_size=target_size,
        batch_size=batch_size,
        include_pigmentation=True,
        use_stratified_split=True,
        seed=seed
    )

    print(f"Datasets: {len(tr_ds)} train | {len(va_ds)} valid | {len(te_ds)} test samples.")

    # Calculate class distribution for severity weights
    sev_counts = [0, 0, 0]
    for s in tr_ds.samples:
        sev_counts[s["severity_class"]] += 1
    total_tr = sum(sev_counts)
    sev_weights = torch.tensor([total_tr / (3.0 * max(1, c)) for c in sev_counts], dtype=torch.float32).to(device)

    try:
        model = EfficientNetAcneClassifier(variant=variant, pretrained=True)
    except Exception as e:
        print(f"[Notice] Offline environment detected ({e}). Training EfficientNet-{variant.upper()} architecture directly.")
        model = EfficientNetAcneClassifier(variant=variant, pretrained=False)
    model.to(device)

    # Multi-task criteria
    mse_criterion = nn.MSELoss()
    ce_sev_criterion = FocalLoss(alpha=sev_weights, gamma=1.5)
    ce_sub_criterion = nn.CrossEntropyLoss()

    # Differential learning rates: smaller for pretrained backbone, higher for custom heads
    backbone_params = [p for p in model.features.parameters() if p.requires_grad]
    head_params = [
        p for m in [model.score_head, model.severity_head, model.subtype_head, model.pore_head]
        for p in m.parameters() if p.requires_grad
    ]
    optimizer = AdamW([
        {"params": backbone_params, "lr": lr * 0.2, "weight_decay": 1e-4},
        {"params": head_params, "lr": lr, "weight_decay": 1e-3}
    ])
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    checkpoint_dir = os.path.dirname(__file__)
    save_path = os.path.join(checkpoint_dir, f"efficientnet_acne_{variant.lower()}.pth")

    best_val_loss = float("inf")
    history = []
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        running_loss = 0.0
        running_score_err = 0.0
        running_pore_err = 0.0
        total_samples = 0

        for batch in train_loader:
            images = batch["image"].to(device)
            target_scores = batch["score"].to(device)
            target_sev = batch["severity_class"].to(device)
            target_sub = batch["subtype"].to(device)
            target_pores = batch["pore_score"].to(device)

            optimizer.zero_grad()
            outputs = model(images)

            # 4-head multi-task loss
            loss_score = mse_criterion(outputs["score"], target_scores) / 100.0
            loss_sev = ce_sev_criterion(outputs["severity_logits"], target_sev)
            loss_sub = ce_sub_criterion(outputs["subtype_logits"], target_sub)
            loss_pore = mse_criterion(outputs["pore_score"], target_pores) / 100.0

            total_loss = (1.2 * loss_score) + (1.0 * loss_sev) + (0.8 * loss_sub) + (0.6 * loss_pore)
            total_loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
            optimizer.step()

            bs = images.size(0)
            running_loss += total_loss.item() * bs
            running_score_err += torch.abs(outputs["score"] - target_scores).sum().item()
            running_pore_err += torch.abs(outputs["pore_score"] - target_pores).sum().item()
            total_samples += bs

        scheduler.step()

        train_loss = running_loss / max(1, total_samples)
        train_mae_score = running_score_err / max(1, total_samples)
        train_mae_pore = running_pore_err / max(1, total_samples)

        # Validation phase
        val_eval = evaluate_loader(model, valid_loader, device, mse_criterion, ce_sev_criterion, ce_sub_criterion)

        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] "
            f"TrLoss: {train_loss:.4f} | TrMAE: {train_mae_score:.1f} || "
            f"ValLoss: {val_eval['loss']:.4f} | ValMAE: {val_eval['mae_score']:.1f} | "
            f"ValAcc(Sev): {val_eval['severity']['accuracy']:.1%} | ValF1: {val_eval['severity']['f1_macro']:.2f}"
        )

        history.append({
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "train_mae_score": round(train_mae_score, 2),
            "val_loss": val_eval["loss"],
            "val_mae_score": val_eval["mae_score"],
            "val_severity_acc": val_eval["severity"]["accuracy"],
            "val_severity_f1": val_eval["severity"]["f1_macro"]
        })

        if val_eval["loss"] < best_val_loss:
            best_val_loss = val_eval["loss"]
            torch.save(model.state_dict(), save_path)
            print(f"  --> [Saved Best Model] ValLoss={best_val_loss:.4f} to: {save_path}")

    elapsed = round(time.time() - start_time, 2)
    print(f"\nTraining completed in {elapsed}s. Best model saved to: {save_path}")

    # Load best checkpoint for independent test evaluation
    print("\n--- Running Evaluation on Independent Test Set (55 Unseen Samples) ---")
    model.load_state_dict(torch.load(save_path, map_location=device, weights_only=True))
    test_eval = evaluate_loader(model, test_loader, device, mse_criterion, ce_sev_criterion, ce_sub_criterion)

    print(f"Test Set Results:")
    print(f"  Loss: {test_eval['loss']:.4f}")
    print(f"  Acne Score MAE: {test_eval['mae_score']:.2f} points")
    print(f"  Pore Score MAE: {test_eval['mae_pore']:.2f} points")
    print(f"  Severity 3-Class Accuracy: {test_eval['severity']['accuracy']:.2%}")
    print(f"  Severity Macro F1-Score: {test_eval['severity']['f1_macro']:.4f}")
    print(f"  Subtype 4-Class Accuracy: {test_eval['subtype']['accuracy']:.2%}")
    print(f"  Subtype Macro F1-Score: {test_eval['subtype']['f1_macro']:.4f}")
    print(f"  Confusion Matrix (Severity):\n    {test_eval['cm_severity']}")

    # Save detailed metadata
    metadata = {
        "variant": variant.upper(),
        "architecture": f"EfficientNet-{variant.upper()} Multi-Task Dermal Diagnostic Network",
        "checkpoint": os.path.basename(save_path),
        "training_samples": len(tr_ds),
        "validation_samples": len(va_ds),
        "test_samples": len(te_ds),
        "target_size": target_size,
        "epochs": epochs,
        "best_val_loss": round(best_val_loss, 4),
        "test_metrics": {
            "loss": test_eval["loss"],
            "acne_mae": test_eval["mae_score"],
            "pore_mae": test_eval["mae_pore"],
            "severity_accuracy": test_eval["severity"]["accuracy"],
            "severity_f1_macro": test_eval["severity"]["f1_macro"],
            "severity_precision": test_eval["severity"]["precision"],
            "severity_recall": test_eval["severity"]["recall"],
            "subtype_accuracy": test_eval["subtype"]["accuracy"],
            "subtype_f1_macro": test_eval["subtype"]["f1_macro"],
            "confusion_matrix_severity": test_eval["cm_severity"]
        },
        "classes": {
            "severity": ACNE_SEVERITY_CLASSES,
            "subtypes": ACNE_TYPE_CLASSES
        },
        "temperature_calibration": 1.25,
        "training_time_seconds": elapsed,
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    meta_path = os.path.join(checkpoint_dir, f"metadata_efficientnet_{variant.lower()}.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved evaluation metadata to: {meta_path}")

    return save_path, metadata


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train EfficientNet on Acne & Skin condition datasets")
    parser.add_argument("--variant", type=str, default="b0", choices=["b0", "b3"], help="EfficientNet variant (b0 or b3)")
    parser.add_argument("--epochs", type=int, default=6, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=2e-4, help="Learning rate")
    args = parser.parse_args()

    train_model(variant=args.variant, epochs=args.epochs, batch_size=args.batch_size, lr=args.lr)
