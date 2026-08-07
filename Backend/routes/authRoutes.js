// routes/authRoutes.js
import express from 'express';
import { body } from 'express-validator';
import {
  registerUser,
  verifyOtp,
  loginUser,
  refreshAccessToken,
  logoutUser,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import validateRequest from '../middleware/validateRequest.js';

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validateRequest,
  registerUser
);

router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/login', authLimiter, [body('email').isEmail(), body('password').notEmpty()], validateRequest, loginUser);
router.post('/refresh', refreshAccessToken);
router.post('/logout', protect, logoutUser);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, [body('password').isLength({ min: 8 })], validateRequest, resetPassword);

export default router;