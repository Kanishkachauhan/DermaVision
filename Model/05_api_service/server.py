"""
05_api_service/server.py
-------------------------
Production-grade REST microservice for DermaVision AI Models.
Serves:
  1. EfficientNet-B0 / B3 (Fine-tuned on acne, erythema, and skin condition datasets)
  2. Sub-ocular Periorbital CIELAB Telemetry (Dark Circles)
  3. Combined Multi-Modal Full Face Diagnostics
"""

import os
import sys
import time
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Add parent path for importing model engines
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import importlib
acne_module = importlib.import_module("models.acne_inference")
get_engine = acne_module.get_engine

dc_module = importlib.import_module("04_dark_circle_detection.dark_circle_detector")
analyze_dark_circles = dc_module.analyze_dark_circles


app = FastAPI(
    title="DermaVision AI Microservice",
    description="Deep Learning Facial & Dermatological Diagnostic Engine using EfficientNet-B0/B3 & MediaPipe CIELAB",
    version="2.0.0"
)

# Enable CORS for Node.js Backend (port 5001) and Vite Frontend (port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AcneAnalysisRequest(BaseModel):
    image: Optional[str] = None
    variant: Optional[str] = "b0"  # "b0" or "b3"
    landmarks: Optional[Any] = None
    crops: Optional[Dict[str, Any]] = None
    acneScore: Optional[float] = None
    poreScore: Optional[float] = None
    zoneAcne: Optional[Dict[str, Any]] = None

class DarkCircleRequest(BaseModel):
    image: Optional[str] = None
    landmarks: Optional[Any] = None
    leftEyeCrop: Optional[str] = None
    rightEyeCrop: Optional[str] = None
    cheekCrop: Optional[str] = None
    darkCirclesPercentage: Optional[float] = None
    metrics: Optional[Dict[str, Any]] = None

class FullSkinRequest(BaseModel):
    image: str
    variant: Optional[str] = "b0"
    landmarks: Optional[Any] = None

@app.get("/")
@app.get("/api/health")
def health_check():
    import torch
    device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
    return {
        "status": "online",
        "service": "DermaVision AI Vision Engine",
        "models": {
            "acne_model": "EfficientNet-B0 / EfficientNet-B3 (Fine-Tuned)",
            "dark_circles": "MediaPipe Infraorbital CIELAB Telemetry",
            "device": device
        },
        "version": "2.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }

@app.post("/api/analyze/acne")
def analyze_acne_endpoint(req: AcneAnalysisRequest):
    try:
        variant = req.variant.lower() if req.variant in ["b0", "b3"] else "b0"
        engine = get_engine(variant=variant)

        # If a real image was provided (base64 or data URL)
        if req.image:
            result = engine.analyze_face(req.image, landmarks=req.landmarks)
            return {"success": True, "data": result}
        elif req.crops and req.crops.get("forehead"):
            # Use zone crops if provided
            result = engine.analyze_face(req.crops["forehead"], landmarks=req.landmarks)
            return {"success": True, "data": result}
        else:
            # Fallback using client metrics or synthetic patch
            import numpy as np
            synthetic_img = np.ones((224, 224, 3), dtype=np.uint8) * 180
            result = engine.analyze_face(synthetic_img)
            if req.acneScore is not None:
                result["acneScore"] = int(req.acneScore)
            return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EfficientNet Acne analysis error: {str(e)}")

@app.post("/api/analyze/dark-circles")
def analyze_dark_circles_endpoint(req: DarkCircleRequest):
    try:
        img_source = req.image or req.leftEyeCrop or req.rightEyeCrop
        metrics = req.metrics or {}
        if req.darkCirclesPercentage is not None:
            metrics["darkCirclesPercentage"] = req.darkCirclesPercentage

        result = analyze_dark_circles(
            image_input=img_source,
            landmarks=req.landmarks,
            client_metrics=metrics
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dark circle analysis error: {str(e)}")

@app.post("/api/analyze/full-skin")
def analyze_full_skin(req: FullSkinRequest):
    try:
        variant = req.variant.lower() if req.variant in ["b0", "b3"] else "b0"
        acne_engine = get_engine(variant=variant)
        acne_res = acne_engine.analyze_face(req.image, landmarks=req.landmarks)
        dark_circle_res = analyze_dark_circles(req.image, landmarks=req.landmarks)

        return {
            "success": True,
            "data": {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "acne": acne_res,
                "darkCircles": dark_circle_res
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Full-skin diagnostic error: {str(e)}")

def run():
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False, log_level="info")

if __name__ == "__main__":
    run()
