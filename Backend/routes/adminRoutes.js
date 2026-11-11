import express from 'express';
import { body, param } from 'express-validator';
import { adminOnly, protect } from '../middleware/auth.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  createDoctor,
  deleteDoctor,
  getDoctor,
  listDoctors,
  updateDoctor,
  updateDoctorStatus,
} from '../controllers/doctorProfileController.js';

const router = express.Router();

router.use(protect, adminOnly);

const doctorFields = [
  body().custom((_, { req }) => {
    const hasLatitude = req.body.latitude !== undefined && req.body.latitude !== null && req.body.latitude !== '';
    const hasLongitude = req.body.longitude !== undefined && req.body.longitude !== null && req.body.longitude !== '';
    return hasLatitude === hasLongitude;
  }).withMessage('Latitude and longitude must both be provided or both be left blank'),
  body('clinicName').trim().isLength({ min: 2, max: 160 }).withMessage('Enter a valid clinic name'),
  body('doctorName').trim().isLength({ min: 2, max: 120 }).withMessage('Enter a valid doctor name'),
  body('address').trim().isLength({ min: 5, max: 500 }).withMessage('Enter a valid clinic address'),
  body('contactNumber')
    .trim()
    .custom((value) => {
      const digits = value.replace(/\D/g, '');
      return /^\+?[\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
    })
    .withMessage('Enter a valid phone number'),
  body('latitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }).toFloat().withMessage('Latitude must be between -90 and 90'),
  body('longitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }).toFloat().withMessage('Longitude must be between -180 and 180'),
  body('consultationTimings').trim().isLength({ min: 2, max: 300 }).withMessage('Enter consultation timings'),
  body('rating').isFloat({ min: 0, max: 5 }).toFloat().withMessage('Rating must be between 0 and 5'),
  body('totalReviews').isInt({ min: 0, max: 10000000 }).toInt().withMessage('Reviews must be a non-negative whole number'),
  body('profileImage')
    .optional({ checkFalsy: true })
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Profile image must be an HTTP or HTTPS URL'),
  body('specialization')
    .isIn(['Dermatology', 'Skin & Hair Specialist'])
    .withMessage('Select a valid specialization'),
  body('isActive').isBoolean().toBoolean().withMessage('Status must be active or inactive'),
];

router.get('/doctors', listDoctors);
router.post('/doctors', doctorFields, validateRequest, createDoctor);
router.get('/doctors/:id', [param('id').isMongoId()], validateRequest, getDoctor);
router.put('/doctors/:id', [param('id').isMongoId(), ...doctorFields], validateRequest, updateDoctor);
router.delete('/doctors/:id', [param('id').isMongoId()], validateRequest, deleteDoctor);
router.patch(
  '/doctors/:id/status',
  [param('id').isMongoId(), body('isActive').isBoolean().toBoolean()],
  validateRequest,
  updateDoctorStatus
);

export default router;
