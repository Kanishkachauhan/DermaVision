// routes/reportRoutes.js
import express from 'express';
import { getMyReports, getReportById, downloadReportPDF, getProgress } from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getMyReports);
router.get('/progress', protect, getProgress);
router.get('/:id', protect, getReportById);
router.get('/:id/pdf', protect, downloadReportPDF);

export default router;