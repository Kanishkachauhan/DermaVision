// controllers/reportController.js
import asyncHandler from 'express-async-handler';
import Report from '../models/report.js';
import User from '../models/User.js';
import generateReportPDF from '../utils/generatePDF.js';

export const getMyReports = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  const [reports, total] = await Promise.all([
    Report.find({ user: req.user._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Report.countDocuments({ user: req.user._id }),
  ]);

  res.json({ success: true, page, totalPages: Math.ceil(total / limit), totalReports: total, reports });
});

export const getReportById = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);
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
  const pdfBuffer = await generateReportPDF({ user, report });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="dermavision-report-${report._id}.pdf"`,
  });
  res.send(pdfBuffer);
});

export const getProgress = asyncHandler(async (req, res) => {
  const reports = await Report.find({ user: req.user._id }).sort({ createdAt: 1 })
    .select('healthScore skinType predictions createdAt imageUrl');

  const timeline = reports.map((r) => ({ date: r.createdAt, healthScore: r.healthScore }));

  const conditionCounts = {};
  reports.forEach((r) => r.predictions.forEach((p) => {
    conditionCounts[p.condition] = (conditionCounts[p.condition] || 0) + 1;
  }));

  const first = reports[0];
  const latest = reports[reports.length - 1];
  const improvementPercent = first && latest && first.healthScore > 0
    ? Number((((latest.healthScore - first.healthScore) / first.healthScore) * 100).toFixed(1))
    : 0;

  res.json({ success: true, timeline, conditionCounts, improvementPercent, firstReport: first || null, latestReport: latest || null });
});