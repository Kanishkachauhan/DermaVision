// Backend/controllers/reportController.js
import asyncHandler from 'express-async-handler';
import Report from '../models/report.js';
import User from '../models/User.js';
import { generateBackendClinicalPdf } from '../utils/pdfGenerator.js';
import { generatePersonalizedRecommendation } from '../services/recommendationService.js';

/**
 * @desc    Create a new skin analysis report and auto-generate personalized recommendations
 * @route   POST /api/reports
 * @access  Private
 */
export const createReport = asyncHandler(async (req, res) => {
  const {
    imageUrl,
    imagePublicId,
    skinType = 'Combination',
    healthScore = 80,
    predictions = [],
    diagnosticMetrics = {},
    notes = '',
  } = req.body;

  const validSkinTypes = ['Oily', 'Dry', 'Combination', 'Normal'];
  const normalizedSkinType = validSkinTypes.includes(skinType) ? skinType : 'Combination';

  const normalizedPredictions = Array.isArray(predictions)
    ? predictions.map((p) => {
        const sevStr = String(p.severity || '').toLowerCase();
        let safeSev = 'Low';
        if (sevStr.includes('high') || sevStr.includes('severe')) safeSev = 'High';
        else if (sevStr.includes('mod')) safeSev = 'Moderate';

        return {
          condition: String(p.condition || 'General Tone'),
          confidence: Math.max(0, Math.min(100, Math.round(Number(p.confidence) || 80))),
          severity: safeSev,
        };
      })
    : [];

  const report = new Report({
    user: req.user._id,
    imageUrl: imageUrl || '/scan-placeholder.jpg',
    imagePublicId: imagePublicId || '',
    skinType: normalizedSkinType,
    healthScore: Math.max(0, Math.min(100, Number(healthScore) || 80)),
    predictions: normalizedPredictions,
    notes: typeof notes === 'string' ? notes.slice(0, 500) : '',
  });

  await report.save();

  // Automatically generate and persist personalized recommendations for this report
  let recommendation = null;
  try {
    recommendation = await generatePersonalizedRecommendation({
      userId: req.user._id,
      reportId: report._id,
      diagnosticData: {
        skinType: normalizedSkinType,
        healthScore: report.healthScore,
        ...diagnosticMetrics,
      },
    });
  } catch (recErr) {
    console.error('[reportController] Warning: Recommendation generation deferred:', recErr.message);
  }

  const populatedReport = await Report.findById(report._id).populate('recommendations.recommendedProductIds');

  res.status(201).json({
    success: true,
    message: 'Skin analysis report saved and personalized recommendations created.',
    report: populatedReport,
    recommendation,
  });
});

/**
 * @desc    Get all reports for the authenticated user
 * @route   GET /api/reports
 * @access  Private
 */
export const getMyReports = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  const [reports, total] = await Promise.all([
    Report.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('recommendations.recommendedProductIds'),
    Report.countDocuments({ user: req.user._id }),
  ]);

  res.json({
    success: true,
    page,
    totalPages: Math.ceil(total / limit),
    totalReports: total,
    reports,
  });
});

/**
 * @desc    Get a single report by ID
 * @route   GET /api/reports/:id
 * @access  Private
 */
export const getReportById = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id).populate('recommendations.recommendedProductIds');
  if (!report) {
    res.status(404);
    throw new Error('Report not found');
  }

  const isOwner = report.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to view this report');
  }

  res.json({ success: true, report });
});

/**
 * @desc    Download report as clinical PDF
 * @route   GET /api/reports/:id/pdf
 * @access  Private
 */
export const downloadReportPDF = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) {
    res.status(404);
    throw new Error('Report not found');
  }

  const isOwner = report.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to access this report');
  }

  const user = await User.findById(report.user);

  // Adapt database report to PDF document payload
  const pdfPayload = {
    reportId: `DV-${report._id.toString().slice(-6).toUpperCase()}`,
    patientName: user?.name || 'Patient',
    patientId: `PT-${user?._id?.toString().slice(-6).toUpperCase() || 'USER'}`,
    date: report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US'),
    skinType: report.skinType,
    skinHealthScore: report.healthScore,
    skinHealthGrade: report.healthScore >= 80 ? 'Optimal Condition' : report.healthScore >= 60 ? 'Good (Mild Concern)' : 'Requires Gentle Care',
  };

  generateBackendClinicalPdf(pdfPayload, res);
});

/**
 * @desc    Get user skin health progress and historical trends
 * @route   GET /api/reports/progress
 * @access  Private
 */
export const getProgress = asyncHandler(async (req, res) => {
  const reports = await Report.find({ user: req.user._id })
    .sort({ createdAt: 1 })
    .select('healthScore skinType predictions createdAt imageUrl');

  const timeline = reports.map((r) => ({
    date: r.createdAt,
    healthScore: r.healthScore,
  }));

  const conditionCounts = {};
  reports.forEach((r) =>
    r.predictions.forEach((p) => {
      conditionCounts[p.condition] = (conditionCounts[p.condition] || 0) + 1;
    })
  );

  const first = reports[0];
  const latest = reports[reports.length - 1];
  const improvementPercent =
    first && latest && first.healthScore > 0
      ? Number((((latest.healthScore - first.healthScore) / first.healthScore) * 100).toFixed(1))
      : 0;

  res.json({
    success: true,
    timeline,
    conditionCounts,
    improvementPercent,
    firstReport: first || null,
    latestReport: latest || null,
  });
});
