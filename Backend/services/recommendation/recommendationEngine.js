// Backend/services/recommendation/recommendationEngine.js
/**
 * Core AI-Powered Personalized Skincare Recommendation Engine
 *
 * Implements:
 * 1. Safe parsing of real ML skin reports (detection confidence vs severity).
 * 2. User allergy, sensitivity, and product preference compliance.
 * 3. Multi-layer product filtering (availability, allergies, skin type, warnings).
 * 4. Transparent scoring and clinical ranking.
 * 5. Simple, non-irritating routine assembly.
 * 6. Explicit clinical reasoning (WHY each product is chosen).
 * 7. Persistence to MongoDB (Recommendation, SkincareRoutine, Report).
 * 8. Pure in-memory evaluation for decoupled testing.
 */

import mongoose from 'mongoose';
import Product from '../../models/product.js';
import Recommendation from '../../models/recommendation.js';
import SkincareRoutine from '../../models/skincareRoutine.js';
import Report from '../../models/report.js';
import User from '../../models/User.js';

import { parseSkinReport } from './reportParser.js';
import { CONCERN_CLINICAL_MAP, MEDICAL_DISCLAIMER } from './clinicalRules.js';
import { filterProductCatalog } from './productFilter.js';
import { rankProducts } from './productScorer.js';
import { buildPersonalizedRoutine } from './routineBuilder.js';

/**
 * Derives the active clinical strategy from parsed skin diagnostics.
 */
export function deriveClinicalStrategyFromDiagnostics(diagnostics) {
  const targetedActives = new Set();
  const avoidActives = new Set();
  const reasons = [];

  const concerns = diagnostics.detectedConcerns || [];

  if (concerns.length === 0) {
    const universal = CONCERN_CLINICAL_MAP.Universal;
    universal.targetActives.forEach((a) => targetedActives.add(a));
    universal.avoidActives.forEach((a) => avoidActives.add(a));
    reasons.push({
      condition: universal.conditionTitle,
      severity: 'Low',
      score: diagnostics.healthScore || 80,
      rationale: universal.severityRationales.Low,
      targetedActives: universal.targetActives,
      contraindicationsNoted: universal.avoidActives,
    });
  } else {
    for (const item of concerns) {
      const rule = CONCERN_CLINICAL_MAP[item.concern];
      if (!rule) continue;

      rule.targetActives.forEach((a) => targetedActives.add(a));
      rule.avoidActives.forEach((a) => avoidActives.add(a));

      const rationaleText =
        rule.severityRationales[item.severity] ||
        rule.severityRationales.Moderate ||
        'Targeted active formulation supports barrier homeostasis.';

      reasons.push({
        condition: rule.conditionTitle,
        severity: item.severity,
        score: item.score || 50,
        rationale: rationaleText,
        targetedActives: rule.targetActives.slice(0, 3),
        contraindicationsNoted: rule.avoidActives.slice(0, 2),
      });
    }
  }

  // Adjust for baseline skin type
  const st = (diagnostics.skinType || 'Combination').toLowerCase();
  if (st === 'dry') {
    CONCERN_CLINICAL_MAP.Dryness.targetActives.forEach((a) => targetedActives.add(a));
  } else if (st === 'oily') {
    targetedActives.add('Salicylic Acid');
    targetedActives.add('Niacinamide');
    avoidActives.add('Heavy Mineral Oils');
  }

  return {
    targetedActives: Array.from(targetedActives),
    avoidActives: Array.from(avoidActives),
    reasons,
  };
}

/**
 * Pure, in-memory recommendation evaluation (Decoupled from database).
 * Perfect for unit tests and instant preview.
 *
 * @param {Object} params
 * @param {Object} params.reportData - Raw report object or diagnostic payload
 * @param {Object} params.userProfile - { allergies, sensitivities, preferences }
 * @param {Array} params.catalog - Array of product objects
 * @returns {Object} Complete evaluated recommendation
 */
export function evaluateRecommendationPure({
  reportData = {},
  userProfile = {},
  catalog = [],
  options = {},
}) {
  // 1. Parse real report schema
  const diagnostics = parseSkinReport(reportData);

  // 2. Merge user profile & options
  const userAllergies = (options.allergies || userProfile.allergies || []).map((a) => String(a).trim());
  const userSensitivities = (options.sensitivities || userProfile.sensitivities || []).map((s) => String(s).trim());
  const preferences = { ...(userProfile.preferences || {}), ...(options.preferences || {}) };

  // 3. Derive clinical strategy
  const clinicalStrategy = deriveClinicalStrategyFromDiagnostics(diagnostics);

  // 4. Multi-stage filtering pipeline
  const filterContext = {
    diagnostics,
    clinicalStrategy,
    userAllergies,
    userSensitivities,
    preferences,
  };
  const filterResults = filterProductCatalog(catalog, filterContext);

  // 5. Scoring and ranking
  const rankedCandidates = rankProducts(filterResults.passed, {
    diagnostics,
    clinicalStrategy,
    preferences,
  });

  // 6. Routine assembly and output synthesis
  const routineResult = buildPersonalizedRoutine(rankedCandidates, diagnostics);

  return {
    diagnostics,
    clinicalStrategy,
    filteringStats: {
      totalCatalog: filterResults.totalInput,
      passedCount: filterResults.totalPassed,
      rejectedCount: filterResults.rejected.length,
      rejectedProducts: filterResults.rejected,
    },
    ...routineResult,
  };
}

/**
 * Core Service Method: Generates, validates, and persists personalized recommendations.
 */
export async function generatePersonalizedRecommendation({
  userId,
  reportId,
  diagnosticData,
  allergies,
  sensitivities,
  preferences,
  forceRegenerate = false,
}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Valid User ID is required for generating recommendations.');
  }

  // 1. Fetch user profile from MongoDB to check persisted preferences
  let userProfile = {};
  try {
    const user = await User.findById(userId).lean();
    if (user) {
      userProfile = {
        name: user.name,
        email: user.email,
        allergies: user.allergies || [],
        sensitivities: user.sensitivities || [],
        preferences: user.preferences || {},
      };
    }
  } catch (userErr) {
    console.warn('[recommendationEngine] Note: User profile lookup omitted:', userErr.message);
  }

  // 2. Fetch the actual Report from MongoDB if reportId is provided
  let realReportDoc = null;
  if (reportId) {
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      throw new Error('Provided Report ID is invalid.');
    }

    realReportDoc = await Report.findById(reportId);
    if (!realReportDoc && !diagnosticData) {
      throw new Error(`Report with ID ${reportId} not found in database.`);
    }

    // Check ownership
    if (realReportDoc && realReportDoc.user.toString() !== userId.toString()) {
      const user = await User.findById(userId);
      if (user?.role !== 'admin') {
        const authErr = new Error('Not authorized to generate recommendations for this report.');
        authErr.statusCode = 403;
        throw authErr;
      }
    }

    // Check if an active recommendation already exists for this single analysis scan report
    if (!forceRegenerate) {
      const existing = await Recommendation.findOne({ report: reportId, status: 'active' })
        .populate('selectedProducts.product')
        .populate('morningRoutine.product')
        .populate('eveningRoutine.product')
        .populate({
          path: 'skincareRoutine',
          populate: { path: 'orderedProducts.product' },
        })
        .lean();

      if (existing) {
        // Map populated products to client-ready format
        const formatted = (existing.selectedProducts || []).map((sp) => {
          const prod = sp.product || {};
          return {
            productId: prod._id ? String(prod._id) : (prod.id || null),
            name: prod.name || 'Curated Skincare Item',
            brand: prod.brand || 'DermaVision Recommended',
            imageUrl: prod.imageUrl || '/product-placeholder.svg',
            category: prod.category || sp.stepName || 'Treatment',
            price: typeof prod.price === 'number' ? prod.price : null,
            relevantConcern: (sp.targetedConcerns && sp.targetedConcerns[0]) || 'Skin Balance',
            reason: sp.primaryReason,
            matchScore: sp.matchScore || 80,
            ingredients: Array.isArray(prod.ingredients)
              ? prod.ingredients.map((i) => (typeof i === 'string' ? i : i.name || '')).filter(Boolean)
              : [],
            applicationInstructions: Array.isArray(prod.usageInstructions)
              ? prod.usageInstructions.join(' ')
              : sp.usageTip || 'Apply as directed on product label.',
            warnings: prod.warnings || [],
            productUrl: prod.productUrl || '',
            timeOfDay: sp.timeOfDay,
          };
        });

        return {
          ...existing,
          formattedProducts: formatted,
          diagnostics: {
            skinType: realReportDoc?.skinType || existing.skincareRoutine?.skinType || 'Combination',
            healthScore: realReportDoc?.healthScore || 80,
            detectedConcerns: (existing.recommendationReasons || []).map((r) => ({
              concern: r.condition,
              severity: r.severity,
              score: r.score,
            })),
          },
          disclaimer: MEDICAL_DISCLAIMER,
          isCached: true,
        };
      }
    } else {
      // Explicit regeneration requested by user: archive previous active entries for this report
      await Recommendation.updateMany({ report: reportId, status: 'active' }, { status: 'archived' });
      await SkincareRoutine.updateMany({ report: reportId, isActive: true }, { isActive: false, status: 'archived' });
    }
  }

  // 3. Retrieve all active products from MongoDB
  const activeProducts = await Product.find({ isActive: true }).lean();

  // 4. Merge incoming payload with report document
  const rawReportPayload = realReportDoc ? realReportDoc.toObject() : diagnosticData || {};
  if (diagnosticData && typeof diagnosticData === 'object') {
    Object.assign(rawReportPayload, diagnosticData);
  }

  // 5. Execute Pure Recommendation Engine
  const evaluation = evaluateRecommendationPure({
    reportData: rawReportPayload,
    userProfile,
    catalog: activeProducts,
    options: {
      allergies: allergies || userProfile.allergies,
      sensitivities: sensitivities || userProfile.sensitivities,
      preferences: preferences || userProfile.preferences,
    },
  });

  // 6. Map selected products to Recommendation document schema
  const selectedProductsToPersist = evaluation.selectedProducts.map((p) => ({
    product: p.productId,
    stepName: p.category,
    timeOfDay: p.category === 'Sunscreen' ? 'morning' : 'both',
    matchScore: p.matchScore,
    primaryReason: p.reason,
    matchedActives: p.ingredients ? p.ingredients.slice(0, 3) : [],
    targetedConcerns: [p.relevantConcern],
    usageTip: p.applicationInstructions,
  }));

  // 7. Supersede any existing active recommendations for this report
  if (reportId) {
    await Recommendation.updateMany(
      { report: reportId, status: 'active' },
      { $set: { status: 'superseded' } }
    );
  }

  // 8. Create and Persist the Recommendation document
  const recommendation = new Recommendation({
    user: userId,
    report: reportId || new mongoose.Types.ObjectId(),
    selectedProducts: selectedProductsToPersist,
    recommendationReasons: evaluation.clinicalStrategy.reasons,
    morningRoutine: evaluation.morningRoutine,
    eveningRoutine: evaluation.eveningRoutine,
    safetyNotes: evaluation.safetyNotes,
    contraindicationsAvoided: evaluation.clinicalStrategy.avoidActives,
    status: 'active',
    generatedAt: new Date(),
  });

  await recommendation.save();

  // 9. Create and Persist companion SkincareRoutine document
  const orderedRoutineProducts = [];
  evaluation.morningRoutine.forEach((step) => {
    if (step.product) {
      orderedRoutineProducts.push({
        stepOrder: step.stepOrder,
        stepName: step.stepName,
        timeOfDay: 'morning',
        product: step.product,
        applicationInstructions: step.instructions,
        frequency: step.frequency || 'Daily (AM)',
        durationWeeks: 6,
        safetyNotes: step.stepName.includes('Sun') ? 'Reapply every 2 hours when exposed to UV.' : '',
      });
    }
  });

  evaluation.eveningRoutine.forEach((step) => {
    if (step.product) {
      orderedRoutineProducts.push({
        stepOrder: step.stepOrder + 10,
        stepName: step.stepName,
        timeOfDay: 'evening',
        product: step.product,
        applicationInstructions: step.instructions,
        frequency: step.frequency || 'Daily (PM)',
        durationWeeks: 6,
        safetyNotes: step.stepName.includes('Night') ? 'Introduce 2-3x per week to build skin tolerance.' : '',
      });
    }
  });

  const morningRoutineSteps = evaluation.morningRoutine.map((step) => ({
    stepNumber: step.stepOrder,
    applicationOrder: step.stepOrder,
    stepKey: step.stepName.toLowerCase().includes('cleanse')
      ? 'cleanse'
      : step.stepName.toLowerCase().includes('sun')
      ? 'sunscreen'
      : step.stepName.toLowerCase().includes('moistur')
      ? 'moisturize'
      : step.stepName.toLowerCase().includes('eye')
      ? 'eye_care'
      : 'treat',
    stepName: step.stepName,
    product: step.product,
    productName: step.productName,
    brand: step.brand,
    productImage: step.productImage || '/product-placeholder.svg',
    category: step.category || (step.stepName.toLowerCase().includes('sun')
      ? 'Sunscreen'
      : step.stepName.toLowerCase().includes('cleanse')
      ? 'Cleanser'
      : step.stepName.toLowerCase().includes('moistur')
      ? 'Moisturizer'
      : 'Serum'),
    applicationInstructions: step.instructions,
    frequency: step.frequency || 'Daily (AM)',
    waitingTimeMinutes: 0,
    waitingTimeReason: '',
    safetyWarnings: step.stepName.includes('Sun') ? ['Reapply every 2 hours during direct UV exposure.'] : [],
    activeIngredients: step.activeIngredients || [],
    isPaused: false,
  }));

  const eveningRoutineSteps = evaluation.eveningRoutine.map((step) => ({
    stepNumber: step.stepOrder,
    applicationOrder: step.stepOrder,
    stepKey: step.stepName.toLowerCase().includes('cleanse')
      ? 'cleanse'
      : step.stepName.toLowerCase().includes('moistur')
      ? 'moisturize'
      : step.stepName.toLowerCase().includes('eye')
      ? 'eye_care'
      : 'treat',
    stepName: step.stepName,
    product: step.product,
    productName: step.productName,
    brand: step.brand,
    productImage: step.productImage || '/product-placeholder.svg',
    category: step.category || (step.stepName.toLowerCase().includes('cleanse')
      ? 'Cleanser'
      : step.stepName.toLowerCase().includes('moistur')
      ? 'Moisturizer'
      : 'Serum'),
    applicationInstructions: step.instructions,
    frequency: step.frequency || 'Daily (PM)',
    waitingTimeMinutes: 0,
    waitingTimeReason: '',
    safetyWarnings: step.stepName.includes('Treatment')
      ? ['Introduce 2-3x per week to build skin tolerance. Avoid combining with peeling acids.']
      : [],
    activeIngredients: step.activeIngredients || [],
    isPaused: false,
  }));

  const skincareRoutine = new SkincareRoutine({
    user: userId,
    recommendation: recommendation._id,
    report: recommendation.report,
    name: `Personalized ${evaluation.diagnostics.skinType} Clinical Regimen`,
    skinType: evaluation.diagnostics.skinType,
    status: 'active',
    activatedAt: new Date(),
    timeOfApplication: 'daily',
    morningRoutine: morningRoutineSteps,
    eveningRoutine: eveningRoutineSteps,
    orderedProducts: orderedRoutineProducts,
    instructions: 'Follow the numbered sequence. Allow 60 seconds between active layers for full absorption.',
    frequency: 'Daily (AM & PM)',
    durationWeeks: 6,
    isActive: true,
  });

  await skincareRoutine.save();

  recommendation.skincareRoutine = skincareRoutine._id;
  await recommendation.save();

  // 10. Update the original Report document if linked
  if (reportId && realReportDoc) {
    try {
      const recommendedProductIds = evaluation.selectedProducts
        .map((sp) => sp.productId)
        .filter((id) => mongoose.Types.ObjectId.isValid(id));

      await Report.findByIdAndUpdate(reportId, {
        $set: {
          'recommendations.morningRoutine': evaluation.morningRoutine.map((m) => ({
            step: `${m.stepOrder}. ${m.stepName}`,
            product: `${m.brand} - ${m.productName}`,
            instructions: m.instructions,
          })),
          'recommendations.nightRoutine': evaluation.eveningRoutine.map((e) => ({
            step: `${e.stepOrder}. ${e.stepName}`,
            product: `${e.brand} - ${e.productName}`,
            instructions: e.instructions,
          })),
          'recommendations.ingredientsToUse': evaluation.clinicalStrategy.targetedActives,
          'recommendations.ingredientsToAvoid': evaluation.clinicalStrategy.avoidActives,
          'recommendations.recommendedProductIds': recommendedProductIds,
        },
      });
    } catch (reportUpdateErr) {
      console.warn('[recommendationEngine] Note: Non-critical report update error:', reportUpdateErr.message);
    }
  }

  // 11. Return populated recommendation with formatted products
  const populated = await Recommendation.findById(recommendation._id)
    .populate('selectedProducts.product')
    .populate('morningRoutine.product')
    .populate('eveningRoutine.product')
    .populate({
      path: 'skincareRoutine',
      populate: { path: 'orderedProducts.product' },
    })
    .lean();

  return {
    ...populated,
    formattedProducts: evaluation.selectedProducts,
    diagnostics: evaluation.diagnostics,
    filteringStats: evaluation.filteringStats,
    disclaimer: MEDICAL_DISCLAIMER,
  };
}

/**
 * Retrieves the active recommendation for a specific report.
 */
export async function getRecommendationForReport(reportId, userId, userRole = 'user') {
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    throw new Error('Invalid report ID format.');
  }

  const recommendation = await Recommendation.findOne({ report: reportId, status: 'active' })
    .populate('selectedProducts.product')
    .populate('morningRoutine.product')
    .populate('eveningRoutine.product')
    .populate({
      path: 'skincareRoutine',
      populate: { path: 'orderedProducts.product' },
    });

  if (!recommendation) {
    return null;
  }

  if (recommendation.user.toString() !== userId.toString() && userRole !== 'admin') {
    const error = new Error('Not authorized to access recommendations for this report.');
    error.statusCode = 403;
    throw error;
  }

  const recObj = recommendation.toObject ? recommendation.toObject() : recommendation;
  const formatted = (recObj.selectedProducts || []).map((sp) => {
    const prod = sp.product || {};
    return {
      productId: prod._id ? String(prod._id) : (prod.id || null),
      name: prod.name || 'Curated Skincare Item',
      brand: prod.brand || 'DermaVision Recommended',
      imageUrl: prod.imageUrl || '/product-placeholder.svg',
      category: prod.category || sp.stepName || 'Treatment',
      price: typeof prod.price === 'number' ? prod.price : null,
      relevantConcern: (sp.targetedConcerns && sp.targetedConcerns[0]) || 'Skin Balance',
      reason: sp.primaryReason,
      matchScore: sp.matchScore || 80,
      ingredients: Array.isArray(prod.ingredients)
        ? prod.ingredients.map((i) => (typeof i === 'string' ? i : i.name || '')).filter(Boolean)
        : [],
      applicationInstructions: Array.isArray(prod.usageInstructions)
        ? prod.usageInstructions.join(' ')
        : sp.usageTip || 'Apply as directed on product label.',
      warnings: prod.warnings || [],
      productUrl: prod.productUrl || '',
      timeOfDay: sp.timeOfDay,
    };
  });

  return {
    ...recObj,
    formattedProducts: formatted,
    disclaimer: MEDICAL_DISCLAIMER,
  };
}

/**
 * Retrieves paginated recommendations for a user.
 */
export async function getUserRecommendations(userId, page = 1, limit = 10) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (parsedPage - 1) * parsedLimit;

  const [recommendations, total] = await Promise.all([
    Recommendation.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('selectedProducts.product')
      .populate('skincareRoutine'),
    Recommendation.countDocuments({ user: userId }),
  ]);

  return {
    recommendations,
    total,
    page: parsedPage,
    totalPages: Math.ceil(total / parsedLimit),
  };
}

/**
 * Retrieves active skincare routine for a user.
 */
export async function getUserActiveRoutine(userId) {
  return SkincareRoutine.findOne({ user: userId, isActive: true })
    .sort({ createdAt: -1 })
    .populate('orderedProducts.product');
}
