"""
Model/models/train_acne_model.py
--------------------------------
Training pipeline for fine-tuning EfficientNet-B0 / B3 on the DermaVision
dermatological acne and skin condition datasets.
"""

import os
import sys
import argparse
import json
import time
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

# Add parent path to import dataset_loader and model
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import importlib
dataset_module = importlib.import_module("01_dataset.dataset_loader")
get_data_loaders = dataset_module.get_data_loaders
ACNE_SEVERITY_CLASSES = dataset_module.ACNE_SEVERITY_CLASSES
ACNE_TYPE_CLASSES = dataset_module.ACNE_TYPE_CLASSES
from models.efficientnet_acne import EfficientNetAcneClassifier


def train_model(variant="b0", epochs=10, batch_size=16, lr=1e-4, device=None):
    if device is None:
        if torch.backends.mps.is_available():
            device = torch.device("mps")
        elif torch.cuda.is_available():
            device = torch.device("cuda")
        else:
            device = torch.device("cpu")

    print(f"==================================================")
    print(f" Training EfficientNet-{variant.upper()} on DermaVision Datasets")
    print(f" Compute Device: {device}")
    print(f" Epochs: {epochs} | Batch Size: {batch_size} | LR: {lr}")
    print(f"==================================================")

    target_size = 300 if variant.lower() == "b3" else 224
    train_loader, valid_loader, test_loader, tr_ds, va_ds = get_data_loaders(
        target_size=target_size,
        batch_size=batch_size,
        include_pigmentation=True
    )

    model = EfficientNetAcneClassifier(variant=variant, pretrained=True)
    model.to(device)

    # Losses
    mse_criterion = nn.MSELoss()
    ce_criterion = nn.CrossEntropyLoss()

    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=1e-2)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    best_loss = float("inf")
    checkpoint_dir = os.path.dirname(__file__)
    save_path = os.path.join(checkpoint_dir, f"efficientnet_acne_{variant.lower()}.pth")

    history = []
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        running_loss = 0.0
        running_score_err = 0.0
        total_samples = 0

        for batch in train_loader:
            images = batch["image"].to(device)
            target_scores = batch["score"].to(device)
            target_sev = batch["severity_class"].to(device)
            target_subtype = batch["subtype"].to(device)

            optimizer.zero_grad()
            outputs = model(images)

            # Combined multi-task loss
            loss_score = mse_criterion(outputs["score"], target_scores) / 100.0  # normalize scale
            loss_sev = ce_criterion(outputs["severity_logits"], target_sev)
            loss_subtype = ce_criterion(outputs["subtype_logits"], target_subtype)

            total_loss = (1.5 * loss_score) + (1.0 * loss_sev) + (0.8 * loss_subtype)
            total_loss.backward()
            optimizer.step()

            bs = images.size(0)
            running_loss += total_loss.item() * bs
            score_err = torch.abs(outputs["score"] - target_scores).sum().item()
            running_score_err += score_err
            total_samples += bs

        scheduler.step()

        epoch_loss = running_loss / max(1, total_samples)
        mae = running_score_err / max(1, total_samples)

        print(f"Epoch [{epoch:02d}/{epochs:02d}] - Loss: {epoch_loss:.4f} | MAE Score: {mae:.2f}")

        history.append({
            "epoch": epoch,
            "loss": round(epoch_loss, 4),
            "mae": round(mae, 2)
        })

        if epoch_loss < best_loss:
            best_loss = epoch_loss
            torch.save(model.state_dict(), save_path)
            print(f"  --> Checkpoint saved: {save_path} (Loss: {best_loss:.4f})")

    elapsed = round(time.time() - start_time, 2)
    print(f"Training completed in {elapsed}s. Best model saved to: {save_path}")

    # Save metadata
    metadata = {
        "variant": variant.upper(),
        "architecture": f"EfficientNet-{variant.upper()} Multi-Task",
        "checkpoint": os.path.basename(save_path),
        "total_samples": len(tr_ds),
        "target_size": target_size,
        "epochs": epochs,
        "best_loss": round(best_loss, 4),
        "final_mae": round(history[-1]["mae"], 2),
        "classes": {
            "severity": ACNE_SEVERITY_CLASSES,
            "subtypes": ACNE_TYPE_CLASSES
        },
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    meta_path = os.path.join(checkpoint_dir, f"metadata_efficientnet_{variant.lower()}.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return save_path, metadata

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train EfficientNet on Acne & Skin condition datasets")
    parser.add_argument("--variant", type=str, default="b0", choices=["b0", "b3"], help="EfficientNet variant (b0 or b3)")
    parser.add_argument("--epochs", type=int, default=8, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    args = parser.parse_args()

    train_model(variant=args.variant, epochs=args.epochs, batch_size=args.batch_size, lr=args.lr)
