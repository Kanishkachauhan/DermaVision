"""
Model/models/darkcircle_model.py
---------------------------------
Deep Neural Network for Periorbital Dark Circle Detection & Telemetry.
Trained on Model/DATASET/darkcircle/Dark Circles Detection.v3i.yolov8.

Architecture:
  - Backbone: Lightweight MobileNetV3-Large / EfficientNet-B0 feature extractor
  - Multi-Task Heads:
      1. Percentage Head: Continuous regression of darkness percentage (0 - 100%)
      2. Severity Head: 3-class classification (0: Low, 1: Medium, 2: High)
      3. Bounding Box Head: 8 coordinates [x1, y1, w1, h1, x2, y2, w2, h2] for left & right under-eye zones
      4. Etiology Head: 3-class classification (0: Structural, 1: Pigmented, 2: Vascular)
"""

import os
import torch
import torch.nn as nn
from torchvision.models import mobilenet_v3_large, MobileNet_V3_Large_Weights


class DarkCircleNet(nn.Module):
    def __init__(self, pretrained=True, dropout=0.3):
        super(DarkCircleNet, self).__init__()

        weights = MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
        base = mobilenet_v3_large(weights=weights)

        # Feature extraction backbone (features output: 960 channels)
        self.features = base.features
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        in_features = 960

        # Multi-task heads
        # 1. Percentage Head (0 to 100%)
        self.percentage_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 256),
            nn.ReLU(),
            nn.Dropout(p=0.2),
            nn.Linear(256, 1),
            nn.Sigmoid()  # Multiplied by 100 in forward
        )

        # 2. Severity Classification (0: Low, 1: Medium, 2: High)
        self.severity_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 128),
            nn.ReLU(),
            nn.Linear(128, 3)
        )

        # 3. Bounding Box Regression (Left: x,y,w,h + Right: x,y,w,h in normalized [0, 1])
        self.box_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 256),
            nn.ReLU(),
            nn.Linear(256, 8),
            nn.Sigmoid()  # Constrain boxes to [0, 1]
        )

        # 4. Etiology Classification (0: Structural, 1: Pigmented, 2: Vascular)
        self.etiology_head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 128),
            nn.ReLU(),
            nn.Linear(128, 3)
        )

    def forward(self, x):
        feat = self.features(x)
        feat = self.avgpool(feat)
        feat = torch.flatten(feat, 1)

        pct = self.percentage_head(feat) * 100.0
        sev = self.severity_head(feat)
        boxes = self.box_head(feat)
        etiology = self.etiology_head(feat)

        return {
            "percentage": pct,
            "severity_logits": sev,
            "boxes": boxes,
            "etiology_logits": etiology
        }
