"""
Model/models/efficientnet_pigmentation.py
----------------------------------------
EfficientNet-B0 and EfficientNet-B3 Deep Neural Network for
Facial Pigmentation, Melasma, and Melanin Dyschromia Analysis.

Architecture:
  - Feature Extractor Backbone:
      * EfficientNet-B0 (1280-dim) / EfficientNet-B3 (1536-dim)
      * Initialized with official PyTorch ImageNet pretrained weights
  - Multi-Task Dermatological Pigmentation Heads:
      1. Score Regression Head: predicts 0-100 continuous clinical pigmentation severity
      2. Severity Classification Head: 3-class (0: Low, 1: Moderate, 2: High)
      3. Pattern Subtype Head: 3-class (0: Uniform / Minimal, 1: Localized Dark Spots, 2: Melasma-like Pattern)
      4. Affected Area Percentage Head: predicts continuous estimated visible surface area (0-100%)
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
    and focusing training on hard dermatological pigmentation instances.
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


class EfficientNetPigmentationClassifier(nn.Module):
    def __init__(self, variant="b0", pretrained=True, dropout=0.3, temperature=1.25):
        super(EfficientNetPigmentationClassifier, self).__init__()
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

        # 1. Continuous pigmentation severity score (0 - 100)
        self.score_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 256),
            nn.BatchNorm1d(256),
            nn.SiLU(),
            nn.Dropout(p=0.2),
            nn.Linear(256, 1),
            nn.Sigmoid()
        )

        # 2. Categorical severity head (3-class: 0: Low, 1: Moderate, 2: High)
        self.severity_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 128),
            nn.BatchNorm1d(128),
            nn.SiLU(),
            nn.Dropout(p=0.15),
            nn.Linear(128, 3)
        )

        # 3. Pigmentation pattern head (3-class: 0: Uniform, 1: Localized Spots, 2: Melasma Pattern)
        self.pattern_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 128),
            nn.BatchNorm1d(128),
            nn.SiLU(),
            nn.Dropout(p=0.15),
            nn.Linear(128, 3)
        )

        # 4. Estimated visible pigmentation area percentage (0 - 100%)
        self.area_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 128),
            nn.BatchNorm1d(128),
            nn.SiLU(),
            nn.Dropout(p=0.15),
            nn.Linear(128, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        features = self.features(x)
        pooled = self.avgpool(features)
        flat = torch.flatten(pooled, 1)

        score = self.score_head(flat) * 100.0
        severity_logits = self.severity_head(flat)
        pattern_logits = self.pattern_head(flat)
        area_pct = self.area_head(flat) * 100.0

        return {
            "score": score.squeeze(-1),
            "severity_logits": severity_logits,
            "pattern_logits": pattern_logits,
            "area_percentage": area_pct.squeeze(-1),
            "embedding": flat
        }

    def predict_calibrated(self, x):
        """
        Returns calibrated prediction probabilities using temperature scaling.
        Decouples model confidence from severity.
        """
        self.eval()
        with torch.no_grad():
            outputs = self.forward(x)
            sev_logits = outputs["severity_logits"] / self.temperature
            sev_probs = F.softmax(sev_logits, dim=-1)

            pat_logits = outputs["pattern_logits"] / self.temperature
            pat_probs = F.softmax(pat_logits, dim=-1)

            sev_conf, sev_pred = torch.max(sev_probs, dim=-1)
            pat_conf, pat_pred = torch.max(pat_probs, dim=-1)

            return {
                "score": outputs["score"].cpu().numpy(),
                "severity_class": sev_pred.cpu().numpy(),
                "severity_confidence": sev_conf.cpu().numpy(),
                "severity_probabilities": sev_probs.cpu().numpy(),
                "pattern_class": pat_pred.cpu().numpy(),
                "pattern_confidence": pat_conf.cpu().numpy(),
                "pattern_probabilities": pat_probs.cpu().numpy(),
                "area_percentage": outputs["area_percentage"].cpu().numpy()
            }

