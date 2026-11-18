// Backend/routes/reportRoutes.js
import express from 'express';
import {
  createReport,
  getMyReports,
  getReportById,
  downloadReportPDF,
  getProgress,
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// POST /api/reports (create scan report + auto-generate recommendations)
router.post('/', createReport);

// GET /api/reports (list user reports)
router.get('/', getMyReports);

// GET /api/reports/progress (user timeline & condition trends)
router.get('/progress', getProgress);

// GET /api/reports/:id (get report details)
router.get('/:id', getReportById);

// GET /api/reports/:id/pdf (download clinical PDF)
router.get('/:id/pdf', downloadReportPDF);

export default router;
