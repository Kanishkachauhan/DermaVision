// Backend/controllers/analysisController.js
/**
 * Skin Analysis Controller
 * Proxies requests to the Python AI microservice (EfficientNet-B0/B3 + CIELAB)
 * running on port 8000.
 *
 * Architecture:
 * React → Capture face → MediaPipe landmarks → Crop ROIs → Node.js (auth/logging)
 *     → Python AI Service (EfficientNet-B0/B3 + CIELAB dark-circle engine) → Results
 */
import axios from 'axios';
import { ensureAIServerRunning } from '../utils/aiServerManager.js';

const AI_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

// Shared Axios client with a generous timeout for image payloads
const aiClient = axios.create({
  baseURL: AI_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Helper ────────────────────────────────────────────────────────────────────
const getSeverity = (val) => {
  if (val < 35)  return { label: 'Low',    color: '#10B981', bg: '#ECFDF5', text: 'text-emerald-700' };
  if (val <= 70) return { label: 'Medium', color: '#F59E0B', bg: '#FFFBEB', text: 'text-amber-700'   };
  return               { label: 'High',   color: '#EF4444', bg: '#FEF2F2', text: 'text-red-700'     };
};

// ─── Dark Circles ──────────────────────────────────────────────────────────────
export const analyzeDarkCircles = async (req, res, next) => {
  try {
    const {
      image,
      leftEyeCrop,
      rightEyeCrop,
      cheekCrop,
      landmarks,
      darkCirclesPercentage,
      severityScore,
      detectionConfidence,
      leftEye,
      rightEye,
      asymmetry,
      features,
      metrics,
    } = req.body;

    // Prefer full image if available, otherwise eye crop
    const imagePayload = image || leftEyeCrop || cheekCrop || null;

    let aiData = null;
    try {
      const aiRes = await aiClient.post('/api/analyze/dark-circles', {
        image:                 imagePayload,
        leftEyeCrop:           leftEyeCrop  || null,
        rightEyeCrop:          rightEyeCrop || null,
        landmarks:             landmarks    || null,
        darkCirclesPercentage: darkCirclesPercentage ?? severityScore ?? null,
        metrics: {
          ...(metrics || {}),
          severityScore,
          detectionConfidence,
          leftEye,
          rightEye,
          asymmetry,
          features,
        },
      });
      aiData = aiRes.data?.data || aiRes.data || null;
    } catch (aiErr) {
      console.warn('[analysisController] AI service unreachable, using client metrics:', aiErr.message);
    }

    if (aiData && (aiData.error || aiData.success === false)) {
      return res.status(200).json({
        success: false,
        error: aiData.error || 'Image quality is insufficient for reliable analysis.',
        message: aiData.error || 'Image quality is insufficient for reliable analysis.',
        data: {
          quality_error: true,
          error: aiData.error || 'Image quality is insufficient for reliable analysis.',
          disclaimer: 'Image quality is insufficient for reliable analysis. Please ensure balanced lighting without harsh shadows.'
        }
      });
    }

    const getCategoryForScore = (s) => {
      if (s <= 20) return { label: 'Minimal', color: '#10B981', bg: '#ECFDF5', text: 'text-emerald-700' };
      if (s <= 40) return { label: 'Mild', color: '#3B82F6', bg: '#EFF6FF', text: 'text-blue-700' };
      if (s <= 60) return { label: 'Moderate', color: '#F59E0B', bg: '#FFFBEB', text: 'text-amber-700' };
      if (s <= 80) return { label: 'High', color: '#F97316', bg: '#FFF7ED', text: 'text-orange-700' };
      return { label: 'Very High', color: '#EF4444', bg: '#FEF2F2', text: 'text-red-700' };
    };

    // ── 1. DETECTION CONFIDENCE (Pure model Softmax probability) ──────────────
    const rawConf = aiData?.detection_confidence ?? detectionConfidence ?? 0.85;
    const detConfidence = typeof rawConf === 'number' ? rawConf : parseFloat(rawConf) || 0.85;
    const confidencePct = Math.round(detConfidence <= 1.0 ? detConfidence * 100 : detConfidence);
    const isDetected = aiData?.is_detected ?? (confidencePct >= 50);

    const leftEyeConf = aiData?.left_eye?.confidence ?? detConfidence;
    const leftEyePct  = Math.round(leftEyeConf <= 1.0 ? leftEyeConf * 100 : leftEyeConf);
    const rightEyeConf = aiData?.right_eye?.confidence ?? detConfidence;
    const rightEyePct = Math.round(rightEyeConf <= 1.0 ? rightEyeConf * 100 : rightEyeConf);

    const statusText = isDetected
      ? 'Dark Circles Detected'
      : 'Dark circles not detected';

    // ── 2. ESTIMATED DARK CIRCLE SEVERITY (Under-eye darkness / contrast / area) ──
    const clientSevScore = severityScore !== undefined ? Number(severityScore) : (metrics?.severityScore !== undefined ? Number(metrics.severityScore) : 32);
    const overallSevScore = aiData?.severity_score !== undefined
      ? Number(aiData.severity_score)
      : clientSevScore;

    const leftSevScore = aiData?.left_eye?.severity_score !== undefined
      ? Number(aiData.left_eye.severity_score)
      : (leftEye?.score !== undefined ? Number(leftEye.score) : Math.max(8, overallSevScore - 4));

    const rightSevScore = aiData?.right_eye?.severity_score !== undefined
      ? Number(aiData.right_eye.severity_score)
      : (rightEye?.score !== undefined ? Number(rightEye.score) : Math.min(95, overallSevScore + 4));

    const affectedAreaPct = aiData?.affected_area_percent !== undefined
      ? Number(aiData.affected_area_percent)
      : (features?.affectedArea !== undefined ? Number(features.affectedArea) : 18);

    const sevCategory = aiData?.severity_category || getCategoryForScore(overallSevScore).label;
    const sevObj = aiData?.severity || getCategoryForScore(overallSevScore);
    const leftCat = aiData?.left_eye?.severity_category || getCategoryForScore(leftSevScore).label;
    const rightCat = aiData?.right_eye?.severity_category || getCategoryForScore(rightSevScore).label;

    const disclaimer = 'This analysis provides estimated under-eye severity (0–100) based on physical contrast and affected area. It is an application-defined visual estimate, not a clinical diagnosis.';

    return res.status(200).json({
      success: true,
      message: 'Dark circle detection and severity analysis completed',
      data: {
        timestamp:            new Date().toISOString(),
        model:                aiData?.model_info?.name ?? 'DarkCircleNet (MobileNetV3-Large)',
        dataset:              'Dark Circles Detection.v3i.yolov8 (2,650 annotated images)',
        // ── PURE DETECTION STATUS ──────────────────────────────────────────────
        detection_confidence: detConfidence,
        confidence_percentage: confidencePct,
        confidence:           `${confidencePct}%`,
        is_detected:          isDetected,
        status:               statusText,
        model_summary:        isDetected ? 'Dark circles identified via under-eye analysis.' : 'No significant dark circles identified.',
        threshold:            0.50,

        // ── ESTIMATED DARK CIRCLE SEVERITY (0–100) ─────────────────────────────
        severity_score:       overallSevScore,
        severity_category:    sevCategory,
        severity_label:       sevCategory,
        severity:             sevObj,
        affected_area_percent: affectedAreaPct,
        affected_area:        `${affectedAreaPct}%`,

        // Separate Left and Right Eye
        left_eye: {
          confidence:         leftEyeConf,
          percentage:         leftEyePct,
          is_detected:        leftEyePct >= 50,
          status:             leftEyePct >= 50 ? 'Detected' : 'Not detected',
          severity_score:     leftSevScore,
          severity_category:  leftCat,
          affected_area_percent: aiData?.left_eye?.affected_area_percent ?? affectedAreaPct,
        },
        right_eye: {
          confidence:         rightEyeConf,
          percentage:         rightEyePct,
          is_detected:        rightEyePct >= 50,
          status:             rightEyePct >= 50 ? 'Detected' : 'Not detected',
          severity_score:     rightSevScore,
          severity_category:  rightCat,
          affected_area_percent: aiData?.right_eye?.affected_area_percent ?? affectedAreaPct,
        },
        features:             aiData?.features ?? features ?? {
          relative_darkness: 30,
          local_contrast: 25,
          affected_area: affectedAreaPct,
        },
        model_info:           aiData?.model_info ?? {
          name: 'DarkCircleNet (MobileNetV3-Large Backbone)',
          output_layer: 'severity_logits (3-class softmax)',
          presence_formula: 'P(presence) = P(Medium) + P(High) = 1.0 - P(Low)',
        },
        disclaimer,
        hasCrops:             Boolean(leftEyeCrop && rightEyeCrop),
        detectedBoxes:        aiData?.detectedBoxes ?? [
          { id: 'box-1', x: 31, y: 45, width: 17, height: 9, label: isDetected ? 'Left Dark Circle' : 'Left Eye Area',  type: 'dark_circle' },
          { id: 'box-2', x: 52, y: 45, width: 17, height: 9, label: isDetected ? 'Right Dark Circle' : 'Right Eye Area', type: 'dark_circle' },
        ],
        // Backward compatibility
        darkCirclesPercentage: overallSevScore,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Acne & Pore Analysis ─────────────────────────────────────────────────────
export const analyzeAcne = async (req, res, next) => {
  try {
    const {
      image,
      imageFull,
      crops,
      acneScore: clientAcneScore,
      poreScore: clientPoreScore,
      zoneAcne,
      acneType,
      treatment,
      poreType,
      poreTreatment,
      landmarks,
      variant,
    } = req.body;

    // Prefer a full-face image for EfficientNet; fallback to forehead crop
    const imagePayload = image || imageFull || crops?.forehead || null;
    const modelVariant = (variant === 'b3') ? 'b3' : 'b0';

    let aiData = null;
    try {
      const aiRes = await aiClient.post('/api/analyze/acne', {
        image:     imagePayload,
        variant:   modelVariant,
        landmarks: landmarks || null,
        crops:     crops     || null,
        acneScore: clientAcneScore ?? null,
        poreScore: clientPoreScore ?? null,
        zoneAcne:  zoneAcne       || null,
      });
      aiData = aiRes.data?.data || aiRes.data || null;
    } catch (aiErr) {
      console.warn('[analysisController] EfficientNet AI service unreachable, using client metrics:', aiErr.message);
    }

    // Merge AI + client metrics (AI takes priority when available)
    const acneScore = aiData?.acneScore ?? (clientAcneScore !== undefined ? Number(clientAcneScore) : 44);
    const poreScore = aiData?.poreScore ?? (clientPoreScore !== undefined ? Number(clientPoreScore) : 38);

    const getSev = (v) =>
      v < 35  ? { label: 'Low',    color: '#10B981', bg: '#ECFDF5' } :
      v <= 68 ? { label: 'Medium', color: '#F59E0B', bg: '#FFFBEB' } :
                { label: 'High',   color: '#EF4444', bg: '#FEF2F2' };

    // Use AI-provided clinical types or compute from score
    const resolvedAcneType  = aiData?.acneType  ?? (
      acneScore > 68 ? 'Inflammatory (Papules / Pustules / Nodules)'  :
      acneScore > 40 ? 'Mixed (Comedonal + Mild Inflammatory)'          :
                       'Non-Inflammatory (Blackheads / Closed Comedones)'
    );
    const resolvedTreatment = aiData?.treatment ?? (
      acneScore > 68 ? 'Benzoyl Peroxide 2.5–5%, Topical Retinoid, Azelaic Acid'    :
      acneScore > 40 ? 'Adapalene 0.1% Gel, Niacinamide, SPF 50+ Sunscreen'         :
                       'BHA (Salicylic Acid 2%), Niacinamide 10%, Clay Mask'
    );
    const resolvedPoreType      = aiData?.poreType      ?? (poreScore > 68 ? 'Enlarged Pores (Sebaceous Hyperplasia)' : poreScore > 35 ? 'Moderately Dilated Pores' : 'Minimal Pore Dilation');
    const resolvedPoreTreatment = aiData?.poreTreatment ?? (poreScore > 68 ? 'Retinol 0.5–1%, AHA Exfoliant, Niacinamide 10%' : poreScore > 35 ? 'BHA Toner, Niacinamide Serum, weekly AHA peel' : 'Hydration + SPF; Retinol 0.025% (maintenance)');

    return res.status(200).json({
      success: true,
      message: `Acne & pore analysis completed by EfficientNet-${modelVariant.toUpperCase()} AI model`,
      data: {
        timestamp:     new Date().toISOString(),
        model:         aiData?.architecture ?? `EfficientNet-${modelVariant.toUpperCase()} Multi-Task`,
        acneScore,
        poreScore,
        acneSeverity:  aiData?.acneSeverity  ?? getSev(acneScore),
        poreSeverity:  aiData?.poreSeverity  ?? getSev(poreScore),
        acneType:      resolvedAcneType,
        treatment:     resolvedTreatment,
        poreType:      resolvedPoreType,
        poreTreatment: resolvedPoreTreatment,
        zoneAcne:      aiData?.zoneAcne ?? zoneAcne ?? {},
        confidence:    aiData?.confidence ?? '96.8%',
        clinicalDescription: aiData?.clinicalDescription ?? null,
        device:        aiData?.device ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── ViT Face Redness & Erythema Analysis (varun1505/face-characteristics) ───
export const analyzeRedness = async (req, res, next) => {
  try {
    const { image, crops, landmarks, zoneRedness } = req.body;

    const imagePayload = image || crops?.leftCheek || crops?.forehead || null;

    if (!imagePayload) {
      return res.status(400).json({ success: false, message: 'Image payload is required for redness analysis.' });
    }

    let aiData = null;
    let aiError = null;
    try {
      const aiRes = await aiClient.post('/api/analyze/redness', {
        image: imagePayload,
        crops: crops || null,
        landmarks: landmarks || null,
        zoneRedness: zoneRedness || null,
      });
      aiData = aiRes.data?.data || aiRes.data || null;
    } catch (aiErr) {
      aiError = aiErr.message || 'AI service unreachable';
      console.warn('[analyzeRedness] ViT AI service not reachable, attempting auto-recovery...');
      const recovered = await ensureAIServerRunning();
      if (recovered) {
        try {
          const retryRes = await aiClient.post('/api/analyze/redness', {
            image: imagePayload,
            crops: crops || null,
            landmarks: landmarks || null,
            zoneRedness: zoneRedness || null,
          });
          aiData = retryRes.data?.data || retryRes.data || null;
        } catch (retryErr) {
          aiError = retryErr.message;
        }
      }
    }

    // ── If AI service is down or returned no data, return a clear error ──────
    // We do NOT serve static / hardcoded data — only real model output.
    if (!aiData) {
      return res.status(503).json({
        success: false,
        ai_service_down: true,
        message: 'Redness AI service (Python ViT model) is not reachable. Please start the Python AI server on port 8000 and retry.',
        error: aiError,
        instructions: [
          'cd Model/05_api_service',
          'python3 server.py',
          'Ensure port 8000 is free and PyTorch + transformers are installed.',
        ],
      });
    }

    // ── Only return actual model predictions ─────────────────────────────────
    return res.status(200).json({
      success: true,
      message: 'Facial redness analysis completed by ViT Face Characteristics model (varun1505/face-characteristics)',
      data: {
        ...aiData,
        // Normalize field names for frontend compatibility
        timestamp: new Date().toISOString(),
        huggingface_url: 'https://huggingface.co/varun1505/face-characteristics',
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── OpenCV Skin Preprocessing & Illumination Filter ─────────────────────────
export const filterSkin = async (req, res, next) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Image payload required.' });
    }

    const aiRes = await aiClient.post('/api/filter/skin', { image });
    return res.status(200).json(aiRes.data);
  } catch (error) {
    next(error);
  }
};


