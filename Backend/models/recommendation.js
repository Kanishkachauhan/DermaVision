// Backend/models/recommendation.js
import mongoose from 'mongoose';

const selectedProductItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    stepName: {
      type: String,
      required: true,
      trim: true,
    },
    timeOfDay: {
      type: String,
      enum: ['morning', 'evening', 'both'],
      default: 'both',
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 80,
    },
    primaryReason: {
      type: String,
      required: true,
      trim: true,
    },
    matchedActives: {
      type: [String],
      default: [],
    },
    targetedConcerns: {
      type: [String],
      default: [],
    },
    usageTip: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const recommendationReasonSchema = new mongoose.Schema(
  {
    condition: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      default: 'Moderate',
    },
    score: {
      type: Number,
      default: 0,
    },
    rationale: {
      type: String,
      required: true,
      trim: true,
    },
    targetedActives: {
      type: [String],
      default: [],
    },
    contraindicationsNoted: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const routineStepItemSchema = new mongoose.Schema(
  {
    stepOrder: {
      type: Number,
      required: true,
    },
    stepName: {
      type: String,
      required: true,
      trim: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    productName: {
      type: String,
      default: '',
    },
    brand: {
      type: String,
      default: '',
    },
    instructions: {
      type: String,
      required: true,
      trim: true,
    },
    activeIngredients: {
      type: [String],
      default: [],
    },
    frequency: {
      type: String,
      default: 'Daily',
    },
  },
  { _id: false }
);

const recommendationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      required: true,
      index: true,
    },
    skincareRoutine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SkincareRoutine',
      default: null,
    },
    selectedProducts: {
      type: [selectedProductItemSchema],
      default: [],
    },
    recommendationReasons: {
      type: [recommendationReasonSchema],
      default: [],
    },
    morningRoutine: {
      type: [routineStepItemSchema],
      default: [],
    },
    eveningRoutine: {
      type: [routineStepItemSchema],
      default: [],
    },
    safetyNotes: {
      type: [String],
      default: [],
    },
    contraindicationsAvoided: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'superseded', 'archived'],
      default: 'active',
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

recommendationSchema.index({ user: 1, createdAt: -1 });
recommendationSchema.index({ report: 1, status: 1 });
recommendationSchema.index({ user: 1, status: 1 });

const Recommendation = mongoose.models.Recommendation || mongoose.model('Recommendation', recommendationSchema);
export default Recommendation;
