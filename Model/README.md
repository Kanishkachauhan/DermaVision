# 🔬 DermaVision AI Models & Pipelines

This directory organizes the end-to-end Machine Learning pipeline sequence for skin condition and dark circle analysis using **Google MediaPipe Face Mesh & Landmarker**.

---

## 📂 Pipeline Sequence of Folders

```text
Model/
│
├── 01_dataset/                 # Dataset loaders and indexing for skin conditions
│   └── dataset_loader.py       # Reads darkcircle, pigmentation, and redness datasets
│
├── 02_models/                  # Model weights, task assets, and cloned source
│   ├── face_landmarker.task    # Google MediaPipe Face Landmarker model (FlatBuffer)
│   └── mediapipe-master/       # Google MediaPipe master repository
│
├── 03_preprocessing/           # Facial geometry, landmark extraction & ROI isolation
│   └── face_mesh_extractor.py  # Isolates infraorbital tear troughs & reference cheek zones
│
├── 04_dark_circle_detection/   # Core Dark Circle algorithmic engine
│   └── dark_circle_detector.py # CIELAB Delta-L*, erythema, melanin & severity grading
│
├── 05_api_service/             # REST API microservice
│   └── server.py               # Lightweight HTTP server for dark circle inference
│
└── DATASET/                    # Raw datasets for dark circles, pigmentation, redness
```

---

## 🧠 Dark Circle Detection Methodology

1. **Facial Geometry Extraction**: 478 3D facial landmarks are extracted using MediaPipe Face Landmarker.
2. **Sub-Ocular ROI Isolation**: The left and right infraorbital areas (tear troughs) are segmented using key periorbital landmark contours.
3. **Cheek Baseline Reference**: Healthy skin tone baseline is extracted from mid-cheek landmarks to calibrate for lighting, camera exposure, and natural skin undertone.
4. **CIELAB Delta-L* Calculation**:
   $$\Delta L^* = L^*_{\text{cheek}} - L^*_{\text{undereye}}$$
5. **Severity Scoring & Etiology**:
   - **Low (< 35%)**: Minimal contrast difference, healthy periorbital dermal structure.
   - **Medium (35% - 70%)**: Moderate darkness, early tear-trough shadow or vascular pooling.
   - **High (> 70%)**: Pronounced periorbital hyperpigmentation requiring targeted actives.
   - **Etiology Classification**: Vascular (Bluish/Purple), Pigmented (Melanin), or Structural (Shadow/Hollow).
