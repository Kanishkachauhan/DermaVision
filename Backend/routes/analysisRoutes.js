// Backend/routes/analysisRoutes.js
import express from 'express';
import { analyzeDarkCircles, analyzeAcne } from '../controllers/analysisController.js';

const router = express.Router();

// POST /api/analysis/dark-circles
router.post('/dark-circles', analyzeDarkCircles);

// POST /api/analysis/acne
router.post('/acne', analyzeAcne);

export default router;
