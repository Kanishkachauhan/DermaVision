// Backend/controllers/recommendationController.js
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Product from '../models/product.js';
import Recommendation from '../models/recommendation.js';
import SkincareRoutine from '../models/skincareRoutine.js';
import {
  generatePersonalizedRecommendation,
  getRecommendationForReport,
  getUserRecommendations,
  getUserActiveRoutine,
  evaluateRecommendationPure,
  MEDICAL_DISCLAIMER,
} from '../services/recommendationService.js';

/**
 * @desc    Generate personalized recommendations for a skin analysis report
 * @route   POST /api/recommendations/generate
 * @access  Private
 */
export const generateRecommendation = asyncHandler(async (req, res) => {
  const {
    reportId,
    diagnosticData,
    allergies,
    sensitivities,
    preferences,
    forceRegenerate,
  } = req.body;
  const userId = req.user._id;

  if (!reportId && (!diagnosticData || typeof diagnosticData !== 'object')) {
    res.status(400);
    throw new Error('Either a valid reportId or diagnosticData object is required to generate recommendations.');
  }

  const recommendation = await generatePersonalizedRecommendation({
    userId,
    reportId: reportId || null,
    diagnosticData: diagnosticData || null,
    allergies: Array.isArray(allergies) ? allergies : undefined,
    sensitivities: Array.isArray(sensitivities) ? sensitivities : undefined,
    preferences: preferences && typeof preferences === 'object' ? preferences : undefined,
    forceRegenerate: Boolean(forceRegenerate),
  });

  res.status(201).json({
    success: true,
    message: 'Personalized clinical recommendation generated successfully.',
    data: recommendation,
  });
});

/**
 * @desc    Get active recommendation for a specific report
 * @route   GET /api/recommendations/report/:reportId
 * @access  Private
 */
export const getRecommendationByReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user._id;
  const userRole = req.user.role || 'user';

  const recommendation = await getRecommendationForReport(reportId, userId, userRole);

  if (!recommendation) {
    return res.status(404).json({
      success: false,
      message: 'No recommendation found for the specified report ID.',
    });
  }

  res.json({
    success: true,
    data: recommendation,
  });
});

/**
 * @desc    Get all recommendations for the authenticated user
 * @route   GET /api/recommendations/my
 * @access  Private
 */
export const getMyRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page, limit } = req.query;

  const result = await getUserRecommendations(userId, page, limit);

  res.json({
    success: true,
    ...result,
  });
});

/**
 * @desc    Get the current active skincare routine for the authenticated user
 * @route   GET /api/recommendations/routine
 * @access  Private
 */
export const getMyActiveRoutine = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const routine = await getUserActiveRoutine(userId);

  if (!routine) {
    return res.status(404).json({
      success: false,
      message: 'No active skincare routine found. Complete a skin analysis to generate one.',
    });
  }

  res.json({
    success: true,
    data: routine,
  });
});

/**
 * @desc    Get recommendation details by Recommendation ID
 * @route   GET /api/recommendations/:id
 * @access  Private
 */
export const getRecommendationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const userRole = req.user.role || 'user';

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid Recommendation ID format.');
  }

  const recommendation = await Recommendation.findById(id)
    .populate('selectedProducts.product')
    .populate('morningRoutine.product')
    .populate('eveningRoutine.product')
    .populate({
      path: 'skincareRoutine',
      populate: { path: 'orderedProducts.product' },
    });

  if (!recommendation) {
    res.status(404);
    throw new Error('Recommendation record not found.');
  }

  // Security check: Only owner or admin may view
  if (recommendation.user.toString() !== userId.toString() && userRole !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to access this recommendation record.');
  }

  res.json({
    success: true,
    data: recommendation,
  });
});

/**
 * @desc    Evaluate recommendations and AM/PM routine directly from scan diagnostics (Works for guests and offline preview)
 *          When user is authenticated, persists the routine to MongoDB so step-completion ticks work.
 * @route   POST /api/recommendations/evaluate
 * @access  Public (Optional Auth)
 */
export const evaluatePreviewRecommendation = asyncHandler(async (req, res) => {
  const {
    diagnosticData = {},
    allergies = [],
    sensitivities = [],
    preferences = {},
  } = req.body;

  const activeProducts = await Product.find({ isActive: true }).lean();

  const userProfile = req.user
    ? {
        allergies: req.user.allergies || allergies,
        sensitivities: req.user.skinSensitivities || sensitivities,
        preferences: preferences,
      }
    : {
        allergies,
        sensitivities,
        preferences,
      };

  const evaluation = evaluateRecommendationPure({
    reportData: diagnosticData,
    userProfile,
    catalog: activeProducts,
    options: { allergies, sensitivities, preferences },
  });

  const mapStepKey = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('cleanse') || n.includes('wash')) return 'cleanse';
    if (n.includes('tone')) return 'tone';
    if (n.includes('eye')) return 'eye_care';
    if (n.includes('sun')) return 'sunscreen';
    if (n.includes('moistur') || n.includes('cream')) return 'moisturize';
    return 'treat';
  };

  const morningRoutineSteps = evaluation.morningRoutine.map((step) => ({
    stepNumber: step.stepOrder,
    applicationOrder: step.stepOrder,
    stepKey: mapStepKey(step.stepName),
    stepName: step.stepName,
    product: step.product,
    productName: step.productName,
    brand: step.brand,
    productImage: step.productImage || '/product-placeholder.svg',
    category: step.category || 'Cleanser',
    applicationInstructions: step.instructions,
    frequency: step.frequency || 'Daily (AM)',
    activeIngredients: step.activeIngredients || [],
    isPaused: false,
  }));

  const eveningRoutineSteps = evaluation.eveningRoutine.map((step) => ({
    stepNumber: step.stepOrder,
    applicationOrder: step.stepOrder,
    stepKey: mapStepKey(step.stepName),
    stepName: step.stepName,
    product: step.product,
    productName: step.productName,
    brand: step.brand,
    productImage: step.productImage || '/product-placeholder.svg',
    category: step.category || 'Moisturizer',
    applicationInstructions: step.instructions,
    frequency: step.frequency || 'Daily (PM)',
    activeIngredients: step.activeIngredients || [],
    isPaused: false,
  }));

  // ── When authenticated: persist routine to MongoDB so completion ticks work ──
  let companionRoutine;
  if (req.user) {
    try {
      // Deactivate any previous active routine for this user
      await SkincareRoutine.updateMany(
        { user: req.user._id, isActive: true },
        { $set: { isActive: false, status: 'archived' } }
      );

      const dbRoutine = new SkincareRoutine({
        user: req.user._id,
        name: `Personalized ${evaluation.diagnostics.skinType} Clinical Regimen`,
        skinType: evaluation.diagnostics.skinType,
        status: 'active',
        activatedAt: new Date(),
        timeOfApplication: 'daily',
        morningRoutine: morningRoutineSteps,
        eveningRoutine: eveningRoutineSteps,
        instructions: 'Follow the numbered sequence. Allow 60 seconds between active layers.',
        frequency: 'Daily (AM & PM)',
        durationWeeks: 6,
        isActive: true,
      });

      await dbRoutine.save();

      // Re-fetch with populated product details
      const populatedRoutine = await SkincareRoutine.findById(dbRoutine._id)
        .populate('morningRoutine.product')
        .populate('eveningRoutine.product')
        .lean();

      companionRoutine = populatedRoutine;
    } catch (dbErr) {
      console.warn('[evaluatePreviewRecommendation] DB save note:', dbErr.message);
      // Fall back to in-memory routine
      companionRoutine = {
        _id: new mongoose.Types.ObjectId(),
        name: `Personalized ${evaluation.diagnostics.skinType} Clinical Regimen`,
        skinType: evaluation.diagnostics.skinType,
        status: 'active',
        timeOfApplication: 'daily',
        morningRoutine: morningRoutineSteps,
        eveningRoutine: eveningRoutineSteps,
        instructions: 'Follow the numbered sequence.',
        frequency: 'Daily (AM & PM)',
        durationWeeks: 6,
        isActive: true,
        _isGuest: true,
      };
    }
  } else {
    // Guest: return in-memory routine with _isGuest flag
    companionRoutine = {
      _id: new mongoose.Types.ObjectId(),
      name: `Personalized ${evaluation.diagnostics.skinType} Clinical Regimen`,
      skinType: evaluation.diagnostics.skinType,
      status: 'active',
      timeOfApplication: 'daily',
      morningRoutine: morningRoutineSteps,
      eveningRoutine: eveningRoutineSteps,
      instructions: 'Follow the numbered sequence.',
      frequency: 'Daily (AM & PM)',
      durationWeeks: 6,
      isActive: true,
      _isGuest: true,
    };
  }

  res.json({
    success: true,
    message: 'Evaluated recommendations directly from facial telemetry.',
    data: {
      selectedProducts: evaluation.selectedProducts.map((sp) => ({
        product: sp,
        stepName: sp.category,
        primaryReason: sp.reason,
        matchScore: sp.matchScore,
        targetedConcerns: [sp.relevantConcern],
      })),
      formattedProducts: evaluation.selectedProducts,
      morningRoutine: morningRoutineSteps,
      eveningRoutine: eveningRoutineSteps,
      skincareRoutine: companionRoutine,
      diagnostics: evaluation.diagnostics,
      filteringStats: evaluation.filteringStats,
      disclaimer: MEDICAL_DISCLAIMER,
    },
  });
});
