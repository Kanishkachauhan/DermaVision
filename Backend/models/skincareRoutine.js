// Backend/models/skincareRoutine.js
import mongoose from 'mongoose';

/**
 * Sub-schema for individual routine steps (Morning and Evening)
 */
const routineStepSchema = new mongoose.Schema(
  {
    stepNumber: {
      type: Number,
      required: true,
    },
    applicationOrder: {
      type: Number,
      required: true,
    },
    stepKey: {
      type: String,
      enum: ['cleanse', 'tone', 'eye_care', 'treat', 'moisturize', 'sunscreen', 'treatment'],
      default: 'treat',
    },
    stepName: {
      type: String,
      required: true,
      trim: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      default: '',
      trim: true,
    },
    brand: {
      type: String,
      default: '',
      trim: true,
    },
    productImage: {
      type: String,
      default: '/product-placeholder.svg',
    },
    category: {
      type: String,
      default: 'Treatment',
    },
    applicationInstructions: {
      type: String,
      required: true,
      trim: true,
    },
    frequency: {
      type: String,
      default: 'Daily',
    },
    waitingTimeMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    waitingTimeReason: {
      type: String,
      default: '',
    },
    safetyWarnings: {
      type: [String],
      default: [],
    },
    activeIngredients: {
      type: [String],
      default: [],
    },
    isPaused: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

/**
 * Sub-schema for legacy ordered products (backward compatibility)
 */
const legacyRoutineProductItemSchema = new mongoose.Schema(
  {
    stepOrder: { type: Number, required: true },
    stepName: { type: String, required: true, trim: true },
    timeOfDay: { type: String, enum: ['morning', 'evening', 'both'], default: 'both' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    applicationInstructions: { type: String, required: true, trim: true },
    frequency: { type: String, default: 'Daily' },
    durationWeeks: { type: Number, default: 6 },
    safetyNotes: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * Sub-schema for daily routine completion tracking
 */
const dailyCompletionLogSchema = new mongoose.Schema(
  {
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    morning: {
      completedSteps: [{ type: mongoose.Schema.Types.ObjectId }],
      completedAt: { type: Date, default: null },
      isAllCompleted: { type: Boolean, default: false },
    },
    evening: {
      completedSteps: [{ type: mongoose.Schema.Types.ObjectId }],
      completedAt: { type: Date, default: null },
      isAllCompleted: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

/**
 * Sub-schema for routine reminder schedule
 */
const scheduleConfigSchema = new mongoose.Schema(
  {
    morningTime: {
      type: String,
      default: '08:00',
    },
    eveningTime: {
      type: String,
      default: '21:00',
    },
    remindersEnabled: {
      type: Boolean,
      default: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
  },
  { _id: false }
);

/**
 * Sub-schema for clinical patch testing guidance
 */
const patchTestingGuidanceSchema = new mongoose.Schema(
  {
    protocol: {
      type: String,
      default:
        'Apply a pea-sized amount behind the ear or on the inner forearm for 24 hours. Monitor for erythema, burning, or itching before full facial application.',
    },
    recommendedWaitHours: {
      type: Number,
      default: 24,
    },
    testedProductIds: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        status: { type: String, enum: ['pending', 'passed', 'failed'], default: 'pending' },
        testedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { _id: false }
);

const skincareRoutineSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recommendation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recommendation',
      default: null,
      index: true,
    },
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Routine name is required'],
      trim: true,
      default: 'Personalized Clinical Skincare Regimen',
    },
    skinType: {
      type: String,
      enum: ['Oily', 'Dry', 'Combination', 'Normal'],
      default: 'Combination',
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'archived'],
      default: 'draft',
      index: true,
    },
    timeOfApplication: {
      type: String,
      enum: ['morning', 'evening', 'daily', 'weekly'],
      required: true,
      default: 'daily',
    },
    morningRoutine: {
      type: [routineStepSchema],
      default: [],
    },
    eveningRoutine: {
      type: [routineStepSchema],
      default: [],
    },
    schedule: {
      type: scheduleConfigSchema,
      default: () => ({}),
    },
    completionHistory: {
      type: [dailyCompletionLogSchema],
      default: [],
    },
    patchTestingGuidance: {
      type: patchTestingGuidanceSchema,
      default: () => ({}),
    },
    // Legacy support for backward compatibility
    orderedProducts: {
      type: [legacyRoutineProductItemSchema],
      default: [],
    },
    instructions: {
      type: String,
      default: 'Follow the steps in chronological order. Introduce active treatments gradually.',
    },
    frequency: {
      type: String,
      default: 'Daily (AM & PM)',
    },
    durationWeeks: {
      type: Number,
      default: 6,
    },
    safetyNotes: {
      type: [String],
      default: [
        'Perform a 24-hour patch test behind the ear before full facial application of new actives.',
        'Broad-spectrum SPF 50+ is mandatory every morning to prevent photosensitivity.',
        'If stinging or irritation occurs, pause active acids/retinoids and focus on barrier hydration.',
      ],
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

skincareRoutineSchema.index({ user: 1, status: 1 });
skincareRoutineSchema.index({ user: 1, isActive: 1 });
skincareRoutineSchema.index({ user: 1, createdAt: -1 });

const SkincareRoutine =
  mongoose.models.SkincareRoutine || mongoose.model('SkincareRoutine', skincareRoutineSchema);

export default SkincareRoutine;
