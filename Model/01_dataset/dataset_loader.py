"""
01_dataset/dataset_loader.py
----------------------------
Comprehensive dataset loader and PyTorch Dataset builder for DermaVision.
Loads annotated dermatology images from:
  - Model/DATASET/redness/redness.v1i.yolov8 (Acne erythema, inflammation, vascular lesions)
  - Model/DATASET/pigmentation/pigmentation.v1i.yolov8 (Melasma & hyperpigmentation)
  - Model/DATASET/darkcircle/Dark Circles Detection.v3i.yolov8 (Periorbital dark circles)
"""

import os
import glob
from PIL import Image
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms

DATASET_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../DATASET"))

# Clinical classification mappings
ACNE_SEVERITY_CLASSES = ["Low", "Medium", "High"]
ACNE_TYPE_CLASSES = [
    "Non-Inflammatory (Comedonal)",
    "Mixed (Comedonal + Mild Inflammatory)",
    "Inflammatory (Papulopustular)",
    "Vascular Erythema / Rosacea"
]

class AcneSkinDataset(Dataset):
    """
    PyTorch Dataset for Acne & Skin Condition analysis using EfficientNet-B0 / B3.
    Extracts multi-task labels:
      1. Continuous severity score (0 - 100)
      2. Severity classification class (0: Low, 1: Medium, 2: High)
      3. Condition subtype (0: Comedonal, 1: Mixed, 2: Inflammatory, 3: Vascular)
      4. Lesion density / count
    """
    def __init__(self, split="train", target_size=224, transform=None, include_pigmentation=True):
        self.split = split
        self.target_size = target_size
        self.samples = []

        # Default transforms if not provided
        if transform is not None:
            self.transform = transform
        else:
            if split == "train":
                self.transform = transforms.Compose([
                    transforms.Resize((target_size, target_size)),
                    transforms.RandomHorizontalFlip(p=0.5),
                    transforms.RandomRotation(degrees=10),
                    transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
                ])
            else:
                self.transform = transforms.Compose([
                    transforms.Resize((target_size, target_size)),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
                ])

        # Load redness / acne dataset
        redness_dir = os.path.join(DATASET_ROOT, "redness", "redness.v1i.yolov8", split)
        self._load_yolo_split(redness_dir, dataset_type="redness")

        # Optionally load pigmentation dataset for diverse skin condition representation
        if include_pigmentation:
            pigment_dir = os.path.join(DATASET_ROOT, "pigmentation", "pigmentation.v1i.yolov8", split)
            self._load_yolo_split(pigment_dir, dataset_type="pigmentation")

    def _load_yolo_split(self, split_dir, dataset_type="redness"):
        if not os.path.exists(split_dir):
            return

        images_dir = os.path.join(split_dir, "images")
        labels_dir = os.path.join(split_dir, "labels")

        for img_path in glob.glob(os.path.join(images_dir, "*.*")):
            ext = os.path.splitext(img_path)[1].lower()
            if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
                continue

            base_name = os.path.splitext(os.path.basename(img_path))[0]
            label_file = os.path.join(labels_dir, f"{base_name}.txt")

            boxes = []
            classes = []
            total_bbox_area = 0.0

            if os.path.exists(label_file):
                with open(label_file, "r") as f:
                    for line in f:
                        parts = line.strip().split()
                        if len(parts) >= 5:
                            cls_id = int(parts[0])
                            # YOLO format: cls, cx, cy, w, h
                            w, h = float(parts[3]), float(parts[4])
                            classes.append(cls_id)
                            boxes.append((float(parts[1]), float(parts[2]), w, h))
                            total_bbox_area += (w * h)

            lesion_count = len(boxes)

            # Compute clinical severity score (0 to 100) based on lesion count, bounding box area, and class
            if dataset_type == "redness":
                # Class 2: inflammatory, Class 4: vascular, Class 0/3: mild/erythema
                has_inflammatory = 2 in classes
                has_vascular = 4 in classes

                # Area contribution (scaled)
                area_factor = min(50.0, total_bbox_area * 120.0)
                count_factor = min(35.0, lesion_count * 8.0)
                type_bonus = 20.0 if has_inflammatory else (15.0 if has_vascular else 10.0)

                raw_score = area_factor + count_factor + type_bonus
                score = float(max(15.0, min(95.0, raw_score)))

                # Subtype
                if has_inflammatory:
                    subtype = 2  # Inflammatory
                elif has_vascular:
                    subtype = 3  # Vascular
                elif score > 45:
                    subtype = 1  # Mixed
                else:
                    subtype = 0  # Non-inflammatory / mild
            else:
                # Pigmentation / melasma
                score = float(max(20.0, min(85.0, (total_bbox_area * 90.0) + (lesion_count * 10.0) + 15.0)))
                subtype = 1  # Mixed

            # Severity tier: 0 = Low (<35), 1 = Medium (35-68), 2 = High (>68)
            if score < 35.0:
                severity_class = 0
            elif score <= 68.0:
                severity_class = 1
            else:
                severity_class = 2

            self.samples.append({
                "image_path": img_path,
                "score": score,
                "severity_class": severity_class,
                "subtype": subtype,
                "lesion_count": lesion_count,
                "boxes": boxes,
                "dataset_type": dataset_type
            })

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
            "subtype": torch.tensor(item["subtype"], dtype=torch.long),
            "lesion_count": torch.tensor(item["lesion_count"], dtype=torch.float32),
            "path": item["image_path"]
        }


def get_data_loaders(target_size=224, batch_size=16, include_pigmentation=True):
    """
    Creates train, validation, and test DataLoaders for EfficientNet training.
    """
    train_dataset = AcneSkinDataset(split="train", target_size=target_size, include_pigmentation=include_pigmentation)
    valid_dataset = AcneSkinDataset(split="valid", target_size=target_size, include_pigmentation=include_pigmentation)
    test_dataset  = AcneSkinDataset(split="test",  target_size=target_size, include_pigmentation=include_pigmentation)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, drop_last=False)
    valid_loader = DataLoader(valid_dataset, batch_size=batch_size, shuffle=False) if len(valid_dataset) > 0 else None
    test_loader  = DataLoader(test_dataset,  batch_size=batch_size, shuffle=False) if len(test_dataset) > 0 else None

    return train_loader, valid_loader, test_loader, train_dataset, valid_dataset


if __name__ == "__main__":
    train_loader, valid_loader, test_loader, tr_ds, va_ds = get_data_loaders(target_size=224, batch_size=8)
    print(f"Loaded {len(tr_ds)} training samples, {len(va_ds)} validation samples.")
    batch = next(iter(train_loader))
    print("Batch images shape:", batch["image"].shape)
    print("Batch scores:", batch["score"][:4])
    print("Batch severity classes:", batch["severity_class"][:4])
    print("Batch subtypes:", batch["subtype"][:4])
