// Backend/routes/doctorRoutes.js
import express from 'express';
import { query, body } from 'express-validator';
import validateRequest from '../middleware/validateRequest.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { getNearbyDoctors, enrichDoctors } from '../controllers/doctorController.js';

const router = express.Router();

/**
 * GET /api/doctors/nearby
 * Server-side Overpass call (for Postman/testing; browsers use client-side Overpass)
 */
router.get(
  '/nearby',
  generalLimiter,
  [
    query('lat').notEmpty().isFloat({ min: -90,  max: 90  }).withMessage('lat must be -90 to 90'),
    query('lng').notEmpty().isFloat({ min: -180, max: 180 }).withMessage('lng must be -180 to 180'),
    query('specialty').optional().isString().trim().isLength({ min: 2, max: 60 }),
    query('radius').optional().isInt({ min: 500, max: 50000 }),
  ],
  validateRequest,
  getNearbyDoctors,
);

/**
 * POST /api/doctors/enrich
 * Accepts raw OSM doctor list from frontend and returns Gemini-enriched categories.
 * Body: { doctors: [...], specialty: "dermatologist" }
 */
router.post(
  '/enrich',
  generalLimiter,
  [
    body('doctors').isArray({ min: 1, max: 50 }).withMessage('doctors must be an array of 1–50 items'),
    body('specialty').optional().isString().trim().isLength({ min: 2, max: 60 }),
  ],
  validateRequest,
  enrichDoctors,
);

export default router;
