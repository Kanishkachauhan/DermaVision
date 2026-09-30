"""
Model/models/efficientnet_acne.py
---------------------------------
EfficientNet-B0 and EfficientNet-B3 multi-task deep neural network for
Acne & Dermatological Condition Analysis.

Architecture:
- EfficientNet Backbone (B0: 1280-dim, B3: 1536-dim)
- Multi-task heads:
    1. Score Regression Head: predicts 0-100 continuous clinical severity
    2. Severity Classification Head: 3-class (Low, Medium, High)
    3. Condition Subtype Head: 4-class (Non-Inflammatory, Mixed, Inflammatory, Vascular)
    4. Pore / Roughness Head: predicts texture variance & pore dilation
"""

import torch
import torch.nn as nn
from torchvision.models import (
    efficientnet_b0, EfficientNet_B0_Weights,
    efficientnet_b3, EfficientNet_B3_Weights
)

class EfficientNetAcneClassifier(nn.Module):
    def __init__(self, variant="b0", pretrained=True, dropout=0.3):
        super(EfficientNetAcneClassifier, self).__init__()
        self.variant = variant.lower()

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

        # Multi-task heads
        # 1. Continuous severity score (0 - 100)
        self.score_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 256),
            nn.ReLU(),
            nn.Dropout(p=0.2),
            nn.Linear(256, 1),
            nn.Sigmoid()  # Multiplied by 100 in forward
        )

        # 2. 3-class Severity (0: Low, 1: Medium, 2: High)
        self.severity_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 128),
            nn.ReLU(),
            nn.Linear(128, 3)
        )

        # 3. 4-class Subtype (0: Non-inflammatory, 1: Mixed, 2: Inflammatory, 3: Vascular)
        self.subtype_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 128),
            nn.ReLU(),
            nn.Linear(128, 4)
        )

        # 4. Pore dilation & texture index (0 - 100)
        self.pore_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

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


def build_acne_model(variant="b0", pretrained=True, checkpoint_path=None, device="cpu"):
    """
    Factory function to initialize and optionally load trained weights.
    """
    model = EfficientNetAcneClassifier(variant=variant, pretrained=pretrained)
    if checkpoint_path:
        try:
            state_dict = torch.load(checkpoint_path, map_location=device, weights_only=True)
            model.load_state_dict(state_dict)
            print(f"Loaded trained checkpoint from {checkpoint_path}")
        except Exception as e:
            print(f"Warning: Could not load checkpoint from {checkpoint_path}: {e}")
    model.to(device)
    model.eval()
    return model
