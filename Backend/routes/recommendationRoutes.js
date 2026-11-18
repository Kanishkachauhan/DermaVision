// Backend/routes/recommendationRoutes.js
import express from 'express';
import { protect, optionalAuth } from '../middleware/auth.js';
import {
  generateRecommendation,
  evaluatePreviewRecommendation,
  getRecommendationByReport,
  getMyRecommendations,
  getMyActiveRoutine,
  getRecommendationById,
} from '../controllers/recommendationController.js';

const router = express.Router();

// POST /api/recommendations/evaluate (Public/optionalAuth: instant telemetry-based recommendation)
router.post('/evaluate', optionalAuth, evaluatePreviewRecommendation);

// All subsequent recommendation endpoints require authentication
router.use(protect);

// POST /api/recommendations/generate
router.post('/generate', generateRecommendation);

// GET /api/recommendations/my (list user's recommendations history)
router.get('/my', getMyRecommendations);

// GET /api/recommendations/routine (get current active routine)
router.get('/routine', getMyActiveRoutine);

// GET /api/recommendations/report/:reportId (get active recommendation by report ID)
router.get('/report/:reportId', getRecommendationByReport);

// GET /api/recommendations/:id (get recommendation by ID)
router.get('/:id', getRecommendationById);

export default router;
