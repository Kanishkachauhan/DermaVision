import express from 'express';
import { analyzeDarkCircles, analyzeAcne, analyzeRedness, filterSkin } from '../controllers/analysisController.js';

const router = express.Router();

// POST /api/analysis/dark-circles
router.post('/dark-circles', analyzeDarkCircles);

// POST /api/analysis/acne
router.post('/acne', analyzeAcne);

// POST /api/analysis/redness (ViT face characteristics - varun1505/face-characteristics)
router.post('/redness', analyzeRedness);

// POST /api/analysis/filter (OpenCV skin filtering & illumination normalization)
router.post('/filter', filterSkin);

export default router;
