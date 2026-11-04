// models/Report.js
import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema(
  {
    condition: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    severity: { type: String, enum: ['Low', 'Moderate', 'High'], required: true },
  },
  { _id: false }
);

const routineItemSchema = new mongoose.Schema(
  { step: String, product: String, instructions: String },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String },
    skinType: { type: String, enum: ['Oily', 'Dry', 'Combination', 'Normal'], required: true },
    healthScore: { type: Number, min: 0, max: 100, required: true },
    predictions: { type: [predictionSchema], default: [] },
    recommendations: {
      morningRoutine: { type: [routineItemSchema], default: [] },
      nightRoutine: { type: [routineItemSchema], default: [] },
      weeklyRoutine: { type: [routineItemSchema], default: [] },
      ingredientsToUse: { type: [String], default: [] },
      ingredientsToAvoid: { type: [String], default: [] },
      lifestyle: {
        sleepHours: String,
        waterIntakeLiters: Number,
        dietTips: [String],
        stressTips: [String],
      },
      sunscreenAdvice: String,
      recommendedProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    },
    pdfUrl: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

reportSchema.index({ user: 1, createdAt: -1 });

const Report = mongoose.model('Report', reportSchema);
export default Report;