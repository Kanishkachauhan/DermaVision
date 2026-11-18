// Backend/controllers/routineController.js
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import SkincareRoutine from '../models/skincareRoutine.js';
import {
  createRoutineFromRecommendation,
  activateRoutine,
  markRoutineStepCompleted,
  getTodayRoutineStatus,
  toggleProductPause,
  removeProductFromRoutine,
  regenerateRoutineFromRecommendation,
} from '../services/routine/routineGeneratorService.js';

/**
 * @desc    Generate personalized routine from recommendation (Draft mode for review)
 * @route   POST /api/routines/generate
 * @access  Private
 */
export const generateRoutine = asyncHandler(async (req, res) => {
  const { recommendationId, schedule, autoActivate } = req.body;
  const userId = req.user._id;

  if (!recommendationId) {
    res.status(400);
    throw new Error('recommendationId is required to generate a routine.');
  }

  const routine = await createRoutineFromRecommendation({
    recommendationId,
    userId,
    options: {
      schedule,
      autoActivate: Boolean(autoActivate),
      userRole: req.user.role || 'user',
    },
  });

  res.status(201).json({
    success: true,
    message: 'Personalized routine generated successfully. Review routine before activating.',
    data: routine,
  });
});

/**
 * @desc    Get all routines for the authenticated user
 * @route   GET /api/routines/my
 * @access  Private
 */
export const getMyRoutines = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const routines = await SkincareRoutine.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate('morningRoutine.product eveningRoutine.product');

  res.json({
    success: true,
    total: routines.length,
    routines,
  });
});

/**
 * @desc    Get the current active routine for the authenticated user
 * @route   GET /api/routines/active
 * @access  Private
 */
export const getMyActiveRoutine = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const routine = await SkincareRoutine.findOne({ user: userId, status: 'active' })
    .sort({ activatedAt: -1 })
    .populate('morningRoutine.product eveningRoutine.product');

  if (!routine) {
    return res.status(404).json({
      success: false,
      message: 'No active skincare routine found. Review and activate a draft routine.',
    });
  }

  res.json({
    success: true,
    data: routine,
  });
});

/**
 * @desc    Get a routine by ID
 * @route   GET /api/routines/:id
 * @access  Private
 */
export const getRoutineById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid routine ID.');
  }

  const routine = await SkincareRoutine.findById(id).populate('morningRoutine.product eveningRoutine.product');
  if (!routine) {
    res.status(404);
    throw new Error('Routine not found.');
  }

  if (routine.user.toString() !== userId.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to access this routine.');
  }

  res.json({
    success: true,
    data: routine,
  });
});

/**
 * @desc    Activate a draft routine after user review
 * @route   PATCH /api/routines/:id/activate
 * @access  Private
 */
export const activateRoutineAction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const routine = await activateRoutine(id, userId, req.user.role || 'user');

  res.json({
    success: true,
    message: 'Skincare routine activated successfully! Daily schedule is now active.',
    data: routine,
  });
});

/**
 * @desc    Mark a routine step completed for today (or specified date)
 * @route   POST /api/routines/:id/complete-step
 * @access  Private
 */
export const completeRoutineStep = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { timeOfDay, stepId, date } = req.body;
  const userId = req.user._id;

  if (!stepId || !timeOfDay) {
    res.status(400);
    throw new Error('stepId and timeOfDay ("morning" or "evening") are required.');
  }

  const result = await markRoutineStepCompleted({
    routineId: id,
    userId,
    timeOfDay,
    stepId,
    date,
    userRole: req.user.role || 'user',
  });

  res.json({
    success: true,
    message: 'Step marked as completed.',
    data: result,
  });
});

/**
 * @desc    Get today's routine progress and completion status
 * @route   GET /api/routines/:id/today
 * @access  Private
 */
export const getTodayStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  const userId = req.user._id;

  const status = await getTodayRoutineStatus(id, userId, date);

  res.json({
    success: true,
    data: status,
  });
});

/**
 * @desc    Pause or resume an individual product in a routine
 * @route   PATCH /api/routines/:id/products/:productId/pause
 * @access  Private
 */
export const pauseProductAction = asyncHandler(async (req, res) => {
  const { id, productId } = req.params;
  const { isPaused } = req.body;
  const userId = req.user._id;

  const routine = await toggleProductPause({
    routineId: id,
    userId,
    productId,
    isPaused: isPaused !== undefined ? Boolean(isPaused) : true,
  });

  res.json({
    success: true,
    message: `Product ${isPaused ? 'paused' : 'resumed'} successfully.`,
    data: routine,
  });
});

/**
 * @desc    Remove a product from a routine and re-index steps
 * @route   DELETE /api/routines/:id/products/:productId
 * @access  Private
 */
export const removeProductAction = asyncHandler(async (req, res) => {
  const { id, productId } = req.params;
  const userId = req.user._id;

  const routine = await removeProductFromRoutine({
    routineId: id,
    userId,
    productId,
  });

  res.json({
    success: true,
    message: 'Product removed from routine. Application order re-sequenced.',
    data: routine,
  });
});

/**
 * @desc    Regenerate routine when recommendations change
 * @route   POST /api/routines/:id/regenerate
 * @access  Private
 */
export const regenerateRoutineAction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { recommendationId } = req.body;
  const userId = req.user._id;

  if (!recommendationId) {
    res.status(400);
    throw new Error('recommendationId is required to regenerate routine.');
  }

  const routine = await regenerateRoutineFromRecommendation({
    routineId: id,
    recommendationId,
    userId,
  });

  res.json({
    success: true,
    message: 'Routine regenerated successfully with updated recommendations.',
    data: routine,
  });
});
