"""
Model/models/efficientnet_acne.py
---------------------------------
EfficientNet-B0 and EfficientNet-B3 Deep Neural Network for
Acne & Dermatological Condition Analysis.

Architecture:
  - Feature Extractor Backbone:
      * EfficientNet-B0 (1280-dim) / EfficientNet-B3 (1536-dim)
      * Initialized with official PyTorch ImageNet pretrained weights
  - Multi-Task Dermal Analysis Heads:
      1. Score Regression Head: predicts 0-100 continuous clinical severity
      2. Severity Classification Head: 3-class (0: Low, 1: Moderate, 2: High)
      3. Condition Subtype Head: 4-class (0: Non-Inflammatory, 1: Mixed, 2: Inflammatory, 3: Vascular)
      4. Pore Appearance Head: predicts continuous visible pore appearance index (0-100)
  - Temperature Scaling Calibration:
      * Softmax calibration with learnable / calibrated temperature parameter T
      * Calibrated prediction probabilities separating model confidence from condition severity
"""

import os
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import (
    efficientnet_b0, EfficientNet_B0_Weights,
    efficientnet_b3, EfficientNet_B3_Weights
)


class FocalLoss(nn.Module):
    """
    Multi-class Focal Loss to counter class imbalance by down-weighting easy examples
    and focusing training on hard dermatological blemish instances.
    """
    def __init__(self, alpha=None, gamma=2.0, reduction="mean"):
        super(FocalLoss, self).__init__()
        self.alpha = alpha  # class weights tensor
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, inputs, targets):
        ce_loss = F.cross_entropy(inputs, targets, weight=self.alpha, reduction="none")
        pt = torch.exp(-ce_loss)
        focal_loss = ((1.0 - pt) ** self.gamma) * ce_loss
        if self.reduction == "mean":
            return focal_loss.mean()
        elif self.reduction == "sum":
            return focal_loss.sum()
        return focal_loss


class EfficientNetAcneClassifier(nn.Module):
    def __init__(self, variant="b0", pretrained=True, dropout=0.3, temperature=1.25):
        super(EfficientNetAcneClassifier, self).__init__()
        self.variant = variant.lower()
        self.temperature = float(temperature)

        if self.variant == "b3":
            weights = EfficientNet_B3_Weights.DEFAULT if pretrained else None
            base_model = efficientnet_b3(weights=weights)
            in_features = base_model.classifier[1].in_features  # 1536
        else:
            # Default to B0
            weights = EfficientNet_B0_Weights.DEFAULT if pretrained else None
            base_model = efficientnet_b0(weights=weights)
            in_features = base_model.classifier[1].in_features  # 1280

        # Feature extractor backbone
        self.features = base_model.features
        self.avgpool = base_model.avgpool

        # 1. Continuous severity score (0 - 100)
        self.score_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 256),
            nn.BatchNorm1d(256),
            nn.SiLU(),
            nn.Dropout(p=0.2),
            nn.Linear(256, 1),
            nn.Sigmoid()  # Multiplied by 100 in forward pass
        )

        # 2. 3-class Severity (0: Low, 1: Moderate, 2: High)
        self.severity_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 128),
            nn.BatchNorm1d(128),
            nn.SiLU(),
            nn.Linear(128, 3)
        )

        # 3. 4-class Subtype (0: Non-inflammatory, 1: Mixed, 2: Inflammatory, 3: Vascular)
        self.subtype_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 128),
            nn.BatchNorm1d(128),
            nn.SiLU(),
            nn.Linear(128, 4)
        )

        # 4. Pore appearance index (0 - 100)
        self.pore_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 128),
            nn.BatchNorm1d(128),
            nn.SiLU(),
            nn.Linear(128, 1),
            nn.Sigmoid()
        )

        # Initialize new head weights
        self._init_heads()

    def _init_heads(self):
        for m in [self.score_head, self.severity_head, self.subtype_head, self.pore_head]:
            for layer in m.modules():
                if isinstance(layer, nn.Linear):
                    nn.init.kaiming_normal_(layer.weight, mode="fan_out", nonlinearity="relu")
                    if layer.bias is not None:
                        nn.init.constant_(layer.bias, 0.0)
                elif isinstance(layer, nn.BatchNorm1d):
                    nn.init.constant_(layer.weight, 1.0)
                    nn.init.constant_(layer.bias, 0.0)

    def extract_features(self, x):
        feats = self.features(x)
        pooled = self.avgpool(feats)
        flattened = torch.flatten(pooled, 1)
        return flattened

    def forward(self, x):
        features = self.extract_features(x)

        score = self.score_head(features) * 100.0
        severity_logits = self.severity_head(features)
        subtype_logits = self.subtype_head(features)
        pore_score = self.pore_head(features) * 100.0

        return {
            "score": score.squeeze(-1),
            "severity_logits": severity_logits,
            "subtype_logits": subtype_logits,
            "pore_score": pore_score.squeeze(-1),
            "features": features
        }

    def predict_calibrated(self, x, temperature=None):
        """
        Executes forward pass and returns temperature-scaled calibrated probabilities.
        """
        T = temperature if temperature is not None else self.temperature
        outputs = self.forward(x)

        calibrated_sev = F.softmax(outputs["severity_logits"] / T, dim=-1)
        calibrated_subtype = F.softmax(outputs["subtype_logits"] / T, dim=-1)

        return {
            "score": outputs["score"],
            "severity_probs": calibrated_sev,
            "subtype_probs": calibrated_subtype,
            "pore_score": outputs["pore_score"],
            "severity_confidence": torch.max(calibrated_sev, dim=-1)[0],
            "subtype_confidence": torch.max(calibrated_subtype, dim=-1)[0]
        }


def build_acne_model(variant="b0", pretrained=True, checkpoint_path=None, device="cpu"):
    """
    Factory function to initialize and optionally load trained weights.
    """
    model = EfficientNetAcneClassifier(variant=variant, pretrained=pretrained)
    if checkpoint_path and os.path.exists(checkpoint_path):
        try:
            state_dict = torch.load(checkpoint_path, map_location=device, weights_only=True)
            model.load_state_dict(state_dict)
            print(f"[EfficientNet] Successfully loaded trained checkpoint from {checkpoint_path}")
        except Exception as e:
            print(f"[EfficientNet] Warning: Could not load checkpoint from {checkpoint_path}: {e}")
    model.to(device)
    model.eval()
    return model
