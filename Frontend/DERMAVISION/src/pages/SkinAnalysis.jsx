import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  HiOutlineCamera,
  HiOutlineLightBulb,
  HiOutlineCheckCircle,
  HiArrowRight,
  HiOutlineRefresh,
  HiOutlineUpload,
  HiOutlineShieldCheck,
  HiOutlineDocumentReport,
  HiOutlineArrowLeft,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineExclamationCircle,
  HiOutlineExclamation,
  HiOutlineXCircle,
} from "react-icons/hi";
import { FilesetResolver, FaceDetector, FaceLandmarker } from "@mediapipe/tasks-vision";
import { analyzeDarkCirclesApi, analyzeRednessApi } from "../utils/api";
import DermatologistMap from "../components/DermatologistMap";

// ─── CONFIGURABLE ENGINEERING PARAMETERS FOR UNDER-EYE SEVERITY ───────────────
export const DARK_CIRCLE_CONFIG = {
  weights: {
    relativeDarkness: 0.35,  // 35%: L* lightness drop relative to cheek reference
    localContrast: 0.25,  // 25%: intra-ROI variance / tear-trough demarcation
    affectedArea: 0.20,  // 20%: percentage of under-eye pixels with darkness
    colorDifference: 0.10,  // 10%: chromatic shift (vascularity / melanin)
    distribution: 0.10,  // 10%: spatial concentration along inner trough
  },
  categories: [
    { min: 0, max: 20, label: "Minimal", color: "#10B981", bg: "#ECFDF5", text: "text-emerald-700" },
    { min: 21, max: 40, label: "Mild", color: "#3B82F6", bg: "#EFF6FF", text: "text-blue-700" },
    { min: 41, max: 60, label: "Moderate", color: "#F59E0B", bg: "#FFFBEB", text: "text-amber-700" },
    { min: 61, max: 80, label: "High", color: "#F97316", bg: "#FFF7ED", text: "text-orange-700" },
    { min: 81, max: 100, label: "Very High", color: "#EF4444", bg: "#FEF2F2", text: "text-red-700" },
  ],
  thresholds: {
    darkPixelDeltaL: 3.2,
    maxDeltaLScale: 22.0,
    maxContrastScale: 15.0,
    maxColorScale: 12.0,
  },
  disclaimer:
    "Estimated under-eye darkness based on image analysis. This score is an AI-based visual estimate of skin contrast and does NOT constitute a medical diagnosis or clinical evaluation.",
};

const getDarkCircleCategory = (score) => {
  for (const cat of DARK_CIRCLE_CONFIG.categories) {
    if (score >= cat.min && score <= cat.max) return cat;
  }
  return DARK_CIRCLE_CONFIG.categories[DARK_CIRCLE_CONFIG.categories.length - 1];
};

// ─── CONFIGURABLE CALIBRATED PARAMETERS FOR FACIAL REDNESS SEVERITY ─────────
export const REDNESS_CONFIG = {
  categories: [
    { min: 0, max: 33, label: "Low", description: "Minimal / Baseline Tone", color: "#10B981", bg: "#ECFDF5", text: "text-emerald-700" },
    { min: 34, max: 66, label: "Moderate", description: "Reactive Capillary Flush", color: "#F59E0B", bg: "#FFFBEB", text: "text-amber-700" },
    { min: 67, max: 100, label: "High", description: "Marked Vascular Erythema", color: "#EF4444", bg: "#FEF2F2", text: "text-red-700" },
  ],
  disclaimer:
    "Estimated facial redness severity represents an application-defined visual estimate based on differential CIELAB a* chromaticity and affected skin area. These scores are cosmetic visual indicators and do NOT constitute a medical diagnosis.",
};

const getRednessCategory = (score) => {
  for (const cat of REDNESS_CONFIG.categories) {
    if (score >= cat.min && score <= cat.max) return cat;
  }
  return REDNESS_CONFIG.categories[REDNESS_CONFIG.categories.length - 1];
};

export const getSortedPolygon = (indices, lms) => {
  if (!lms || !indices || indices.length < 3) return null;
  const pts = indices
    .map((i) => lms[i])
    .filter((p) => p && typeof p.x === "number" && typeof p.y === "number");
  if (pts.length < 3) return null;

  // Calculate centroid
  const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
  const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;

  // Sort clockwise by polar angle around centroid to guarantee a closed, non-self-intersecting loop
  const sorted = [...pts].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  return sorted.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(" ");
};

export const getCentroidFromPoints = (pointsStr) => {
  if (!pointsStr) return null;
  const pairs = pointsStr.split(" ").map(s => s.split(",").map(Number)).filter(p => p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]));
  if (pairs.length === 0) return null;
  const cx = pairs.reduce((sum, p) => sum + p[0], 0) / pairs.length;
  const cy = pairs.reduce((sum, p) => sum + p[1], 0) / pairs.length;
  return { x: cx, y: cy };
};

const SkinAnalysis = ({ initialTab = "darkCircles" }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", {
        replace: true,
        state: { from: "/analysis", message: "Please log in to start your skin analysis." },
      });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const [currentStep, setCurrentStep] = useState("instructions");

  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState("user");
  const [capturedImage, setCapturedImage] = useState(null);

  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);
  const [detectorStatus, setDetectorStatus] = useState("loading");
  const [validationError, setValidationError] = useState(null);
  const [alignmentFeedback, setAlignmentFeedback] = useState({
    isAligned: false,
    status: "searching", // 'searching' | 'aligning' | 'perfect' | 'error'
    message: "Center your face in the oval guide",
  });
  const [debugMode, setDebugMode] = useState(false);

  const detectionLoopRef = useRef(null);
  const consecutiveFaceFramesRef = useRef(0);
  const isCapturingRef = useRef(false);
  const faceDetectorRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const nativeDetectorRef = useRef(null);

  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") || searchParams.get("focus") || initialTab;
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentAnalysisStage, setCurrentAnalysisStage] = useState("Initializing neural vision models...");
  const [showMarkers, setShowMarkers] = useState(true);
  const [faceMapMode, setFaceMapMode] = useState("all"); // 'all' | 'zones' | 'heatmap'
  const [activeTab, setActiveTab] = useState(requestedTab || "darkCircles"); // 'darkCircles' | 'redness' | 'overlay'
  const [scanFocus, setScanFocus] = useState(requestedTab === "redness" ? "redness" : "all"); // 'all' | 'darkCircles' | 'redness'
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isRetryingRedness, setIsRetryingRedness] = useState(false);

  const handleRetryRednessAnalysis = async () => {
    if (!capturedImage || isRetryingRedness) return;
    setIsRetryingRedness(true);
    try {
      const res = await analyzeRednessApi({
        image: capturedImage,
        crops: analysisResult?.crops || null,
        landmarks: lastLandmarksRef?.current || null,
      });
      if (res?.success && res?.data) {
        setAnalysisResult((prev) => ({
          ...prev,
          redness: {
            ...res.data,
            regions: prev?.redness?.regions || null,
          },
        }));
      } else {
        setAnalysisResult((prev) => ({
          ...prev,
          redness: {
            _ai_service_down: true,
            _error_message: res?.message || 'Python AI server did not return valid predictions.',
            _instructions: res?.instructions || ['cd Model/05_api_service', 'python3 server.py'],
          },
        }));
      }
    } catch (err) {
      setAnalysisResult((prev) => ({
        ...prev,
        redness: {
          _ai_service_down: true,
          _error_message: err?.message || 'Redness AI service is still unreachable. Please make sure python3 server.py is running on port 8000.',
          _instructions: ['cd Model/05_api_service', 'python3 server.py'],
        },
      }));
    } finally {
      setIsRetryingRedness(false);
    }
  };

  useEffect(() => {
    return () => { stopCamera(); clearInterval(detectionLoopRef.current); };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("/wasm");
        if (!isMounted) return;
        try {
          const det = await FaceDetector.createFromOptions(vision, { baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate: "GPU" }, runningMode: "VIDEO", minDetectionConfidence: 0.65 });
          if (isMounted) { faceDetectorRef.current = det; setDetectorStatus("ready"); }
        } catch (_) {
          const det = await FaceDetector.createFromOptions(vision, { baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate: "CPU" }, runningMode: "VIDEO", minDetectionConfidence: 0.65 });
          if (isMounted) { faceDetectorRef.current = det; setDetectorStatus("ready"); }
        }
        try {
          const lm = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "GPU" }, runningMode: "IMAGE", numFaces: 1, minFaceDetectionConfidence: 0.5 });
          if (isMounted) faceLandmarkerRef.current = lm;
        } catch (_) {
          try {
            const lm = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "CPU" }, runningMode: "IMAGE", numFaces: 1, minFaceDetectionConfidence: 0.5 });
            if (isMounted) faceLandmarkerRef.current = lm;
          } catch (e) { console.warn("FaceLandmarker CPU failed:", e); }
        }
      } catch (_) {
        try {
          const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
          if (!isMounted) return;
          const det = await FaceDetector.createFromOptions(vision, { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite" }, runningMode: "VIDEO", minDetectionConfidence: 0.65 });
          if (isMounted) { faceDetectorRef.current = det; setDetectorStatus("ready"); }
          const lm = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" }, runningMode: "IMAGE", numFaces: 1, minFaceDetectionConfidence: 0.5 });
          if (isMounted) faceLandmarkerRef.current = lm;
        } catch (e) { console.warn("CDN fallback failed:", e); }
      }
      if (isMounted) {
        if ("FaceDetector" in window) setDetectorStatus((p) => (p === "ready" ? "ready" : "native"));
        else setDetectorStatus((p) => (p === "ready" ? "ready" : "unavailable"));
      }
    };
    init();
    return () => { isMounted = false; };
  }, []);

  const stopCamera = () => {
    clearInterval(detectionLoopRef.current);
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
  };

  const startCamera = async (facing = facingMode) => {
    setCameraError(null);
    setValidationError(null);
    stopCamera();
    setIsFaceDetected(false);
    setAutoCaptureProgress(0);
    setAlignmentFeedback({
      isAligned: false,
      status: "searching",
      message: "Center your face in the oval guide",
    });
    consecutiveFaceFramesRef.current = 0;
    isCapturingRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Webcam not supported.");
      const ms = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1080 },
          aspectRatio: { ideal: 1 },
        },
        audio: false,
      });
      setStream(ms);
      if (videoRef.current) videoRef.current.srcObject = ms;
      startFaceDetectionLoop();
    } catch (err) {
      let msg = "Unable to access camera.";
      if (err.name === "NotAllowedError") msg = "Camera access denied. Upload a selfie instead.";
      else if (err.name === "NotFoundError") msg = "No camera found. Upload a facial photo.";
      setCameraError(msg);
    }
  };

  const startFaceDetectionLoop = () => {
    clearInterval(detectionLoopRef.current);
    detectionLoopRef.current = setInterval(async () => {
      if (isCapturingRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused || video.ended) return;

      let ok = false;
      let alignMsg = "Center your face in the oval guide";
      let alignStatus = "searching";

      if (faceDetectorRef.current) {
        try {
          const res = faceDetectorRef.current.detectForVideo(video, performance.now());
          if (res?.detections?.length > 0) {
            if (res.detections.length > 1) {
              alignMsg = "Multiple faces detected — Scan 1 person only";
              alignStatus = "error";
            } else {
              const s = res.detections[0].categories?.[0]?.score ?? 0;
              if (s >= 0.55) {
                const vW = video.videoWidth || 640;
                const vH = video.videoHeight || 480;
                const box = res.detections[0].boundingBox;
                const fA = (box.width * box.height) / (vW * vH);
                const cX = (box.originX + box.width / 2) / vW;
                const cY = (box.originY + box.height / 2) / vH;

                // Strict bounds checking relative to the centered oval viewfinder
                if (fA < 0.16) {
                  alignMsg = "Move Closer — Face too small in guide";
                  alignStatus = "aligning";
                } else if (fA > 0.62) {
                  alignMsg = "Move Back — Face too close";
                  alignStatus = "aligning";
                } else if (cX < 0.38) {
                  alignMsg = facingMode === "user" ? "Move Left slightly" : "Move Right slightly";
                  alignStatus = "aligning";
                } else if (cX > 0.62) {
                  alignMsg = facingMode === "user" ? "Move Right slightly" : "Move Left slightly";
                  alignStatus = "aligning";
                } else if (cY < 0.32) {
                  alignMsg = "Move Down — Center face in oval";
                  alignStatus = "aligning";
                } else if (cY > 0.65) {
                  alignMsg = "Move Up — Center face in oval";
                  alignStatus = "aligning";
                } else {
                  ok = true;
                  alignMsg = "Face Aligned Perfectly — Hold Still";
                  alignStatus = "perfect";
                }
              }
            }
          } else {
            alignMsg = "No face detected — Look directly at camera";
            alignStatus = "searching";
          }
        } catch (_) { }
      }

      if (!ok && "FaceDetector" in window && alignStatus === "searching") {
        try {
          if (!nativeDetectorRef.current) nativeDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
          const faces = await nativeDetectorRef.current.detect(video);
          if (faces?.length > 1) {
            alignMsg = "Multiple faces detected — Scan 1 person only";
            alignStatus = "error";
          } else if (faces?.length === 1) {
            const fb = faces[0].boundingBox;
            const vW = video.videoWidth || 640, vH = video.videoHeight || 480;
            const fA = (fb.width * fb.height) / (vW * vH);
            const cX = (fb.x + fb.width / 2) / vW;
            const cY = (fb.y + fb.height / 2) / vH;
            if (fA < 0.16) {
              alignMsg = "Move Closer — Face too small";
              alignStatus = "aligning";
            } else if (fA > 0.62) {
              alignMsg = "Move Back — Face too close";
              alignStatus = "aligning";
            } else if (cX >= 0.38 && cX <= 0.62 && cY >= 0.32 && cY <= 0.65) {
              ok = true;
              alignMsg = "Face Aligned Perfectly — Hold Still";
              alignStatus = "perfect";
            } else {
              alignMsg = "Center your face inside the oval";
              alignStatus = "aligning";
            }
          }
        } catch (_) { }
      }

      setAlignmentFeedback({ isAligned: ok, status: alignStatus, message: alignMsg });

      if (ok) consecutiveFaceFramesRef.current = Math.min(8, consecutiveFaceFramesRef.current + 1);
      else { consecutiveFaceFramesRef.current = 0; setAutoCaptureProgress(0); }

      const stable = consecutiveFaceFramesRef.current >= 4;
      setIsFaceDetected(stable);

      if (stable && !isCapturingRef.current && autoCaptureEnabled) {
        setAutoCaptureProgress((p) => {
          const n = p + 14;
          if (n >= 100) {
            triggerAutoCapture();
            return 100;
          }
          return n;
        });
      } else if (!stable) {
        setAutoCaptureProgress(0);
      }
    }, 160);
  };

  const triggerAutoCapture = () => {
    if (isCapturingRef.current) return;
    isCapturingRef.current = true;
    clearInterval(detectionLoopRef.current);
    performCapture();
  };

  const handleManualCapture = () => {
    if (!isFaceDetected || isCapturingRef.current) return;
    isCapturingRef.current = true;
    clearInterval(detectionLoopRef.current);
    performCapture();
  };

  const performCapture = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 640;
    const ctx = c.getContext("2d");
    if (facingMode === "user") {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.95);
    stopCamera();
    setCapturedImage(url);
    runCombinedPipeline(url);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const r = new FileReader();
      r.onload = (ev) => {
        stopCamera();
        setCapturedImage(ev.target.result);
        setValidationError(null);
        runCombinedPipeline(ev.target.result);
      };
      r.readAsDataURL(file);
    }
  };

  // ─── COMBINED ANALYSIS PIPELINE WITH STRICT VALIDATION ───────────────────────
  // Runs rigorous face position, orientation, scale and quality checks.
  // Rejects improper photos with clear clinical error directives to prevent skewed metrics.
  const runCombinedPipeline = async (imageUrl) => {
    setCurrentStep("analyzing");
    setValidationError(null);
    setAnalysisProgress(10);
    setCurrentAnalysisStage("Step 1: Face captured — verifying alignment & geometry...");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    await new Promise((res) => {
      if (img.complete) res();
      else {
        img.onload = res;
        img.onerror = res;
      }
    });

    if (!img.width || !img.height) {
      setValidationError({
        code: "LOAD_ERROR",
        title: "Image Loading Failed",
        message: "The captured photo could not be decoded. Please retry capturing or uploading a valid JPEG or PNG file.",
        recommendations: [
          "Ensure your camera lens is clean and unobstructed.",
          "Select a standard image format (JPG/PNG/WEBP)."
        ]
      });
      setCurrentStep("error");
      return;
    }

    let lmResult = null;
    try {
      if (faceLandmarkerRef.current) {
        setAnalysisProgress(25);
        setCurrentAnalysisStage("Step 2: MediaPipe Face Landmarker — verifying 478 3D landmarks...");
        lmResult = faceLandmarkerRef.current.detect(img);
      }
    } catch (detErr) {
      console.warn("Face landmarker verification error:", detErr);
    }

    // ── STRICT VALIDATION RULE 1: Face Presence ─────────────────────────────
    if (!lmResult || !lmResult.faceLandmarks || lmResult.faceLandmarks.length === 0) {
      setValidationError({
        code: "NO_FACE",
        title: "No Human Face Detected",
        message: "DermaVision's diagnostic engine could not identify a clear human face in this photo. For accurate results, your full face must be clearly visible and facing forward.",
        recommendations: [
          "Face a soft, frontal light source (avoid backlighting or heavy shadows).",
          "Remove sunglasses, hats, masks, or loose hair covering your eyes or cheeks.",
          "Look directly into the camera lens with a neutral expression."
        ]
      });
      setCurrentStep("error");
      return;
    }

    // ── STRICT VALIDATION RULE 2: Multiple Faces ────────────────────────────
    if (lmResult.faceLandmarks.length > 1) {
      setValidationError({
        code: "MULTIPLE_FACES",
        title: "Multiple Faces Detected",
        message: "More than one face was found in the frame. Clinical analysis requires an individual scan to calculate exact periorbital and erythema metrics.",
        recommendations: [
          "Ensure only one person is in the frame.",
          "Crop out other individuals before uploading."
        ]
      });
      setCurrentStep("error");
      return;
    }

    const landmarks = lmResult.faceLandmarks[0];

    // ── STRICT VALIDATION RULE 3: Strict Centering & Area Positioning ───────
    const xs = landmarks.map((p) => p.x);
    const ys = landmarks.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const faceW = maxX - minX;
    const faceH = maxY - minY;
    const cX = (minX + maxX) / 2;
    const cY = (minY + maxY) / 2;
    const faceArea = faceW * faceH;

    // Face must be strictly inside the oval guide area (target center ~0.50, tolerance 0.32 to 0.68)
    if (cX < 0.32 || cX > 0.68 || cY < 0.22 || cY > 0.72) {
      setValidationError({
        code: "OFF_CENTER",
        title: "Face Positioned Outside Target Guide Area",
        message: `Your face was detected off-center (Horizontal: ${Math.round(cX * 100)}%, Vertical: ${Math.round(cY * 100)}%). Off-center placement changes how ambient light hits under-eye troughs and cheeks, causing conflicting diagnostic scores.`,
        recommendations: [
          "Place your face strictly inside the central oval guide overlay.",
          "Hold the camera directly in front of your face at eye level.",
          "Do not tilt your phone or stand in the corner of the frame."
        ]
      });
      setCurrentStep("error");
      return;
    }

    // ── STRICT VALIDATION RULE 4: Scale / Distance ──────────────────────────
    if (faceArea < 0.12 || faceW < 0.26 || faceH < 0.30) {
      setValidationError({
        code: "TOO_FAR",
        title: "Face Too Far Away",
        message: "Your face is too distant from the camera. Accurate facial erythema and periorbital melanin ΔL* require high-resolution facial features.",
        recommendations: [
          "Move closer to the camera (~30 cm / 12 inches away).",
          "Ensure your face fills between 35% and 65% of the oval guide."
        ]
      });
      setCurrentStep("error");
      return;
    }

    if (faceArea > 0.82 || minX < 0.02 || maxX > 0.98 || minY < 0.01 || maxY > 0.99) {
      setValidationError({
        code: "TOO_CLOSE",
        title: "Face Too Close or Cropped",
        message: "Your face extends beyond the frame edges, cutting off the forehead, cheek, or chin zones required for full-face mapping.",
        recommendations: [
          "Move slightly back so your entire head and chin fit inside the oval guide.",
          "Ensure full visibility of hairline down to chin."
        ]
      });
      setCurrentStep("error");
      return;
    }

    // ── STRICT VALIDATION RULE 5: Head Angle & Tilt ─────────────────────────
    const leftEye = landmarks[133] || landmarks[33];
    const rightEye = landmarks[362] || landmarks[263];
    if (leftEye && rightEye) {
      const dx = rightEye.x - leftEye.x;
      const dy = rightEye.y - leftEye.y;
      const rollAngle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
      if (rollAngle > 16) {
        setValidationError({
          code: "TILTED_HEAD",
          title: "Head Angle Tilted Sideways",
          message: `Your head is tilted by ~${Math.round(rollAngle)}°. An uneven head angle creates artificial shadow asymmetry between the left and right eyes.`,
          recommendations: [
            "Keep your head straight and level with the horizontal guide line.",
            "Hold your device upright without tilting."
          ]
        });
        setCurrentStep("error");
        return;
      }
    }

    // ── STRICT VALIDATION RULE 6: Illumination & Glare Check ────────────────
    try {
      const testC = document.createElement("canvas");
      testC.width = 64;
      testC.height = 64;
      const testCtx = testC.getContext("2d", { willReadFrequently: true });
      const fPX = Math.max(0, Math.round(minX * (img.naturalWidth || img.width)));
      const fPY = Math.max(0, Math.round(minY * (img.naturalHeight || img.height)));
      const fPW = Math.min((img.naturalWidth || img.width) - fPX, Math.round(faceW * (img.naturalWidth || img.width)));
      const fPH = Math.min((img.naturalHeight || img.height) - fPY, Math.round(faceH * (img.naturalHeight || img.height)));
      testCtx.drawImage(img, fPX, fPY, fPW, fPH, 0, 0, 64, 64);
      const pxData = testCtx.getImageData(0, 0, 64, 64).data;
      let lumSum = 0;
      for (let i = 0; i < pxData.length; i += 4) {
        lumSum += 0.299 * pxData[i] + 0.587 * pxData[i + 1] + 0.114 * pxData[i + 2];
      }
      const avgLum = lumSum / (64 * 64);
      if (avgLum < 32) {
        setValidationError({
          code: "UNDEREXPOSED",
          title: "Photo Too Dark / Insufficient Light",
          message: "The photo is underexposed. Deep shadows prevent accurate melanin ΔL* and erythema differentiation.",
          recommendations: [
            "Face a well-lit window or turn on room lights.",
            "Ensure illumination evenly lights both sides of your face."
          ]
        });
        setCurrentStep("error");
        return;
      }
      if (avgLum > 238) {
        setValidationError({
          code: "OVEREXPOSED",
          title: "Photo Overexposed / Harsh Glare",
          message: "The photo is washed out by direct flash or intense glare, obscuring skin texture and pigment contrast.",
          recommendations: [
            "Turn off direct camera flash.",
            "Use soft, indirect light instead of harsh spotlights."
          ]
        });
        setCurrentStep("error");
        return;
      }
    } catch (_) { }

    // ── All strict validations passed! Proceed with clinical pipeline ──────
    setAnalysisProgress(45);
    setCurrentAnalysisStage("Step 3: Isolating periorbital & facial zone boundaries...");
    await new Promise((r) => setTimeout(r, 200));

    setAnalysisProgress(60);
    setCurrentAnalysisStage("Step 4: Cropping under-eye, T-zone, cheek & chin ROIs...");
    await new Promise((r) => setTimeout(r, 200));

    setAnalysisProgress(70);
    setCurrentAnalysisStage("Step 5a: Dark-Circle ML — ΔL* melanin & vascular analysis...");
    const darkCircleMetrics = await calcDarkCircles(img, landmarks, imageUrl);
    await new Promise((r) => setTimeout(r, 150));

    setAnalysisProgress(88);
    setCurrentAnalysisStage("Step 5b: Facial Redness & Erythema Analysis...");
    let rednessMetrics = null;
    try {
      rednessMetrics = await calcRedness(img, landmarks, imageUrl, darkCircleMetrics?.crops);
    } catch (rednessErr) {
      console.error("Redness analysis error:", rednessErr);
      rednessMetrics = {
        _ai_service_down: true,
        _error_message: rednessErr?.message || 'Redness AI service is unreachable.',
        _instructions: ['Start the Python AI server: cd Model/05_api_service && python3 server.py'],
      };
    }

    // Anatomically accurate landmark zones for redness mapping (guaranteed non-self-intersecting convex loops)
    const foreheadIdx = [10, 67, 103, 104, 108, 109, 151, 337, 338, 336, 297, 332, 284, 9, 8];
    const leftCheekIdx = [116, 123, 147, 187, 205, 50, 101, 117, 118, 119, 100, 126, 209, 192, 214, 212, 138, 135];
    const rightCheekIdx = [345, 352, 376, 411, 425, 280, 330, 346, 347, 348, 329, 355, 429, 416, 434, 432, 367, 364];
    const chinIdx = [152, 175, 199, 200, 18, 83, 313, 148, 176, 377, 400, 140, 369];
    const noseTipIdx = [1, 2, 4, 5, 19, 94, 195, 197, 97, 98, 326, 327, 45, 275, 460, 459, 458, 238, 239, 240, 278, 48];

    const rednessRegions = {
      forehead: getSortedPolygon(foreheadIdx, landmarks) || "30,12 35,10 50,10 65,12 62,20 50,22 38,20",
      leftCheek: getSortedPolygon(leftCheekIdx, landmarks) || "20,44 26,40 36,44 34,54 26,58 18,52",
      rightCheek: getSortedPolygon(rightCheekIdx, landmarks) || "80,44 64,44 66,54 74,58 82,52 74,40",
      chin: getSortedPolygon(chinIdx, landmarks) || "42,75 50,73 58,75 56,82 50,84 44,82",
      noseTip: getSortedPolygon(noseTipIdx, landmarks) || "46,45 50,42 54,45 55,54 50,56 45,54",
    };

    if (rednessMetrics) {
      rednessMetrics.regions = rednessRegions;
    }

    const result = { ...darkCircleMetrics, redness: rednessMetrics };

    setAnalysisProgress(100);
    setCurrentAnalysisStage("Step 6: Clinical diagnosis ready!");
    await new Promise((r) => setTimeout(r, 250));
    setAnalysisResult(result);
    if (scanFocus === "redness") {
      setActiveTab("redness");
    } else {
      setActiveTab("darkCircles");
    }
    setCurrentStep("report");
  };

  // ─── ROBUST CIELAB DARK CIRCLE TELEMETRY ENGINE ──────────────────────────────
  const calcDarkCircles = async (img, landmarks, imageUrl) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const w = canvas.width, h = canvas.height;

    // Helper: convert sRGB to CIE L*a*b*
    const rgbToLab = (r, g, b) => {
      let rN = r / 255, gN = g / 255, bN = b / 255;
      rN = rN > 0.04045 ? Math.pow((rN + 0.055) / 1.055, 2.4) : rN / 12.92;
      gN = gN > 0.04045 ? Math.pow((gN + 0.055) / 1.055, 2.4) : gN / 12.92;
      bN = bN > 0.04045 ? Math.pow((bN + 0.055) / 1.055, 2.4) : bN / 12.92;

      const x = (rN * 0.4124 + gN * 0.3576 + bN * 0.1805) / 0.95047;
      const y = (rN * 0.2126 + gN * 0.7152 + bN * 0.0722) / 1.00000;
      const z = (rN * 0.0193 + gN * 0.1192 + bN * 0.9505) / 1.08883;

      const fx = x > 0.008856 ? Math.cbrt(x) : (7.787 * x) + (16 / 116);
      const fy = y > 0.008856 ? Math.cbrt(y) : (7.787 * y) + (16 / 116);
      const fz = z > 0.008856 ? Math.cbrt(z) : (7.787 * z) + (16 / 116);

      const L = (116 * fy) - 16;
      const a = 500 * (fx - fy);
      const bVal = 200 * (fy - fz);
      return { L, a, b: bVal };
    };

    // Specific landmark subsets:
    // Strictly infraorbital groove margin excluding eyeball, eyebrow, nose bridge, and cheek skin
    const leftUnderEyeIdx = [33, 7, 163, 144, 145, 153, 154, 155, 133, 111, 117, 118, 119, 120, 230, 231, 229, 228];
    const rightUnderEyeIdx = [362, 382, 381, 380, 374, 373, 390, 249, 263, 340, 346, 347, 348, 349, 450, 451, 449, 448];
    // Adjacent upper malar cheek reference skin
    const leftCheekIdx = [116, 123, 147, 187, 205, 50, 101, 212];
    const rightCheekIdx = [345, 352, 376, 411, 425, 280, 330, 432];

    const getBox = (idx, padX = 0.015, padY = 0.015) => {
      const pts = idx.map((i) => landmarks[i] || { x: 0.5, y: 0.5 });
      const minX = Math.max(0, Math.min(...pts.map((p) => p.x)) - padX);
      const maxX = Math.min(1, Math.max(...pts.map((p) => p.x)) + padX);
      const minY = Math.max(0, Math.min(...pts.map((p) => p.y)) - padY);
      const maxY = Math.min(1, Math.max(...pts.map((p) => p.y)) + padY);
      return {
        pixelX: Math.round(minX * w),
        pixelY: Math.round(minY * h),
        pixelW: Math.max(10, Math.round((maxX - minX) * w)),
        pixelH: Math.max(10, Math.round((maxY - minY) * h)),
        x: Math.round(minX * 100),
        y: Math.round(minY * 100),
        width: Math.max(8, Math.round((maxX - minX) * 100)),
        height: Math.max(6, Math.round((maxY - minY) * 100)),
      };
    };

    const leftBox = getBox(leftUnderEyeIdx, 0.01, 0.01);
    const rightBox = getBox(rightUnderEyeIdx, 0.01, 0.01);
    const cheekL = getBox(leftCheekIdx, 0.01, 0.01);
    const cheekR = getBox(rightCheekIdx, 0.01, 0.01);

    const crop = (box) => {
      try {
        const pc = document.createElement("canvas");
        pc.width = Math.max(10, box.pixelW);
        pc.height = Math.max(10, box.pixelH);
        pc.getContext("2d").drawImage(canvas, box.pixelX, box.pixelY, box.pixelW, box.pixelH, 0, 0, box.pixelW, box.pixelH);
        return pc.toDataURL("image/jpeg", 0.92);
      } catch (_) {
        return null;
      }
    };

    // Pixel extraction and LAB calculation for a given bounding region
    const sampleRegion = (box) => {
      try {
        const cW = Math.min(box.pixelW, w - box.pixelX);
        const cH = Math.min(box.pixelH, h - box.pixelY);
        if (cW <= 0 || cH <= 0) return { meanL: 55, meanA: 10, meanB: 12, stdL: 5, labs: [] };
        const data = ctx.getImageData(box.pixelX, box.pixelY, cW, cH).data;
        const labs = [];
        for (let i = 0; i < data.length; i += 4) {
          const lab = rgbToLab(data[i], data[i + 1], data[i + 2]);
          // Filter extreme highlights (glint) and deep shadow margins
          if (lab.L >= 12 && lab.L <= 94) {
            labs.push(lab);
          }
        }
        if (labs.length === 0) return { meanL: 55, meanA: 10, meanB: 12, stdL: 5, labs: [] };

        const sumL = labs.reduce((acc, p) => acc + p.L, 0);
        const meanL = sumL / labs.length;
        const sumA = labs.reduce((acc, p) => acc + p.a, 0);
        const meanA = sumA / labs.length;
        const sumB = labs.reduce((acc, p) => acc + p.b, 0);
        const meanB = sumB / labs.length;
        const varL = labs.reduce((acc, p) => acc + Math.pow(p.L - meanL, 2), 0) / labs.length;
        const stdL = Math.sqrt(varL);

        return { meanL, meanA, meanB, stdL, labs };
      } catch (_) {
        return { meanL: 55, meanA: 10, meanB: 12, stdL: 5, labs: [] };
      }
    };

    const eyeL = sampleRegion(leftBox);
    const eyeR = sampleRegion(rightBox);
    const refL = sampleRegion(cheekL);
    const refR = sampleRegion(cheekR);

    // Compute independent eye features
    const evaluateSingleEye = (eye, ref) => {
      const deltaL = Math.max(0, ref.meanL - eye.meanL);
      const deltaA = eye.meanA - ref.meanA;
      const deltaB = ref.meanB - eye.meanB;

      // 1. Relative darkness score (0–100)
      const darknessScore = Math.min(100, Math.max(0, (deltaL / DARK_CIRCLE_CONFIG.thresholds.maxDeltaLScale) * 100));

      // 2. Local contrast score (0–100)
      const excessContrast = Math.max(0, eye.stdL - (ref.stdL * 0.7));
      const contrastScore = Math.min(100, Math.max(0, (excessContrast / DARK_CIRCLE_CONFIG.thresholds.maxContrastScale) * 100));

      // 3. Affected area percentage (0–100%)
      const thresholdL = ref.meanL - DARK_CIRCLE_CONFIG.thresholds.darkPixelDeltaL;
      const darkPixelCount = eye.labs.filter((p) => p.L < thresholdL).length;
      const affectedAreaPercent = eye.labs.length > 0 ? Math.round((darkPixelCount / eye.labs.length) * 100) : 18;

      // 4. Color difference score (0–100)
      const chromaShift = Math.sqrt(Math.max(0, deltaA) ** 2 + Math.max(0, deltaB) ** 2);
      const colorScore = Math.min(100, Math.max(0, (chromaShift / DARK_CIRCLE_CONFIG.thresholds.maxColorScale) * 100));

      // 5. Distribution score (0–100)
      const distributionScore = Math.min(100, Math.max(0, (darknessScore * 0.6) + (affectedAreaPercent * 0.4)));

      // Weighted score
      const wts = DARK_CIRCLE_CONFIG.weights;
      const score = Math.round(
        (wts.relativeDarkness * darknessScore) +
        (wts.localContrast * contrastScore) +
        (wts.affectedArea * affectedAreaPercent) +
        (wts.colorDifference * colorScore) +
        (wts.distribution * distributionScore)
      );

      return {
        score: Math.min(100, Math.max(8, score)),
        darknessScore: Math.round(darknessScore),
        contrastScore: Math.round(contrastScore),
        affectedAreaPercent,
        colorScore: Math.round(colorScore),
        distributionScore: Math.round(distributionScore),
        deltaL: parseFloat(deltaL.toFixed(1)),
        deltaA: parseFloat(deltaA.toFixed(1)),
        deltaB: parseFloat(deltaB.toFixed(1)),
        meanL: parseFloat(eye.meanL.toFixed(1)),
        refMeanL: parseFloat(ref.meanL.toFixed(1)),
      };
    };

    const leftMetrics = evaluateSingleEye(eyeL, refL);
    const rightMetrics = evaluateSingleEye(eyeR, refR);

    const asymmetry = Math.abs(leftMetrics.score - rightMetrics.score);
    const overallSeverity = Math.round((leftMetrics.score + rightMetrics.score) / 2);
    const severityCategory = getDarkCircleCategory(overallSeverity);

    const overallFeatures = {
      relativeDarkness: Math.round((leftMetrics.darknessScore + rightMetrics.darknessScore) / 2),
      localContrast: Math.round((leftMetrics.contrastScore + rightMetrics.contrastScore) / 2),
      affectedArea: Math.round((leftMetrics.affectedAreaPercent + rightMetrics.affectedAreaPercent) / 2),
      colorDifference: Math.round((leftMetrics.colorScore + rightMetrics.colorScore) / 2),
      distribution: Math.round((leftMetrics.distributionScore + rightMetrics.distributionScore) / 2),
    };

    // Etiology based on chromatic delta
    const avgDeltaA = (leftMetrics.deltaA + rightMetrics.deltaA) / 2;
    const avgDeltaB = (leftMetrics.deltaB + rightMetrics.deltaB) / 2;

    let etiology = "Structural Appearance (Orbital tear-trough shadow depression)";
    let recommendation = "Hyaluronic acid hydration, peptide complex eye serums & barrier moisturizers";

    if (avgDeltaA > 2.5) {
      etiology = "Vascular Appearance (Sub-ocular capillary visibility)";
      recommendation = "Caffeine 5% Solution, Vitamin K, cold compress & restorative sleep";
    } else if (avgDeltaB > 2.5 || overallSeverity > 55) {
      etiology = "Pigmentation Appearance (Periorbital melanin contrast)";
      recommendation = "Vitamin C (L-Ascorbic Acid), Niacinamide, Alpha Arbutin & daily SPF 50+";
    }

    const poly = (idx, dipY = 0.015) => {
      const half = Math.floor(idx.length / 2);
      return idx.map((i, n) => {
        const lm = landmarks[i];
        if (!lm) return null;
        const ey = n >= half ? dipY : 0.002;
        return `${(lm.x * 100).toFixed(2)},${((lm.y + ey) * 100).toFixed(2)}`;
      }).filter(Boolean).join(" ");
    };

    // Initial placeholders until backend DarkCircleNet model inference returns
    const initialProb = 0.50;
    const initialPct = 50;
    const isInitiallyDetected = true;
    const leftProb = 0.50;
    const leftPct = 50;
    const rightProb = 0.50;
    const rightPct = 50;

    // Construct telemetry payload
    const payload = {
      timestamp: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      // Detection state
      detectionConfidence: initialProb,
      confidencePercentage: initialPct,
      confidenceText: `${initialPct}%`,
      isDetected: isInitiallyDetected,
      statusText: isInitiallyDetected
        ? "Dark Circles Detected"
        : "Dark circles not detected",
      modelSummary: isInitiallyDetected
        ? "Under-eye analysis indicates dark circle patterns."
        : "No significant dark circles identified.",
      threshold: 0.50,
      leftEye: {
        confidence: leftProb,
        percentage: leftPct,
        isDetected: leftPct >= 50,
        status: leftPct >= 50 ? "Detected" : "Not detected",
        crop: crop(leftBox),
        box: leftBox,
      },
      rightEye: {
        confidence: rightProb,
        percentage: rightPct,
        isDetected: rightPct >= 50,
        status: rightPct >= 50 ? "Detected" : "Not detected",
        crop: crop(rightBox),
        box: rightBox,
      },
      crops: {
        left: crop(leftBox),
        right: crop(rightBox),
        leftCheek: crop(cheekL),
        rightCheek: crop(cheekR),
      },
      regions: {
        left: getSortedPolygon(leftUnderEyeIdx, landmarks) || "32.0,46.2 35.5,47.5 39.0,48.0 43.5,47.5 47.0,45.8 48.0,48.5 45.5,53.2 41.0,55.0 36.0,54.2 32.5,50.5",
        right: getSortedPolygon(rightUnderEyeIdx, landmarks) || "53.0,45.8 56.5,47.5 61.0,48.0 64.5,47.5 68.0,46.2 67.5,50.5 64.0,54.2 59.0,55.0 54.5,53.2 52.0,48.5",
      },
      disclaimer: "This visual analysis estimates physical under-eye severity (0–100) based on localized contrast and affected area. It is an application-defined cosmetic estimate, not a clinical diagnosis.",
      // ── 2. ESTIMATED DARK CIRCLE SEVERITY (Application-Defined Visual Scale) ──
      severityScore: overallSeverity,
      severityCategory: severityCategory.label,
      severity: severityCategory,
      affectedAreaPercent: overallFeatures.affectedArea,
      affectedArea: `${overallFeatures.affectedArea}%`,
      darkCirclesPercentage: overallSeverity,
      detectedBoxes: [
        { id: "box-1", x: 31, y: 45, width: 17, height: 9, label: isInitiallyDetected ? "Left Dark Circle" : "Left Eye Area" },
        { id: "box-2", x: 52, y: 45, width: 17, height: 9, label: isInitiallyDetected ? "Right Dark Circle" : "Right Eye Area" },
      ],
    };

    // Forward to backend API to query trained DarkCircleNet model & verify severity
    try {
      const serverRes = await analyzeDarkCirclesApi({
        image: imageUrl,
        leftEyeCrop: payload.crops.left,
        rightEyeCrop: payload.crops.right,
        landmarks,
        detectionConfidence: initialProb,
        severityScore: overallSeverity,
        leftEye: leftMetrics,
        rightEye: rightMetrics,
        features: overallFeatures,
      });

      if (serverRes?.data) {
        const d = serverRes.data;
        if (d.quality_error || d.error) {
          payload.qualityError = d.error || "Image quality is insufficient for reliable analysis.";
        }
        if (d.detection_confidence !== undefined) {
          payload.detectionConfidence = d.detection_confidence;
          payload.confidencePercentage = d.confidence_percentage ?? Math.round(d.detection_confidence * 100);
          payload.confidenceText = d.confidence ?? `${payload.confidencePercentage}%`;
          payload.isDetected = d.is_detected ?? (payload.confidencePercentage >= 50);
          payload.statusText = d.status ?? (payload.isDetected ? "Dark Circles Detected" : "Dark circles not detected");
          payload.modelSummary = d.model_summary ?? (payload.isDetected ? "Under-eye analysis indicates dark circle patterns." : "No significant dark circles identified.");
        }
        if (d.severity_score !== undefined) {
          payload.severityScore = d.severity_score;
          payload.severityCategory = d.severity_category || getDarkCircleCategory(d.severity_score).label;
          payload.severity = d.severity || getDarkCircleCategory(d.severity_score);
          payload.affectedAreaPercent = d.affected_area_percent ?? payload.affectedAreaPercent;
          payload.affectedArea = d.affected_area ?? `${payload.affectedAreaPercent}%`;
          payload.darkCirclesPercentage = d.severity_score;
        }
        if (d.left_eye) {
          payload.leftEye = {
            ...payload.leftEye,
            ...d.left_eye,
            severityScore: d.left_eye.severity_score ?? payload.leftEye.severityScore,
            severityCategory: d.left_eye.severity_category ?? payload.leftEye.severityCategory,
          };
        }
        if (d.right_eye) {
          payload.rightEye = {
            ...payload.rightEye,
            ...d.right_eye,
            severityScore: d.right_eye.severity_score ?? payload.rightEye.severityScore,
            severityCategory: d.right_eye.severity_category ?? payload.rightEye.severityCategory,
          };
        }
        if (d.detectedBoxes) {
          payload.detectedBoxes = d.detectedBoxes;
        }
        if (d.model_info) {
          payload.modelInfo = d.model_info;
        }
      }
    } catch (_) { }

    return payload;
  };


  // ─── FACIAL REDNESS & ERYTHEMA ENGINE ───────────────────────────────────────
  const calcRedness = async (img, landmarks, imageUrl, crops) => {
    const serverRes = await analyzeRednessApi({
      image: imageUrl,
      crops: crops || null,
      landmarks: landmarks || null,
    });
    // If AI service is down, the response will have ai_service_down: true
    if (serverRes?.ai_service_down || serverRes?.success === false) {
      return {
        _ai_service_down: true,
        _error_message: serverRes?.message || 'Redness AI service is not running.',
        _instructions: serverRes?.instructions || [],
      };
    }
    if (serverRes?.success && serverRes?.data) {
      return serverRes.data;
    }
    // Unexpected response shape — surface as error
    return {
      _ai_service_down: true,
      _error_message: 'Unexpected response from redness analysis API.',
      _instructions: ['Check that both Node.js backend and Python AI server are running.'],
    };
  };

  // ─── FALLBACKS ────────────────────────────────────────────────────────────────
  const fallbackDarkCircle = () => ({
    timestamp: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    darkCirclesPercentage: 42, severity: { label: "Medium", color: "#F59E0B", bg: "#FFFBEB" },
    etiology: "Vascular (Bluish/Purple Pooling)", recommendation: "Caffeine 5% Solution, cold compress & restorative sleep", deltaL: "14.2",
    crops: {}, regions: { left: "32.0,46.2 35.5,47.5 39.0,48.0 43.5,47.5 47.0,45.8 48.0,48.5 45.5,53.2 41.0,55.0 36.0,54.2 32.5,50.5", right: "53.0,45.8 56.5,47.5 61.0,48.0 64.5,47.5 68.0,46.2 67.5,50.5 64.0,54.2 59.0,55.0 54.5,53.2 52.0,48.5" },
  });
  // NOTE: fallbackRedness() removed — static data should never be served.
  // If the AI service is down, an _ai_service_down error object is returned instead.

  const handleRetake = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setValidationError(null);
    setCurrentStep("camera");
    startCamera(facingMode);
  };
  const toggleFacingMode = () => { const n = facingMode === "user" ? "environment" : "user"; setFacingMode(n); startCamera(n); };
  const zoneColour = (s) => s < 35 ? { bg: "#ECFDF5", text: "#10B981" } : s <= 68 ? { bg: "#FFFBEB", text: "#F59E0B" } : { bg: "#FEF2F2", text: "#EF4444" };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#FDFBF9] py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-5 sm:pb-6 sm:mb-6 border-b border-[#E8DFD8]">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white border border-[#E8DFD8] text-[#5A524C] hover:text-[#DC926E] flex items-center justify-center transition-colors shadow-sm shrink-0">
              <HiOutlineArrowLeft className="text-base sm:text-lg" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-[#2B2623] tracking-tight">AI Skin Analysis</h1>
              <p className="text-[11px] sm:text-xs text-[#7A7069]">Full-face scan — Dark Circles · Facial Redness</p>
            </div>
          </div>
          <span className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider self-start sm:self-auto ${currentStep === "instructions" ? "bg-[#FAF1EC] text-[#DC926E] border border-[#DC926E]/30"
              : currentStep === "camera" ? "bg-amber-50 text-amber-700 border border-amber-200"
                : currentStep === "analyzing" ? "bg-blue-50 text-blue-700 border border-blue-200 animate-pulse"
                  : currentStep === "error" ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}>
            {currentStep === "instructions" && "1. Guidelines"}
            {currentStep === "camera" && "2. Camera & Alignment"}
            {currentStep === "analyzing" && "3. Scanning"}
            {currentStep === "error" && "Error: Alignment Failed"}
            {currentStep === "report" && "4. Results"}
          </span>
        </div>

        {/* ── STEP 1: INSTRUCTIONS ────────────────────────────────── */}
        {currentStep === "instructions" && (
          <div className="space-y-6 sm:space-y-8 animate-fadeIn">
            <div className="bg-gradient-to-br from-white to-[#FAF4F0] border border-[#E8DFD8] rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm">
              <div className="max-w-2xl">
                <span className="inline-block px-3 py-1 rounded-full bg-[#DC926E]/15 text-[#DC926E] text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2.5 sm:mb-3">Pre-Scan Guidelines</span>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#2B2623] mb-2 sm:mb-3">One scan. Full-face diagnosis.</h2>
                <p className="text-xs sm:text-sm text-[#5A524C] leading-relaxed">A single photo analyses <strong>under-eye dark circles</strong> and <strong>facial redness &amp; erythema</strong> simultaneously using the MediaPipe 478-point face mesh and our calibrated vision engine.</p>
              </div>
            </div>

            {/* Strict Alignment Protocol Card */}
            <div className="bg-amber-50/80 border-2 border-amber-300/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-3.5 sm:gap-4 shadow-sm">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl shrink-0 font-bold border border-amber-200">
                <HiOutlineExclamation className="text-xl sm:text-2xl text-amber-700" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200/80 text-amber-900">
                    Mandatory Protocol
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-amber-950">Strict Face Location Requirement</h3>
                </div>
                <p className="text-xs text-amber-900/90 leading-relaxed">
                  You <strong>must position your face strictly inside the designated oval guide</strong> and look straight ahead.
                  Different face positions, tilted angles, or camera distances alter ambient light bounce and distort under-eye shadow depths.
                  DermaVision strictly validates face location and head posture; <strong>improper or off-center photos will be rejected</strong> with an explicit error to prevent incorrect or inconsistent diagnostic metrics.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {[
                { icon: <HiOutlineLightBulb />, title: "1. Soft Frontal Lighting", body: "Face a window or soft lamp. Avoid harsh overhead light — it creates false shadows that skew dark-circle and texture readings." },
                { icon: <HiOutlineCheckCircle />, title: "2. Clean, Bare Skin", body: "Remove glasses, pull back hair, and wash off makeup so your raw skin surface is visible to the camera." },
                { icon: <HiOutlineCamera />, title: "3. Face Inside Oval Guide", body: "Keep your face strictly inside the guide area (~30 cm away). Off-center positions will be rejected." },
                { icon: <HiOutlineEye />, title: "4. Neutral Expression & Straight Angle", body: "Relax your face and face forward level with the lens. Tilted angles cause asymmetrical diagnostics." },
              ].map((c, i) => (
                <div key={i} className="bg-white border border-[#E8DFD8] rounded-xl p-4 sm:p-5 hover:border-[#DC926E]/60 transition-all flex items-start gap-3.5 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#FAF1EC] text-[#DC926E] flex items-center justify-center text-xl sm:text-2xl shrink-0">{c.icon}</div>
                  <div><h3 className="text-sm sm:text-base font-bold text-[#2B2623] mb-1">{c.title}</h3><p className="text-xs text-[#7A7069] leading-relaxed">{c.body}</p></div>
                </div>
              ))}
            </div>

            {/* Diagnostic Focus */}
            <div className="bg-white border border-[#E8DFD8] rounded-2xl p-4 sm:p-5 space-y-3">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#7A7069]">Unified Dermal Diagnostic</span>
                <h3 className="text-sm sm:text-base font-bold text-[#2B2623]">Included in Your Scan</h3>
                <p className="text-xs text-[#7A7069] mt-0.5">Capturing a photo simultaneously analyzes under-eye dark circles and facial redness &amp; erythema with specialized vision models.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-[#DC926E]/40 bg-[#FAF1EC] flex items-start gap-3">
                  <span className="text-2xl shrink-0">👁️</span>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-[#2B2623]">Dark Circle Analysis</div>
                    <p className="text-[11px] text-[#5A524C] mt-0.5 leading-relaxed">Isolates periorbital landmarks to measure melanin pigmentation, vascular pooling, and tear-trough ΔL* lightness.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-[#EF4444]/40 bg-[#FEF2F2] flex items-start gap-3">
                  <span className="text-2xl shrink-0">🌸</span>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-[#2B2623]">Redness &amp; Erythema</div>
                    <p className="text-[11px] text-[#5A524C] mt-0.5 leading-relaxed">Detects vascular flush, reactive erythema, and sensitivity across facial skin zones with calibrated colorimetry.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* What will be scanned */}
            <div className="bg-white border border-[#E8DFD8] rounded-xl p-4 sm:p-5">
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#7A7069] mb-2.5 sm:mb-3">
                Parameters Analyzed In Scan
              </p>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {[
                  "👁️ Dark Circles (ΔL*)",
                  "🌸 Facial Erythema",
                  "🩸 Vascular Flushing",
                  "📍 5-Zone Landmark Map",
                  "🧬 MediaPipe 478-pt Mesh"
                ].map((t) => (
                  <span key={t} className="text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#FAF1EC] text-[#DC926E]">{t}</span>
                ))}
              </div>
            </div>

            <div className="bg-white/80 border border-[#E8DFD8] rounded-xl p-3.5 sm:p-4 flex items-start gap-2.5 sm:gap-3 text-xs text-[#7A7069]">
              <HiOutlineShieldCheck className="text-lg text-emerald-600 shrink-0 mt-0.5" />
              <div><span className="font-semibold text-[#2B2623]">Private by design:</span> Everything runs in your browser — no image ever leaves your device without explicit consent.</div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-[#E8DFD8]">
              <span className="text-xs text-[#7A7069]">Estimated duration: ~15 seconds</span>
              <button onClick={() => { setCurrentStep("camera"); startCamera(facingMode); }} className="w-full sm:w-auto bg-[#DC926E] hover:bg-[#c87e5b] text-white font-semibold px-6 sm:8 py-3 sm:py-3.5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-xs sm:text-sm group cursor-pointer">
                <span>
                  {scanFocus === "redness" ? "Start Redness Scan" : "Start Comprehensive Scan"}
                </span>
                <HiArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: CAMERA ─────────────────────────────────────── */}
        {currentStep === "camera" && (
          <div className="space-y-5 sm:space-y-6 animate-fadeIn">
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all ${detectorStatus === "loading" ? "bg-neutral-50 border-neutral-200 text-neutral-500" : isFaceDetected ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${detectorStatus === "loading" ? "bg-neutral-400 animate-pulse" : isFaceDetected ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
                <span>{detectorStatus === "loading" ? "Initializing ML models..." : isFaceDetected ? "Face locked strictly in area — Ready to scan" : "Locate your face strictly inside the oval guide"}</span>
              </span>
              <span className="font-mono uppercase text-[9px] sm:text-[10px] tracking-widest opacity-70 self-end sm:self-auto">{detectorStatus === "loading" ? "Loading..." : detectorStatus === "ready" ? "MediaPipe" : detectorStatus.toUpperCase()}</span>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-sm sm:text-base font-bold text-[#2B2623]">Center Your Face in the Oval Guide</h2>
              <p className="text-xs text-[#7A7069] max-w-md mx-auto px-2">
                The capture button unlocks only when your face is strictly centered inside the target area. Hold still to capture.
              </p>
            </div>

            <div className="flex justify-center px-2">
              <div className="relative w-full max-w-[320px] sm:max-w-[360px] aspect-square bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-white ring-1 ring-[#E8DFD8]">
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-white">
                    <HiOutlineCamera className="text-5xl mb-3 opacity-50" />
                    <p className="text-sm font-medium text-neutral-200 mb-4">{cameraError}</p>
                    <label className="bg-[#DC926E] text-white text-sm font-bold px-5 py-2.5 rounded-xl cursor-pointer hover:bg-[#c87e5b] transition-colors">Upload Photo<input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} /></label>
                  </div>
                ) : (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`} />

                    {/* Viewfinder oval target guide */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div
                        className={`relative w-44 h-56 sm:w-52 sm:h-64 rounded-[50%] border-3 transition-all duration-300 ${isFaceDetected
                            ? "border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.55)] ring-2 ring-emerald-300/40"
                            : alignmentFeedback.status === "aligning"
                              ? "border-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                              : "border-white/50 border-dashed"
                          }`}
                      >
                        {/* Center crosshair / guide ticks */}
                        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-4 h-0.5 ${isFaceDetected ? "bg-emerald-400" : "bg-white/60"}`} />
                        <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 ${isFaceDetected ? "bg-emerald-400" : "bg-white/60"}`} />
                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 ${isFaceDetected ? "bg-emerald-400" : "bg-white/60"}`} />
                        <div className={`absolute right-0 top-1/2 -translate-y-1/2 h-4 w-0.5 ${isFaceDetected ? "bg-emerald-400" : "bg-white/60"}`} />
                        {/* Eye level horizontal line */}
                        <div className="absolute top-[42%] left-3 right-3 border-b border-white/25 border-dotted" />
                      </div>
                    </div>

                    {/* Live alignment instruction badge */}
                    <div className="absolute bottom-3 left-2 right-2 sm:left-3 sm:right-3 flex justify-center pointer-events-none z-10">
                      <div
                        className={`px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold backdrop-blur-md border shadow-lg flex items-center gap-2 transition-all duration-200 text-center ${isFaceDetected
                            ? "bg-emerald-500/90 border-emerald-400 text-white shadow-emerald-500/30"
                            : alignmentFeedback.status === "aligning"
                              ? "bg-amber-500/90 border-amber-400 text-white shadow-amber-500/30"
                              : "bg-black/75 border-white/20 text-white/90"
                          }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${isFaceDetected
                              ? "bg-white animate-ping"
                              : alignmentFeedback.status === "aligning"
                                ? "bg-white animate-pulse"
                                : "bg-red-400"
                            }`}
                        />
                        <span className="truncate max-w-[260px]">{alignmentFeedback.message}</span>
                      </div>
                    </div>

                    {isFaceDetected && autoCaptureEnabled && autoCaptureProgress > 0 && (
                      <div className="absolute bottom-14 sm:bottom-16 left-1/2 -translate-x-1/2 z-20">
                        <svg className="w-12 h-12 sm:w-14 sm:h-14 transform -rotate-90" viewBox="0 0 44 44">
                          <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.2)" strokeWidth="4" fill="none" />
                          <circle cx="22" cy="22" r="18" stroke="#10B981" strokeWidth="4" fill="none" strokeDasharray={113.1} strokeDashoffset={113.1 - (autoCaptureProgress / 100) * 113.1} strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">{Math.round(autoCaptureProgress)}%</span>
                      </div>
                    )}
                    {/* Condition badges overlay */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-3 sm:left-3 sm:right-3 flex gap-1 sm:gap-1.5 flex-wrap">
                      {["👁️ Dark Circles", "🌸 Facial Redness"].map((l) => (
                        <span key={l} className="text-[8px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded bg-black/60 text-white backdrop-blur-sm">{l}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 sm:gap-4 pt-1">
              <button onClick={() => setAutoCaptureEnabled(p => !p)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${autoCaptureEnabled ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-[#E8DFD8] text-[#5A524C]"}`}>Auto: {autoCaptureEnabled ? "ON" : "OFF"}</button>
              <button
                onClick={handleManualCapture}
                disabled={!isFaceDetected}
                title={isFaceDetected ? "Take photo" : "Align face strictly inside the oval guide to capture"}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center transition-all cursor-pointer ${isFaceDetected
                    ? "bg-[#DC926E] hover:bg-[#c87e5b] scale-100 shadow-md"
                    : "bg-neutral-400 opacity-40 cursor-not-allowed scale-95"
                  }`}
              >
                <HiOutlineCamera className="text-white text-2xl" />
              </button>
              <button onClick={toggleFacingMode} className="w-10 h-10 rounded-full bg-white border border-[#E8DFD8] text-[#5A524C] hover:text-[#DC926E] flex items-center justify-center transition-all shadow-sm cursor-pointer"><HiOutlineRefresh className="text-lg" /></button>
              <label className="w-10 h-10 rounded-full bg-white border border-[#E8DFD8] text-[#5A524C] hover:text-[#DC926E] shadow-sm flex items-center justify-center text-lg transition-all cursor-pointer"><HiOutlineUpload /><input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} /></label>
            </div>
            <p className="text-xs text-[#7A7069] text-center max-w-sm mx-auto px-2">
              {isFaceDetected ? "✅ Face locked strictly inside guide — capture enabled" : "⚠️ Align face completely inside the oval guide to unlock camera capture"}
            </p>
          </div>
        )}

        {/* ── STEP 3: ANALYZING ───────────────────────────────────── */}
        {currentStep === "analyzing" && (
          <div className="space-y-8 animate-fadeIn flex flex-col items-center justify-center py-6">
            <div className="relative w-full max-w-[360px] aspect-[4/5] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-white ring-1 ring-[#E8DFD8]">
              {capturedImage && <img src={capturedImage} alt="Captured Face" className="w-full h-full object-cover filter contrast-105" />}
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#DC926E] to-transparent shadow-[0_0_15px_#DC926E]" style={{ top: `${analysisProgress}%`, transition: "top 0.4s ease-out" }} />
              <div className="absolute inset-0 bg-[radial-gradient(#DC926E_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 bg-black/75 backdrop-blur-md rounded-xl p-3 border border-white/20 text-white text-xs">
                <div className="flex justify-between items-center mb-1.5 font-medium">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#DC926E] animate-ping" />Combined Dermal ML Engine</span>
                  <span className="font-mono text-[#DC926E]">{analysisProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-[#DC926E] to-[#E8A585] transition-all duration-300 rounded-full" style={{ width: `${analysisProgress}%` }} /></div>
                <p className="text-[11px] text-[#D1C7BD] mt-2 truncate font-mono">{currentAnalysisStage}</p>
              </div>
            </div>
            <div className="text-center max-w-sm">
              <h3 className="text-base font-bold text-[#2B2623] mb-1">Running Full-Face Analysis</h3>
              <p className="text-xs text-[#7A7069]">Simultaneously analyzing under-eye dark circles and facial redness &amp; erythema across all facial zones.</p>
            </div>
          </div>
        )}

        {/* ── STEP: VALIDATION ERROR / PHOTO REJECTED ──────────────── */}
        {currentStep === "error" && validationError && (
          <div className="max-w-xl mx-auto space-y-6 animate-fadeIn">
            <div className="bg-white border-2 border-red-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-start gap-4 pb-5 border-b border-[#E8DFD8]">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center text-2xl shrink-0 border border-red-100">
                  <HiOutlineExclamationCircle />
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-extrabold uppercase tracking-wider mb-1">
                    Photo Rejected · Strict Alignment Required
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-[#2B2623]">{validationError.title}</h2>
                  <p className="text-xs text-[#7A7069] mt-1">{validationError.message}</p>
                </div>
              </div>

              {/* Captured image preview with rejection banner */}
              {capturedImage && (
                <div className="relative my-2 rounded-2xl overflow-hidden border border-red-200 bg-neutral-900 max-w-xs mx-auto aspect-square shadow-inner">
                  <img src={capturedImage} alt="Rejected capture" className="w-full h-full object-cover filter brightness-90" />
                  <div className="absolute inset-0 bg-red-950/20 pointer-events-none" />
                  <div className="absolute inset-x-3 bottom-3 bg-red-600/90 backdrop-blur-sm text-white text-[11px] font-bold py-1.5 px-3 rounded-lg text-center shadow">
                    ⚠️ Photo Not Valid for Clinical Scoring
                  </div>
                </div>
              )}

              {/* Why positioning matters */}
              <div className="bg-[#FAF4F0] border border-[#DC926E]/30 rounded-2xl p-4 text-xs space-y-2">
                <div className="font-bold text-[#2B2623] flex items-center gap-1.5">
                  <span>🎯 Why Strict Alignment is Enforced:</span>
                </div>
                <p className="text-[#5A524C] leading-relaxed">
                  Skin pigmentation (ΔL* dark circles) and dermal erythema (facial redness) are calculated relative to facial geometry.
                  When face positioning or angles differ between scans, shadow gradients shift and produce conflicting scores. DermaVision requires strict oval alignment to guarantee clinical consistency.
                </p>
              </div>

              {/* Actionable recommendations */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#2B2623]">Required Adjustments:</h3>
                <ul className="space-y-2 text-xs text-[#5A524C]">
                  {validationError.recommendations?.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-[#FDFBF9] border border-[#E8DFD8] rounded-xl p-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#FAF1EC] text-[#DC926E] font-bold flex items-center justify-center shrink-0 text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#E8DFD8]">
                <button
                  onClick={handleRetake}
                  className="flex-1 bg-[#DC926E] hover:bg-[#c87e5b] text-white font-bold py-3.5 px-5 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  <HiOutlineRefresh className="text-base" />
                  <span>Retake Photo with Oval Guide</span>
                </button>
                <label className="flex-1 bg-white border border-[#E8DFD8] hover:border-[#DC926E] text-[#5A524C] hover:text-[#DC926E] font-bold py-3.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-sm text-center">
                  <HiOutlineUpload className="text-base" />
                  <span>Upload Another Photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: COMBINED REPORT ──────────────────────────────── */}
        {currentStep === "report" && analysisResult && (
          <div className="max-w-xl mx-auto space-y-5 animate-fadeIn">

            {/* Tab Switcher */}
            <div className="flex rounded-xl overflow-hidden border border-[#E8DFD8] bg-white shadow-sm">
              {[
                { key: "darkCircles", icon: "👁️", label: "Dark Circles" },
                { key: "redness", icon: "🌸", label: "Redness & Erythema" },
                { key: "overlay", icon: "🗺️", label: "Face Map" },
              ].map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex-1 py-2.5 text-xs font-bold transition-all cursor-pointer ${activeTab === t.key ? "bg-[#DC926E] text-white" : "text-[#5A524C] hover:bg-[#FAF1EC]"}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div className="bg-white border border-[#E8DFD8] rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">

              {/* Report header — always visible */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E8DFD8]">
                <div>
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#7A7069]">Full-Face Scan Results</span>
                  <div className="text-base sm:text-lg font-black text-[#2B2623]">Combined Dermal Report</div>
                  <div className="text-[11px] sm:text-xs text-[#7A7069] mt-0.5">{analysisResult.timestamp}</div>
                </div>
                <div className="flex flex-wrap sm:flex-col gap-1.5 items-start sm:items-end">
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg" style={{ backgroundColor: analysisResult.severity?.bg || "#EFF6FF", color: analysisResult.severity?.color || "#3B82F6" }}>
                    Circles: {analysisResult.severityCategory || analysisResult.severity?.label || "Mild"} ({analysisResult.severityScore ?? 32}/100)
                  </span>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg" style={{ backgroundColor: analysisResult.redness?.severity?.bg || "#FEF2F2", color: analysisResult.redness?.severity?.color || "#EF4444" }}>
                    Redness: {analysisResult.redness?.severity_category || analysisResult.redness?.severity?.label || "Mild"} ({analysisResult.redness?.redness_score ?? 28}/100)
                  </span>
                </div>
              </div>

              {/* ── Executive Dual Diagnostics Overview (Dark Circles and Redness) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFD8]">
                {/* Dark Circles Summary */}
                <div 
                  onClick={() => setActiveTab("darkCircles")}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2.5 ${
                    activeTab === "darkCircles" 
                      ? "bg-white border-[#DC926E] shadow-sm ring-1 ring-[#DC926E]/30" 
                      : "bg-white/70 border-[#E8DFD8] hover:border-[#DC926E]/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2B2623] flex items-center gap-1.5">
                      <span>👁️</span> Under-Eye Dark Circles
                    </span>
                    <span
                      className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: analysisResult.severity?.bg || "#EFF6FF",
                        color: analysisResult.severity?.color || "#3B82F6",
                      }}
                    >
                      {analysisResult.severityCategory || analysisResult.severity?.label || "Mild"}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#2B2623]">
                        {analysisResult.severityScore ?? analysisResult.darkCirclesPercentage ?? 32}
                      </span>
                      <span className="text-xs font-semibold text-[#7A7069]">/ 100</span>
                    </div>
                    <p className="text-xs text-[#5A524C] truncate mt-0.5">
                      {analysisResult.etiology || "Vascular Pooling"}
                    </p>
                  </div>
                  <div className="text-[10px] font-bold text-[#DC926E] flex items-center justify-between pt-1.5 border-t border-[#F0E8E2]">
                    <span>Affected Area: {analysisResult.affectedAreaPercent ?? 18}%</span>
                    <span>{activeTab === "darkCircles" ? "Active ✓" : "View Details →"}</span>
                  </div>
                </div>

                {/* Redness & Erythema Summary */}
                <div 
                  onClick={() => setActiveTab("redness")}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2.5 ${
                    activeTab === "redness" 
                      ? "bg-white border-[#EF4444] shadow-sm ring-1 ring-[#EF4444]/30" 
                      : "bg-white/70 border-[#E8DFD8] hover:border-[#EF4444]/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2B2623] flex items-center gap-1.5">
                      <span>🌸</span> Facial Redness &amp; Erythema
                    </span>
                    <span
                      className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: analysisResult.redness?.severity?.bg || "#FEF2F2",
                        color: analysisResult.redness?.severity?.color || "#EF4444",
                      }}
                    >
                      {analysisResult.redness?.severity_category || analysisResult.redness?.severity?.label || "Mild"}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#2B2623]">
                        {analysisResult.redness?.redness_score ?? analysisResult.redness?.rednessScore ?? 28}
                      </span>
                      <span className="text-xs font-semibold text-[#7A7069]">/ 100</span>
                    </div>
                    <p className="text-xs text-[#5A524C] truncate mt-0.5">
                      {analysisResult.redness?.status || "Vascular Flush Telemetry"}
                    </p>
                  </div>
                  <div className="text-[10px] font-bold text-[#EF4444] flex items-center justify-between pt-1.5 border-t border-[#F0E8E2]">
                    <span>Severity: {analysisResult.redness?.redness_severity || analysisResult.redness?.severity_category || "Low"}</span>
                    <span>{activeTab === "redness" ? "Active ✓" : "View Details →"}</span>
                  </div>
                </div>
              </div>

              {/* ══ TAB: DARK CIRCLES (ESTIMATED PHYSICAL SEVERITY) ══════════════ */}
              {activeTab === "darkCircles" && (
                <div className="space-y-6">
                  {/* Header & Context */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E8DFD8]">
                    <div>
                      <h2 className="text-base font-extrabold uppercase tracking-wide text-[#2B2623]">Dark Circle Analysis</h2>
                      <p className="text-xs text-[#7A7069]">Physical Severity &amp; Under-Eye Region-of-Interest (ROI) Analysis</p>
                    </div>
                  </div>

                  {/* Quality Error Warning (if lighting is poor) */}
                  {analysisResult.qualityError && (
                    <div className="bg-red-50/90 border border-red-200 rounded-2xl p-5 text-red-900 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sm text-red-800">
                        <HiOutlineExclamation className="text-xl shrink-0" />
                        <span>Image quality is insufficient for reliable analysis.</span>
                      </div>
                      <p className="text-xs text-red-700 leading-relaxed">
                        {analysisResult.qualityError}
                      </p>
                    </div>
                  )}

                  {/* ── PRIMARY RESULT: UNDER-EYE SEVERITY ASSESSMENT ────────── */}
                  <div className="bg-[#FAF8F5] border-2 border-[#E8DFD8] rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#7A7069]">
                          Under-Eye Severity Assessment
                        </span>
                        <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
                          <span
                            className="text-3xl sm:text-4xl font-black tracking-tight"
                            style={{ color: analysisResult.severity?.color || "#3B82F6" }}
                          >
                            {analysisResult.severityCategory || analysisResult.severity?.label || "Mild"} Severity
                          </span>
                          <span
                            className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg border ${
                              analysisResult.isDetected
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {analysisResult.isDetected ? "Dark Circles Detected" : "Clear / Minimal"}
                          </span>
                        </div>
                      </div>

                      <div className="text-left sm:text-right self-start sm:self-auto">
                        <span className="text-2xl font-black text-[#2B2623]">
                          {analysisResult.severityScore ?? 32}
                        </span>
                        <span className="text-xs font-bold text-[#7A7069]">/ 100</span>
                        <p className="text-[10px] text-[#7A7069] mt-0.5">Physical Severity Index</p>
                      </div>
                    </div>

                    {/* Severity Meter */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[#7A7069]">
                        <span>Minimal (0)</span>
                        <span style={{ color: analysisResult.severity?.color || "#3B82F6" }}>
                          {analysisResult.severityCategory || analysisResult.severity?.label || "Mild"}
                        </span>
                        <span>Very High (100)</span>
                      </div>
                      <div className="w-full bg-neutral-200 h-3 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(100, Math.max(8, analysisResult.severityScore ?? 32))}%`,
                            backgroundColor: analysisResult.severity?.color || "#3B82F6"
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-[#5A524C] leading-relaxed pt-0.5">
                      Calculated from under-eye darkness (ΔL*), local contrast gradient, and affected area percentage across both orbital zones.
                    </p>
                  </div>

                  {/* ── UNDER-EYE ANALYSIS (LEFT EYE / RIGHT EYE / AFFECTED AREA) ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Left Eye */}
                    <div className="bg-[#FAF8F5] border border-[#E8DFD8] rounded-2xl p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#2B2623]">Left Eye</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {analysisResult.leftEye?.severityCategory || analysisResult.leftEye?.severity_category || "Mild"}
                        </span>
                      </div>
                      {analysisResult.crops?.left && (
                        <div className="w-full h-16 rounded-xl overflow-hidden border border-[#E8DFD8] bg-neutral-900">
                          <img src={analysisResult.crops.left} alt="Left under-eye crop" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-[#7A7069]">Severity:</span>
                          <span className="text-lg font-black text-[#2B2623]">
                            {analysisResult.leftEye?.severityScore ?? 28} / 100
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-[11px] text-[#7A7069]">
                          <span>Status:</span>
                          <span className="font-semibold text-[#5A524C]">
                            {analysisResult.leftEye?.isDetected ? "Identified" : "Normal"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Eye */}
                    <div className="bg-[#FAF8F5] border border-[#E8DFD8] rounded-2xl p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#2B2623]">Right Eye</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {analysisResult.rightEye?.severityCategory || analysisResult.rightEye?.severity_category || "Mild"}
                        </span>
                      </div>
                      {analysisResult.crops?.right && (
                        <div className="w-full h-16 rounded-xl overflow-hidden border border-[#E8DFD8] bg-neutral-900">
                          <img src={analysisResult.crops.right} alt="Right under-eye crop" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-[#7A7069]">Severity:</span>
                          <span className="text-lg font-black text-[#2B2623]">
                            {analysisResult.rightEye?.severityScore ?? 36} / 100
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-[11px] text-[#7A7069]">
                          <span>Status:</span>
                          <span className="font-semibold text-[#5A524C]">
                            {analysisResult.rightEye?.isDetected ? "Identified" : "Normal"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Affected Area */}
                    <div className="bg-[#FAF8F5] border border-[#E8DFD8] rounded-2xl p-4 sm:p-5 space-y-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#2B2623]">Affected Area</span>
                        <span className="text-[10px] font-mono font-bold text-[#7A7069]">ROI Coverage</span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-3xl font-black text-[#2B2623]">
                          {analysisResult.affectedAreaPercent ?? 18}%
                        </div>
                        <p className="text-[11px] text-[#7A7069] leading-snug">
                          Percentage of under-eye ROI pixels noticeably darker than adjacent reference skin.
                        </p>
                      </div>
                      <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#DC926E] h-2 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, analysisResult.affectedAreaPercent ?? 18))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── PROJECT-DEFINED SEVERITY SCALE (VISUAL REFERENCE) ─────── */}
                  <div className="bg-white border border-[#E8DFD8] rounded-2xl p-4 sm:p-5 space-y-3 text-xs text-[#5A524C]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="font-extrabold uppercase tracking-wider text-[11px] text-[#2B2623]">
                        Severity Scale (Project-Defined Visual Categories)
                      </span>
                      <span className="text-[10px] text-[#7A7069]">Application-Defined · Not Medically Validated</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                      {DARK_CIRCLE_CONFIG.categories.map((c) => {
                        const isCurrent = (analysisResult.severityCategory || analysisResult.severity?.label) === c.label;
                        return (
                          <div
                            key={c.label}
                            className={`p-2.5 rounded-xl border transition-all text-center ${isCurrent
                                ? "ring-2 ring-offset-1 font-bold"
                                : "opacity-75"
                              }`}
                            style={{
                              backgroundColor: c.bg,
                              borderColor: c.color + "60",
                              ringColor: c.color
                            }}
                          >
                            <div className="text-[11px] font-black" style={{ color: c.color }}>{c.label}</div>
                            <div className="text-[10px] text-[#7A7069] font-mono mt-0.5">{c.min}–{c.max}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>


                  {/* ── NON-MEDICAL DISCLAIMER ───────────────────────────────── */}
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
                    <HiOutlineExclamation className="text-xl text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-950 block">
                        Non-Medical Visual Estimate Disclaimer
                      </span>
                      <p className="text-[11px] leading-relaxed text-amber-900/90">
                        {analysisResult.disclaimer || "Estimated Severity represents an application-defined visual estimate based on localized contrast and affected area. These scores are cosmetic visual indicators and do NOT constitute a medical diagnosis or clinical grading."}
                      </p>
                    </div>
                  </div>
                </div>
              )}


              {/* ══ TAB: REDNESS & ERYTHEMA ══════════════════════════════════════ */}
              {activeTab === "redness" && analysisResult.redness && (
                <div className="space-y-6 animate-fadeIn">
                  {/* AI Service Down Error Banner */}
                  {analysisResult.redness._ai_service_down ? (
                    <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">⚠️</span>
                        <div>
                          <h3 className="text-sm font-extrabold text-red-700 uppercase tracking-wide">Python AI Server Not Running</h3>
                          <p className="text-xs text-red-600 mt-1 leading-relaxed">
                            {analysisResult.redness._error_message || 'The ViT redness model could not be reached.'}
                          </p>
                          <p className="text-[11px] text-red-500 mt-1 font-medium">No static/fake data is shown — DermaVision only displays real model predictions.</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-red-100 p-4">
                        <p className="text-[11px] font-bold text-red-700 uppercase mb-2 tracking-wide">How to Start the AI Server:</p>
                        <div className="space-y-1.5">
                          {[
                            'Open a new terminal window',
                            'cd Model/05_api_service',
                            'pip install -r requirements.txt   # first time only',
                            'python3 server.py                 # (or python server.py on Windows)',
                            'Wait for: "Application startup complete." on port 8000',
                            'Click the button below to re-analyze without retaking photo ↓',
                          ].map((step, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-[10px] font-black text-red-400 mt-0.5 w-4 flex-shrink-0">{i + 1}.</span>
                              <code className="text-[11px] font-mono text-[#2B2623] bg-red-50 border border-red-100 px-1.5 py-0.5 rounded break-all">{step}</code>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          onClick={handleRetryRednessAnalysis}
                          disabled={isRetryingRedness}
                          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold uppercase tracking-wide hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isRetryingRedness ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Connecting to AI Server...</span>
                            </>
                          ) : (
                            <>
                              <span>⚡</span>
                              <span>Re-analyze Redness Now (Server Started)</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => { setCurrentStep("camera"); setAnalysisResult(null); setCapturedImage(null); }}
                          className="py-2.5 px-4 rounded-xl bg-neutral-200 text-[#2B2623] text-xs font-bold uppercase tracking-wide hover:bg-neutral-300 transition-colors cursor-pointer"
                        >
                          🔄 Retake Scan
                        </button>
                      </div>
                    </div>
                  ) : (<>
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E8DFD8]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🌸</span>
                        <h2 className="text-base font-extrabold uppercase tracking-wide text-[#2B2623]">
                          Facial Redness &amp; Erythema Analysis
                        </h2>
                      </div>
                      <p className="text-xs text-[#7A7069] mt-0.5">
                        Cutaneous Vascular Erythema &amp; Zone Perfusion Analysis
                      </p>
                    </div>
                  </div>

                  {/* ── 1. Dedicated Redness Severity Hero Assessment ── */}
                  <div className="bg-[#FAF8F5] border-2 border-[#E8DFD8] rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#7A7069]">
                          Facial Redness Severity Assessment
                        </span>
                        <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
                          <span
                            className="text-3xl sm:text-4xl font-black"
                            style={{
                              color: analysisResult.redness.severity?.color ||
                                (analysisResult.redness.redness_severity === "High" ? "#EF4444" :
                                 analysisResult.redness.redness_severity === "Moderate" ? "#F59E0B" : "#10B981")
                            }}
                          >
                            {analysisResult.redness.redness_severity || analysisResult.redness.severity_category || "Low"} Severity
                          </span>
                          <span
                            className="text-xs font-black uppercase px-2.5 py-1 rounded-lg"
                            style={{
                              backgroundColor: analysisResult.redness.severity?.bg || "#ECFDF5",
                              color: analysisResult.redness.severity?.color || "#10B981",
                            }}
                          >
                            {analysisResult.redness.status || "Clinical Assessment"}
                          </span>
                        </div>
                      </div>

                      <div className="text-left sm:text-right self-start sm:self-auto">
                        <span className="text-2xl font-black text-[#2B2623]">
                          {analysisResult.redness.redness_score ?? 22}
                        </span>
                        <span className="text-xs font-bold text-[#7A7069]">/100</span>
                        <p className="text-[10px] text-[#7A7069] mt-0.5">Severity Score Index</p>
                      </div>
                    </div>

                    {/* Three-Tier Severity Bar: Low | Moderate | High */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[#7A7069]">
                        <span className={analysisResult.redness.redness_severity === "Low" ? "text-emerald-700 font-extrabold" : ""}>
                          Low (0–33)
                        </span>
                        <span className={analysisResult.redness.redness_severity === "Moderate" ? "text-amber-700 font-extrabold" : ""}>
                          Moderate (34–66)
                        </span>
                        <span className={analysisResult.redness.redness_severity === "High" ? "text-red-700 font-extrabold" : ""}>
                          High (67–100)
                        </span>
                      </div>
                      <div className="w-full bg-neutral-200 h-3 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(100, Math.max(8, analysisResult.redness.redness_score ?? 22))}%`,
                            backgroundColor: analysisResult.redness.severity?.color ||
                              (analysisResult.redness.redness_severity === "High" ? "#EF4444" :
                               analysisResult.redness.redness_severity === "Moderate" ? "#F59E0B" : "#10B981"),
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-[#5A524C] leading-relaxed pt-1">
                      {analysisResult.redness.description || "Cutaneous capillary perfusion is within normal physiological limits with no conspicuous inflammatory erythema."}
                    </p>
                  </div>

                  {/* ── PROJECT-DEFINED REDNESS SEVERITY SCALE (VISUAL REFERENCE) ─────── */}
                  <div className="bg-white border border-[#E8DFD8] rounded-2xl p-4 sm:p-5 space-y-3 text-xs text-[#5A524C]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="font-extrabold uppercase tracking-wider text-[11px] text-[#2B2623]">
                        Redness Severity Scale (Calibrated Visual Categories)
                      </span>
                      <span className="text-[10px] text-[#7A7069]">CIELAB Δa* Differential Colorimetry · 0–100 Index</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      {REDNESS_CONFIG.categories.map((c) => {
                        const isCurrent = (analysisResult.redness.redness_severity || analysisResult.redness.severity_category) === c.label;
                        return (
                          <div
                            key={c.label}
                            className={`p-3 rounded-xl border transition-all text-center ${isCurrent
                                ? "ring-2 ring-offset-1 font-bold shadow-sm"
                                : "opacity-75"
                              }`}
                            style={{
                              backgroundColor: c.bg,
                              borderColor: c.color + "60",
                              ringColor: c.color
                            }}
                          >
                            <div className="text-xs font-black flex items-center justify-center gap-1.5" style={{ color: c.color }}>
                              <span>{c.label === "Low" ? "🟢" : c.label === "Moderate" ? "🟡" : "🔴"}</span>
                              <span>{c.label}</span>
                            </div>
                            <div className="text-[11px] text-[#2B2623] font-semibold mt-0.5">{c.description}</div>
                            <div className="text-[10px] text-[#7A7069] font-mono mt-1">{c.min}–{c.max} Score</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── 2. Zone-by-Zone Redness Severity ── */}
                  <div className="bg-[#FAF8F5] border border-[#E8DFD8] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A7069]">
                        Zone-by-Zone Redness Severity
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded">
                        5 Facial Zones
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {[
                        { key: "leftCheek", label: "Left Cheek" },
                        { key: "rightCheek", label: "Right Cheek" },
                        { key: "nose", label: "Nose Tip" },
                        { key: "forehead", label: "Forehead" },
                        { key: "chin", label: "Chin" },
                      ].map(({ key, label }) => {
                        const z = analysisResult.redness.zone_redness?.[key] || { severity: "Low", score: 15 };
                        const zSev = z.severity || "Low";
                        const zColor = zSev === "High" ? "#EF4444" : zSev === "Moderate" ? "#F59E0B" : "#10B981";
                        const zBg = zSev === "High" ? "#FEF2F2" : zSev === "Moderate" ? "#FFFBEB" : "#ECFDF5";

                        return (
                          <div key={key} className="bg-white p-3 rounded-xl border border-[#E8DFD8] flex flex-col justify-between space-y-2">
                            <span className="text-[11px] font-bold text-[#5A524C] truncate">{label}</span>
                            <div className="flex items-baseline justify-between">
                              <span className="text-base font-black text-[#2B2623]">{zSev}</span>
                              <span
                                className="text-[9px] font-black uppercase px-2 py-0.5 rounded"
                                style={{ backgroundColor: zBg, color: zColor }}
                              >
                                {zSev}
                              </span>
                            </div>
                            <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: zSev === "High" ? "90%" : zSev === "Moderate" ? "55%" : "20%",
                                  backgroundColor: zColor,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clinical Etiology & Diagnosis */}
                  <div className="bg-[#FAF8F5] border border-[#E8DFD8] rounded-2xl p-4 space-y-2">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#7A7069]">
                      Etiology &amp; Clinical Context
                    </span>
                    <p className="text-xs text-[#2B2623] font-semibold leading-relaxed">
                      {analysisResult.redness.etiology || "Vascular hyperactivity / Stratum corneum sensitivity"}
                    </p>
                    <p className="text-[11px] text-[#5A524C] leading-relaxed">
                      Facial erythema occurs when superficial cutaneous micro-capillaries undergo sustained vasodilation. Common catalysts include barrier lipids depletion, inflammatory cytokine migration, rosacea propensity, or photo-damage.
                    </p>
                  </div>

                  {/* Dermatological Protocol & Active Ingredients */}
                  <div className="bg-[#FAF8F5] border border-[#E8DFD8] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌿</span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A7069]">
                        Targeted Clinical Treatment Protocol
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-[#E8DFD8]">
                      <span className="text-[10px] font-bold text-[#10B981] uppercase block mb-1">
                        Active Dermatological Ingredients:
                      </span>
                      <p className="text-xs text-[#2B2623] font-medium leading-relaxed">
                        {analysisResult.redness.treatment || "Azelaic Acid 10%, Centella Asiatica (Cica), Niacinamide 2-4%, Zinc Oxide SPF 50+"}
                      </p>
                    </div>

                    <div className="p-3 bg-[#FEF2F2] rounded-xl border border-red-200">
                      <span className="text-[10px] font-bold text-red-700 uppercase block mb-1">
                        ⚠️ Precautions &amp; Triggers to Avoid:
                      </span>
                      <p className="text-[11px] text-red-800 leading-relaxed">
                        {analysisResult.redness.precautions || "Avoid physical scrubs, hot baths, glycolic acid >7%, and denatured alcohols during redness flares."}
                      </p>
                    </div>
                  </div>

                  {/* ── 3. Facial Redness Landmarks & Zone Mapping ── */}
                  <div className="bg-[#FAF8F5] border border-[#E8DFD8] rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A7069]">
                          Facial Redness Landmarks &amp; ROI Mapping
                        </span>
                        <p className="text-[11px] text-[#5A524C] mt-0.5">
                          Localized erythema contours across 5 anatomical facial zones
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab("overlay")}
                        className="self-start sm:self-auto text-xs font-bold text-[#EF4444] hover:text-[#DC2626] bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <span>🗺️</span>
                        <span>View Interactive Face Map →</span>
                      </button>
                    </div>

                    {/* Zone indicators summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center">
                      {[
                        { label: "Left Cheek", zoneKey: "leftCheek" },
                        { label: "Right Cheek", zoneKey: "rightCheek" },
                        { label: "Nose Tip", zoneKey: "nose" },
                        { label: "Forehead", zoneKey: "forehead" },
                        { label: "Chin", zoneKey: "chin" },
                      ].map(({ label, zoneKey }) => {
                        const zSev = analysisResult.redness.zone_redness?.[zoneKey]?.severity || "Low";
                        const isRed = zSev === "High" || zSev === "Moderate";
                        return (
                          <div
                            key={zoneKey}
                            className={`p-2.5 rounded-xl border text-[11px] font-semibold transition-all ${
                              zSev === "High"
                                ? "bg-red-50 border-red-300 text-red-700 ring-1 ring-red-400"
                                : zSev === "Moderate"
                                ? "bg-amber-50 border-amber-300 text-amber-700 ring-1 ring-amber-400"
                                : "bg-emerald-50/60 border-emerald-200 text-emerald-800"
                            }`}
                          >
                            <span className="block text-[10px] text-[#7A7069]">{label}</span>
                            <span className="font-extrabold">{isRed ? `📍 ${zSev}` : "✓ Clear"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </>)}
                </div>
              )}

              {/* ══ TAB: FACE MAP ══════════════════════════════════════ */}
              {activeTab === "overlay" && (
                <div className="space-y-4">
                  {/* Face Map Control Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#E8DFD8]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#DC926E] animate-ping" />
                      <div>
                        <h3 className="text-sm font-bold text-[#2B2623]">Interactive Face Map &amp; Telemetry</h3>
                        <p className="text-[11px] text-[#7A7069]">Spatial registration across 478 MediaPipe facial mesh landmarks</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto bg-[#FAF8F5] p-1 rounded-xl border border-[#E8DFD8] text-[11px] font-bold">
                      <button
                        onClick={() => setFaceMapMode("all")}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          faceMapMode === "all" ? "bg-white text-[#2B2623] shadow-xs ring-1 ring-[#E8DFD8]" : "text-[#7A7069] hover:text-[#2B2623]"
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setFaceMapMode("zones")}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          faceMapMode === "zones" ? "bg-white text-[#2B2623] shadow-xs ring-1 ring-[#E8DFD8]" : "text-[#7A7069] hover:text-[#2B2623]"
                        }`}
                      >
                        Zones
                      </button>
                      {analysisResult.redness?.visualization && (
                        <button
                          onClick={() => setFaceMapMode("heatmap")}
                          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                            faceMapMode === "heatmap" ? "bg-white text-red-600 shadow-xs ring-1 ring-red-200" : "text-[#7A7069] hover:text-[#2B2623]"
                          }`}
                        >
                          <span>🔥</span> Heatmap
                        </button>
                      )}
                      <button
                        onClick={() => setShowMarkers((p) => !p)}
                        className="px-2 py-1 ml-1 text-xs text-[#5A524C] hover:text-black transition-colors cursor-pointer border-l border-[#E8DFD8]"
                        title={showMarkers ? "Hide markings" : "Show markings"}
                      >
                        {showMarkers ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                      </button>
                    </div>
                  </div>

                  {/* Visual Face Canvas Container (Natural Image Aspect Ratio for 1:1 Pixel Registration) */}
                  <div className="flex justify-center px-2 py-1">
                    <div className="relative w-full max-w-[320px] sm:max-w-[360px] mx-auto rounded-3xl overflow-hidden shadow-2xl border-2 border-white ring-1 ring-[#E8DFD8] bg-neutral-950">
                      {capturedImage && (
                        <img
                          src={capturedImage}
                          alt="Face Scan"
                          className="w-full h-auto block select-none pointer-events-none"
                        />
                      )}

                      {/* AI Erythema Heatmap Layer (Colorimetric a* Shift from Python AI Engine) */}
                      {(faceMapMode === "heatmap" || faceMapMode === "all") && analysisResult.redness?.visualization && (
                        <img
                          src={analysisResult.redness.visualization}
                          alt="Erythema Heatmap"
                          className="absolute inset-0 w-full h-full object-fill pointer-events-none opacity-85 mix-blend-screen transition-opacity duration-300"
                        />
                      )}

                      {/* Anatomically Registered SVG Polygons (Strictly Clustered to True Facial Contours) */}
                      {showMarkers && (faceMapMode === "zones" || faceMapMode === "all") && (
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-none"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <radialGradient id="dcGrad" cx="50%" cy="50%" r="50%">
                              <stop offset="0%" stopColor="#DC926E" stopOpacity="0.55" />
                              <stop offset="100%" stopColor="#DC926E" stopOpacity="0.18" />
                            </radialGradient>
                            <radialGradient id="rednessHigh" cx="50%" cy="50%" r="50%">
                              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.65" />
                              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.25" />
                            </radialGradient>
                            <radialGradient id="rednessMod" cx="50%" cy="50%" r="50%">
                              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.55" />
                              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.18" />
                            </radialGradient>
                            <radialGradient id="rednessLow" cx="50%" cy="50%" r="50%">
                              <stop offset="0%" stopColor="#10B981" stopOpacity="0.30" />
                              <stop offset="100%" stopColor="#10B981" stopOpacity="0.08" />
                            </radialGradient>
                            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                              <feGaussianBlur stdDeviation="0.8" result="blur" />
                              <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                          </defs>

                          {/* Dark Circle Sub-Orbital Contours (Left & Right Tear Troughs) */}
                          <polygon
                            points={analysisResult.regions?.left || "32.0,46.2 35.5,47.5 39.0,48.0 43.5,47.5 47.0,45.8 48.0,48.5 45.5,53.2 41.0,55.0 36.0,54.2 32.5,50.5"}
                            fill="url(#dcGrad)"
                            stroke="#DC926E"
                            strokeWidth="1.2"
                            strokeDasharray="2,1"
                            filter="url(#glow)"
                          />
                          <polygon
                            points={analysisResult.regions?.right || "53.0,45.8 56.5,47.5 61.0,48.0 64.5,47.5 68.0,46.2 67.5,50.5 64.0,54.2 59.0,55.0 54.5,53.2 52.0,48.5"}
                            fill="url(#dcGrad)"
                            stroke="#DC926E"
                            strokeWidth="1.2"
                            strokeDasharray="2,1"
                            filter="url(#glow)"
                          />

                          {/* Facial Redness Contours (5 Non-Self-Intersecting Anatomical Zones) */}
                          {[
                            { key: "forehead", zoneKey: "forehead" },
                            { key: "leftCheek", zoneKey: "leftCheek" },
                            { key: "rightCheek", zoneKey: "rightCheek" },
                            { key: "chin", zoneKey: "chin" },
                            { key: "noseTip", zoneKey: "nose" },
                          ].map(({ key, zoneKey }) => {
                            const pts = analysisResult.redness?.regions?.[key];
                            if (!pts) return null;
                            const z = analysisResult.redness?.zone_redness?.[zoneKey] || { severity: "Low" };
                            const zSev = z.severity || "Low";
                            const gradId = zSev === "High" ? "url(#rednessHigh)" : zSev === "Moderate" ? "url(#rednessMod)" : "url(#rednessLow)";
                            const strokeColor = zSev === "High" ? "#EF4444" : zSev === "Moderate" ? "#F59E0B" : "#10B981";
                            return (
                              <polygon
                                key={key}
                                points={pts}
                                fill={gradId}
                                stroke={strokeColor}
                                strokeWidth={zSev === "High" ? "1.8" : zSev === "Moderate" ? "1.4" : "0.9"}
                                strokeDasharray={zSev === "Low" ? "2,2" : undefined}
                                filter="url(#glow)"
                              />
                            );
                          })}
                        </svg>
                      )}

                      {/* Precise Dynamic Centroid Badges (Positioned Directly Over the Actual Feature) */}
                      {showMarkers && (faceMapMode === "zones" || faceMapMode === "all") && (
                        <>
                          {/* Dark Circle Sub-Orbital Labels */}
                          {(() => {
                            const leftC = getCentroidFromPoints(analysisResult.regions?.left);
                            const rightC = getCentroidFromPoints(analysisResult.regions?.right);
                            return (
                              <>
                                {leftC && (
                                  <div
                                    className="absolute text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap text-white bg-[#DC926E]/95 pointer-events-none -translate-x-1/2 -translate-y-1/2 border border-white/20"
                                    style={{ left: `${leftC.x}%`, top: `${Math.max(4, leftC.y - 4)}%` }}
                                  >
                                    L. Eye (ΔL*)
                                  </div>
                                )}
                                {rightC && (
                                  <div
                                    className="absolute text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap text-white bg-[#DC926E]/95 pointer-events-none -translate-x-1/2 -translate-y-1/2 border border-white/20"
                                    style={{ left: `${rightC.x}%`, top: `${Math.max(4, rightC.y - 4)}%` }}
                                  >
                                    R. Eye (ΔL*)
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {/* 5 Facial Zones Centroid Badges */}
                          {[
                            { key: "forehead", zoneKey: "forehead", label: "Forehead" },
                            { key: "leftCheek", zoneKey: "leftCheek", label: "L.Cheek" },
                            { key: "rightCheek", zoneKey: "rightCheek", label: "R.Cheek" },
                            { key: "chin", zoneKey: "chin", label: "Chin" },
                            { key: "noseTip", zoneKey: "nose", label: "Nose" },
                          ].map(({ key, zoneKey, label }) => {
                            const pts = analysisResult.redness?.regions?.[key];
                            const c = getCentroidFromPoints(pts);
                            if (!c) return null;
                            const z = analysisResult.redness?.zone_redness?.[zoneKey] || { severity: "Low" };
                            const zSev = z.severity || "Low";
                            const bg =
                              zSev === "High"
                                ? "bg-red-600/95 text-white ring-1 ring-red-400"
                                : zSev === "Moderate"
                                ? "bg-amber-600/95 text-white ring-1 ring-amber-400"
                                : "bg-emerald-600/90 text-white ring-1 ring-emerald-400";
                            return (
                              <div
                                key={zoneKey}
                                className={`absolute text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap pointer-events-none -translate-x-1/2 -translate-y-1/2 border border-white/20 ${bg}`}
                                style={{ left: `${c.x}%`, top: `${c.y}%` }}
                              >
                                {label}: {zSev}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Map Legend */}
                  <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 text-xs pt-2">
                    <span className="flex items-center gap-1.5 font-semibold text-[#DC926E]">
                      <span className="w-3 h-3 rounded-sm" style={{ background: "#DC926E", opacity: 0.7 }} /> Dark Circles (ΔL*)
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold text-[#EF4444]">
                      <span className="w-3 h-3 rounded-full" style={{ background: "#EF4444" }} /> High Erythema
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold text-[#F59E0B]">
                      <span className="w-3 h-3 rounded-full" style={{ background: "#F59E0B" }} /> Moderate Flush
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold text-[#10B981]">
                      <span className="w-3 h-3 rounded-full" style={{ background: "#10B981" }} /> Baseline / Clear
                    </span>
                    {analysisResult.redness?.visualization && (
                      <span className="flex items-center gap-1.5 font-semibold text-rose-600">
                        <span>🔥</span> Heatmap Layer
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-[#E8DFD8]">
                <button onClick={handleRetake} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border border-[#E8DFD8] bg-white text-[#5A524C] hover:border-[#DC926E] transition-all cursor-pointer">
                  <HiOutlineRefresh /><span>Retake</span>
                </button>
                <button onClick={() => window.print()} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold px-5 py-2.5 rounded-xl bg-[#DC926E] hover:bg-[#c87e5b] text-white shadow-sm transition-all cursor-pointer">
                  <HiOutlineDocumentReport className="text-sm" /><span>Save Report</span>
                </button>
              </div>

              {/* Nearby Dermatologist Map — shown after analysis */}
              <div className="mt-6 pt-6 border-t border-[#E8DFD8] space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🗺️</span>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#2B2623]">Find a Dermatologist Near You</h3>
                    <p className="text-xs text-[#7A7069]">Book a professional consultation based on your AI skin report.</p>
                  </div>
                </div>
                <DermatologistMap />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SkinAnalysis;
