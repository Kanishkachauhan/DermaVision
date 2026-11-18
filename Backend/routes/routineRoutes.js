// Backend/routes/routineRoutes.js
import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  generateRoutine,
  getMyRoutines,
  getMyActiveRoutine,
  getRoutineById,
  activateRoutineAction,
  completeRoutineStep,
  getTodayStatus,
  pauseProductAction,
  removeProductAction,
  regenerateRoutineAction,
} from '../controllers/routineController.js';

const router = express.Router();

// All routine endpoints require authentication
router.use(protect);

// POST /api/routines/generate - Generate draft routine from recommendation
router.post('/generate', generateRoutine);

// GET /api/routines/my - List user's routines
router.get('/my', getMyRoutines);

// GET /api/routines/active - Get current active routine
router.get('/active', getMyActiveRoutine);

// GET /api/routines/:id - Get specific routine by ID
router.get('/:id', getRoutineById);

// PATCH /api/routines/:id/activate - Review & activate routine
router.patch('/:id/activate', activateRoutineAction);

// POST /api/routines/:id/complete-step - Mark a step as completed today
router.post('/:id/complete-step', completeRoutineStep);

// GET /api/routines/:id/today - Get today's completion progress
router.get('/:id/today', getTodayStatus);

// PATCH /api/routines/:id/products/:productId/pause - Pause or resume product
router.patch('/:id/products/:productId/pause', pauseProductAction);

// DELETE /api/routines/:id/products/:productId - Remove product & re-index steps
router.delete('/:id/products/:productId', removeProductAction);

// POST /api/routines/:id/regenerate - Regenerate routine from recommendation
router.post('/:id/regenerate', regenerateRoutineAction);

export default router;
