"""
03_preprocessing/face_mesh_extractor.py
---------------------------------------
Facial Landmark and Infraorbital Region Extraction using Google MediaPipe Face Mesh / Face Landmarker.
Extracts 478 3D periorbital landmarks to isolate the sub-ocular dermal zones for dark circle analysis.
"""

import numpy as np

# Key MediaPipe Face Mesh landmark indices for periorbital and skin reference telemetry
LANDMARKS = {
    # Left under-eye infraorbital zone (sub-ocular tear trough where dark circles manifest)
    "left_undereye": [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 111, 117, 118, 119, 120, 121, 128, 230],
    
    # Right under-eye infraorbital zone (sub-ocular tear trough where dark circles manifest)
    "right_undereye": [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 340, 346, 347, 348, 349, 350, 450],
    
    # Left eye outline
    "left_eye": [33, 160, 158, 133, 153, 144],
    
    # Right eye outline
    "right_eye": [362, 385, 387, 263, 373, 380],
    
    # Cheek reference zones (baseline healthy skin tone for relative delta-L* calculation)
    "left_cheek": [116, 123, 147, 187, 205, 50, 101],
    "right_cheek": [345, 352, 376, 411, 425, 280, 330],
    
    # Forehead reference zone
    "forehead": [10, 67, 109, 297, 338]
}

def extract_landmarks(image_rgb, face_mesh_detector):
    """
    Runs MediaPipe Face Mesh detector on an RGB image and returns normalized landmark coordinates.
    """
    results = face_mesh_detector.process(image_rgb)
    if not results.multi_face_landmarks:
        return None
    
    face_landmarks = results.multi_face_landmarks[0]
    height, width, _ = image_rgb.shape
    
    coords = []
    for lm in face_landmarks.landmark:
        coords.append([int(lm.x * width), int(lm.y * height), lm.z])
        
    return np.array(coords)

def get_roi_bounding_box(landmarks, indices, margin=5):
    """
    Computes bounding box (x, y, w, h) for a specific set of facial landmarks.
    """
    pts = landmarks[indices]
    min_x = max(0, int(np.min(pts[:, 0])) - margin)
    min_y = max(0, int(np.min(pts[:, 1])) - margin)
    max_x = int(np.max(pts[:, 0])) + margin
    max_y = int(np.max(pts[:, 1])) + margin
    
    return {
        "x": min_x,
        "y": min_y,
        "width": max_x - min_x,
        "height": max_y - min_y
    }
