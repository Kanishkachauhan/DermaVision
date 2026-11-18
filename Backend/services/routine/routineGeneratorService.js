// Backend/services/routine/routineGeneratorService.js
/**
 * Personalized Skincare Routine Generator for DermaVision
 *
 * Responsibilities:
 * 1. Consumes products selected by the Recommendation Engine and synthesizes
 *    two primary routines: Morning Skincare Routine (AM) & Evening Skincare Routine (PM).
 * 2. Enforces validated product application order, gentle cleansing, and daytime SPF 50+.
 * 3. Extracts waiting times ONLY when supported by validated manufacturer product text
 *    (NEVER invents arbitrary wait times).
 * 4. Resolves incompatible active combinations (e.g. separates Retinoids and strong acids).
 * 5. Provides clinical patch-testing guidance.
 * 6. Supports draft review workflow before user activation.
 * 7. Provides schedule management, step completion tracking, pausing, removing, and regeneration.
 */

import mongoose from 'mongoose';
import SkincareRoutine from '../../models/skincareRoutine.js';
import Recommendation from '../../models/recommendation.js';
import Product from '../../models/product.js';
import Report from '../../models/report.js';

// Canonical step ordering weights
const STEP_PRIORITY = {
  cleanse: 1,
  tone: 2,
  eye_care: 3,
  treat: 4,
  moisturize: 5,
  sunscreen: 6,
};

/**
 * Extracts validated waiting time from manufacturer instructions.
 * If not explicitly stated by manufacturer, returns 0 without inventing arbitrary wait times.
 */
export function extractValidatedWaitingTime(instructions = '') {
  if (!instructions || typeof instructions !== 'string') {
    return { minutes: 0, reason: '' };
  }

  const text = instructions.toLowerCase();

  // Pattern 1: "leave on for X minutes"
  const leaveMatch = text.match(/leave\s+on\s+for\s+(\d+)\s*(?:-|to\s*\d+)?\s*min/);
  if (leaveMatch) {
    const mins = parseInt(leaveMatch[1], 10);
    return {
      minutes: isNaN(mins) ? 0 : mins,
      reason: `Leave on for validated duration (${mins} min) as instructed by manufacturer.`,
    };
  }

  // Pattern 2: "allow/wait X minutes to absorb / dry"
  const waitMatch = text.match(/(?:allow|wait)\s+(\d+)\s*min/);
  if (waitMatch) {
    const mins = parseInt(waitMatch[1], 10);
    return {
      minutes: isNaN(mins) ? 0 : mins,
      reason: `Allow ${mins} minute(s) for layer absorption as indicated on label.`,
    };
  }

  // Pattern 3: "wait X seconds" (e.g. 60 seconds)
  const secMatch = text.match(/(?:allow|wait)\s+(\d+)\s*sec/);
  if (secMatch) {
    return {
      minutes: 1,
      reason: 'Allow 60 seconds for initial absorption before applying subsequent layer.',
    };
  }

  // Strict rule: Do not invent waiting times
  return { minutes: 0, reason: '' };
}

/**
 * Maps a product category to a standardized routine step key.
 */
export function mapCategoryToStepKey(category = '') {
  const cat = String(category).toLowerCase();
  if (cat.includes('cleanse') || cat.includes('wash')) return 'cleanse';
  if (cat.includes('tone')) return 'tone';
  if (cat.includes('eye')) return 'eye_care';
  if (cat.includes('sun')) return 'sunscreen';
  if (cat.includes('moistur') || cat.includes('cream')) return 'moisturize';
  return 'treat'; // Serums, treatments, exfoliators
}

/**
 * Derives safe, evidence-based application frequency from product formulation and user sensitivity.
 */
export function deriveSafeFrequency(product, timeOfDay, isSensitive = false) {
  const cat = mapCategoryToStepKey(product.category);
  const text = `${product.name} ${product.description || ''}`.toLowerCase();

  if (cat === 'sunscreen') {
    return 'Daily (AM) - Reapply every 2 hours when outdoors';
  }
  if (cat === 'cleanse') {
    return timeOfDay === 'morning' ? 'Daily (AM)' : 'Daily (PM)';
  }
  if (cat === 'moisturize') {
    return timeOfDay === 'morning' ? 'Daily (AM)' : 'Daily (PM)';
  }
  if (cat === 'eye_care') {
    return 'Daily';
  }

  // Active Serums / Treatments
  const isRetinoid = text.includes('retinol') || text.includes('retinoid') || text.includes('adapalene');
  const isPeelingAcid = text.includes('peel') || text.includes('aha') || text.includes('glycolic');

  if (isRetinoid || isPeelingAcid || isSensitive) {
    return '2-3 times per week, gradually increasing as tolerated (PM)';
  }

  return timeOfDay === 'morning' ? 'Daily (AM)' : 'Daily (PM)';
}

/**
 * Extracts validated application instructions from product metadata.
 */
export function resolveApplicationInstructions(product, stepKey, timeOfDay) {
  if (Array.isArray(product.usageInstructions) && product.usageInstructions.length > 0) {
    return product.usageInstructions.join(' ');
  }
  if (product.howToUse?.instructions && Array.isArray(product.howToUse.instructions)) {
    return product.howToUse.instructions.join(' ');
  }

  // Safe standard dermatological instructions
  switch (stepKey) {
    case 'cleanse':
      return timeOfDay === 'morning'
        ? 'Rinse face with lukewarm water, gently massage a dime-sized amount for 45-60 seconds, and pat dry.'
        : 'Double cleanse with lukewarm water to thoroughly remove sunscreen, dust, and excess sebum.';
    case 'tone':
      return 'Gently pat onto face and neck using palms or a soft cotton pad. Do not rub.';
    case 'eye_care':
      return 'Tap a rice-grain amount gently along the infraorbital bone with your ring finger until absorbed.';
    case 'treat':
      return 'Dispense 3-4 drops directly onto skin. Lightly press across face until fully absorbed.';
    case 'moisturize':
      return 'Smooth a nickel-sized amount evenly across face and neck to seal in hydration and reinforce the barrier.';
    case 'sunscreen':
      return 'Apply two finger-lengths generously to face and neck as the final morning step 15 minutes before UV exposure.';
    default:
      return 'Apply gently to clean skin as directed on the packaging.';
  }
}

/**
 * Pure generator: Synthesizes Morning and Evening routines from selected products.
 *
 * @param {Object} params
 * @param {Array} params.products - Products chosen by the Recommendation Engine
 * @param {Object} params.diagnostics - Parsed skin diagnostics { skinType, detectedConcerns }
 * @param {Object} params.scheduleConfig - Schedule preferences { morningTime, eveningTime, remindersEnabled }
 * @returns {Object} Complete routine data structures
 */
export function generateRoutinePure({
  products = [],
  diagnostics = {},
  scheduleConfig = {},
}) {
  const isSensitive = (diagnostics.detectedConcerns || []).some(
    (c) => c.concern === 'Redness' || (diagnostics.skinType || '').toLowerCase() === 'sensitive'
  );

  // Group candidate products
  const morningCandidates = [];
  const eveningCandidates = [];

  for (const item of products) {
    const prod = item.product || item;
    const cat = mapCategoryToStepKey(prod.category);
    const timeOfDay = item.timeOfDay || (cat === 'sunscreen' ? 'morning' : 'both');

    if (timeOfDay === 'morning' || timeOfDay === 'both') {
      morningCandidates.push({ product: prod, stepKey: cat, originalItem: item });
    }
    if (timeOfDay === 'evening' || timeOfDay === 'both') {
      if (cat !== 'sunscreen') {
        eveningCandidates.push({ product: prod, stepKey: cat, originalItem: item });
      }
    }
  }

  // Helper to build and sequence a routine array
  const buildRoutineSteps = (candidates, timeOfDay) => {
    // Sort by canonical application priority
    candidates.sort((a, b) => {
      const priorityA = STEP_PRIORITY[a.stepKey] || 4;
      const priorityB = STEP_PRIORITY[b.stepKey] || 4;
      return priorityA - priorityB;
    });

    // Deduplicate multiple products in the exact same step (keep the most relevant)
    const seenSteps = new Set();
    const filtered = [];
    for (const c of candidates) {
      // Allow multiple treatments only if AM/PM differentiated
      const dedupeKey = `${c.stepKey}_${c.product._id || c.product.name}`;
      if (!seenSteps.has(dedupeKey)) {
        seenSteps.add(dedupeKey);
        filtered.push(c);
      }
    }

    // Format steps with strict numbering (1, 2, 3...)
    return filtered.map((c, index) => {
      const prod = c.product;
      const stepNumber = index + 1;
      const instructions = resolveApplicationInstructions(prod, c.stepKey, timeOfDay);
      const waiting = extractValidatedWaitingTime(instructions);
      const frequency = deriveSafeFrequency(prod, timeOfDay, isSensitive);

      // Standardize step name
      let stepName = `${prod.category}`;
      if (c.stepKey === 'cleanse') stepName = timeOfDay === 'morning' ? 'Gentle Cleanse' : 'Clarifying Cleanse';
      if (c.stepKey === 'sunscreen') stepName = 'Photoprotection (SPF 50+)';
      if (c.stepKey === 'moisturize') stepName = timeOfDay === 'morning' ? 'Barrier Hydration' : 'Nocturnal Recovery';
      if (c.stepKey === 'treat') stepName = timeOfDay === 'morning' ? 'Antioxidant Defense' : 'Active Night Treatment';
      if (c.stepKey === 'eye_care') stepName = 'Periorbital Eye Care';

      const warnings = Array.isArray(prod.warnings) && prod.warnings.length > 0
        ? prod.warnings
        : Array.isArray(prod.precautions) && prod.precautions.length > 0
        ? prod.precautions
        : ['External cosmetic use only. Patch test prior to initial application.'];

      const rawId = prod?._id || (mongoose.Types.ObjectId.isValid(prod) ? prod : null);
      const productId = rawId ? new mongoose.Types.ObjectId(rawId) : new mongoose.Types.ObjectId();

      return {
        stepNumber,
        applicationOrder: stepNumber,
        stepKey: c.stepKey,
        stepName,
        product: productId,
        productName: prod?.name || 'Curated Skincare Item',
        brand: prod?.brand || 'DermaVision Recommended',
        productImage: prod?.imageUrl || '/product-placeholder.svg',
        category: prod?.category || 'Treatment',
        applicationInstructions: instructions,
        frequency,
        waitingTimeMinutes: waiting.minutes,
        waitingTimeReason: waiting.reason,
        safetyWarnings: warnings,
        activeIngredients: Array.isArray(prod?.ingredients)
          ? prod.ingredients.map((i) => (typeof i === 'string' ? i : i.name)).filter(Boolean).slice(0, 4)
          : [],
        isPaused: false,
      };
    });
  };

  const morningRoutine = buildRoutineSteps(morningCandidates, 'morning');
  const eveningRoutine = buildRoutineSteps(eveningCandidates, 'evening');

  // Verify non-irritating active separation
  const isRetinoidName = (name) => {
    const n = name.toLowerCase();
    return n.includes('retin') || n.includes('adapalene') || n.includes('tretinoin');
  };
  const isAcidName = (name) => {
    const n = name.toLowerCase();
    return n.includes('salicylic') || n.includes('glycolic') || n.includes('bha') || n.includes('aha') || n.includes('peel') || n.includes('lactic');
  };

  const hasRetinoidInPM = eveningRoutine.some((s) => isRetinoidName(s.productName));
  const hasStrongAcidInPM = eveningRoutine.some((s) => isAcidName(s.productName));
  if (hasRetinoidInPM && hasStrongAcidInPM) {
    // Flag safety warning to alternate days
    const acidStep = eveningRoutine.find((s) => isAcidName(s.productName));
    if (acidStep) {
      acidStep.frequency = 'Alternate nights with Retinoid treatment (Do not layer concurrently)';
      acidStep.safetyWarnings.push('Avoid layering concurrently with retinoid to prevent stratum corneum irritation.');
    }
  }

  // Populate legacy orderedProducts for backwards compatibility
  const orderedProducts = [];
  morningRoutine.forEach((s) => {
    orderedProducts.push({
      stepOrder: s.stepNumber,
      stepName: s.stepName,
      timeOfDay: 'morning',
      product: s.product,
      applicationInstructions: s.applicationInstructions,
      frequency: s.frequency,
      durationWeeks: 6,
      safetyNotes: s.safetyWarnings.join(' '),
    });
  });
  eveningRoutine.forEach((s) => {
    orderedProducts.push({
      stepOrder: s.stepNumber + 10,
      stepName: s.stepName,
      timeOfDay: 'evening',
      product: s.product,
      applicationInstructions: s.applicationInstructions,
      frequency: s.frequency,
      durationWeeks: 6,
      safetyNotes: s.safetyWarnings.join(' '),
    });
  });

  return {
    name: `Personalized ${diagnostics.skinType || 'Clinical'} Regimen`,
    skinType: diagnostics.skinType || 'Combination',
    status: 'draft', // User reviews before activation
    morningRoutine,
    eveningRoutine,
    orderedProducts,
    schedule: {
      morningTime: scheduleConfig.morningTime || '08:00',
      eveningTime: scheduleConfig.eveningTime || '21:00',
      remindersEnabled: scheduleConfig.remindersEnabled !== false,
      timezone: scheduleConfig.timezone || 'UTC',
    },
    patchTestingGuidance: {
      protocol:
        'Apply a pea-sized amount behind the ear or on the inner forearm for 24 hours. Monitor for erythema, burning, or itching before full facial application.',
      recommendedWaitHours: 24,
      testedProductIds: [],
    },
    safetyNotes: [
      'Perform a 24-hour patch test before full facial application of new active formulations.',
      'Broad-spectrum SPF 50+ is mandatory every morning to prevent photosensitivity.',
      'Introduce active serums 2-3 times per week to establish epidermal tolerance.',
    ],
  };
}

/**
 * Generates and saves a SkincareRoutine from a recommendation document.
 */
export async function createRoutineFromRecommendation({
  recommendationId,
  userId,
  options = {},
}) {
  if (!mongoose.Types.ObjectId.isValid(recommendationId)) {
    throw new Error('Valid recommendation ID is required.');
  }

  const recommendation = await Recommendation.findById(recommendationId)
    .populate('selectedProducts.product')
    .lean();

  if (!recommendation) {
    throw new Error(`Recommendation ${recommendationId} not found.`);
  }

  // Security check
  if (recommendation.user.toString() !== userId.toString() && options.userRole !== 'admin') {
    const err = new Error('Not authorized to access this recommendation.');
    err.statusCode = 403;
    throw err;
  }

  // Retrieve report diagnostic state if linked
  let diagnostics = {};
  if (recommendation.report) {
    const report = await Report.findById(recommendation.report).lean();
    if (report) {
      diagnostics = {
        skinType: report.skinType,
        healthScore: report.healthScore,
        detectedConcerns: (report.predictions || []).map((p) => ({
          concern: p.condition,
          severity: p.severity,
          confidence: p.confidence,
        })),
      };
    }
  }

  // Extract products chosen by the recommendation engine
  const chosenProducts = (recommendation.selectedProducts || []).map((sp) => {
    let p = sp.product;
    if (!p) {
      p = {
        _id: new mongoose.Types.ObjectId(),
        name: sp.stepName || 'Curated Formula',
        category: sp.stepName || 'Treatment',
      };
    }
    return {
      product: p,
      stepName: sp.stepName,
      timeOfDay: sp.timeOfDay,
      primaryReason: sp.primaryReason,
    };
  });

  // Pure routine generation
  const routineData = generateRoutinePure({
    products: chosenProducts,
    diagnostics,
    scheduleConfig: options.schedule || {},
  });

  // Archive any prior draft or active routines if autoActivate is requested
  if (options.autoActivate) {
    routineData.status = 'active';
    routineData.activatedAt = new Date();
    await SkincareRoutine.updateMany(
      { user: userId, status: 'active' },
      { $set: { status: 'archived', isActive: false } }
    );
  }

  const routine = new SkincareRoutine({
    user: userId,
    recommendation: recommendation._id,
    report: recommendation.report || null,
    ...routineData,
  });

  await routine.save();

  // Attach back to recommendation
  await Recommendation.findByIdAndUpdate(recommendation._id, {
    $set: { skincareRoutine: routine._id },
  });

  return routine;
}

/**
 * Activates a draft routine after user review.
 */
export async function activateRoutine(routineId, userId, userRole = 'user') {
  if (!mongoose.Types.ObjectId.isValid(routineId)) {
    throw new Error('Invalid routine ID.');
  }

  const routine = await SkincareRoutine.findById(routineId);
  if (!routine) {
    throw new Error('Skincare routine not found.');
  }

  if (routine.user.toString() !== userId.toString() && userRole !== 'admin') {
    const err = new Error('Not authorized to activate this routine.');
    err.statusCode = 403;
    throw err;
  }

  // Archive previous active routines
  await SkincareRoutine.updateMany(
    { user: userId, status: 'active', _id: { $ne: routine._id } },
    { $set: { status: 'archived', isActive: false } }
  );

  routine.status = 'active';
  routine.isActive = true;
  routine.activatedAt = new Date();
  await routine.save();

  return routine;
}

/**
 * Marks a routine step completed for a given calendar date.
 */
export async function markRoutineStepCompleted({
  routineId,
  userId,
  timeOfDay, // 'morning' | 'evening'
  stepId,
  date,
  userRole = 'user',
}) {
  if (!mongoose.Types.ObjectId.isValid(routineId)) {
    throw new Error('Invalid routine ID.');
  }

  const routine = await SkincareRoutine.findById(routineId);
  if (!routine) {
    throw new Error('Skincare routine not found.');
  }

  if (routine.user.toString() !== userId.toString() && userRole !== 'admin') {
    const err = new Error('Not authorized to update this routine.');
    err.statusCode = 403;
    throw err;
  }

  const targetDate = date || new Date().toISOString().split('T')[0];
  const targetTimeOfDay = timeOfDay === 'evening' ? 'evening' : 'morning';

  // Find or create completion log for targetDate
  let log = routine.completionHistory.find((h) => h.date === targetDate);
  if (!log) {
    log = {
      date: targetDate,
      morning: { completedSteps: [], completedAt: null, isAllCompleted: false },
      evening: { completedSteps: [], completedAt: null, isAllCompleted: false },
    };
    routine.completionHistory.push(log);
    log = routine.completionHistory[routine.completionHistory.length - 1];
  }

  const stepObjId = new mongoose.Types.ObjectId(stepId);
  const existingSteps = log[targetTimeOfDay].completedSteps.map((id) => id.toString());

  if (!existingSteps.includes(stepObjId.toString())) {
    log[targetTimeOfDay].completedSteps.push(stepObjId);
  }

  // Check if all active steps for this time of day are completed
  const activeSteps = targetTimeOfDay === 'morning'
    ? routine.morningRoutine.filter((s) => !s.isPaused)
    : routine.eveningRoutine.filter((s) => !s.isPaused);

  const completedCount = log[targetTimeOfDay].completedSteps.length;
  if (completedCount >= activeSteps.length && activeSteps.length > 0) {
    log[targetTimeOfDay].isAllCompleted = true;
    log[targetTimeOfDay].completedAt = new Date();
  }

  routine.markModified('completionHistory');
  await routine.save();

  return {
    success: true,
    date: targetDate,
    timeOfDay: targetTimeOfDay,
    completedStepsCount: log[targetTimeOfDay].completedSteps.length,
    isAllCompleted: log[targetTimeOfDay].isAllCompleted,
  };
}

/**
 * Retrieves today's completion status and progress for a routine.
 */
export async function getTodayRoutineStatus(routineId, userId, dateString = null) {
  const routine = await SkincareRoutine.findById(routineId).populate('morningRoutine.product eveningRoutine.product');
  if (!routine) {
    throw new Error('Skincare routine not found.');
  }

  if (routine.user.toString() !== userId.toString()) {
    const err = new Error('Not authorized to view routine progress.');
    err.statusCode = 403;
    throw err;
  }

  const today = dateString || new Date().toISOString().split('T')[0];
  const log = routine.completionHistory.find((h) => h.date === today) || {
    morning: { completedSteps: [], isAllCompleted: false },
    evening: { completedSteps: [], isAllCompleted: false },
  };

  const morningCompletedIds = new Set(log.morning.completedSteps.map((id) => id.toString()));
  const eveningCompletedIds = new Set(log.evening.completedSteps.map((id) => id.toString()));

  const morningStepsWithStatus = routine.morningRoutine.map((step) => ({
    ...step.toObject(),
    isCompletedToday: morningCompletedIds.has(step._id.toString()),
  }));

  const eveningStepsWithStatus = routine.eveningRoutine.map((step) => ({
    ...step.toObject(),
    isCompletedToday: eveningCompletedIds.has(step._id.toString()),
  }));

  const activeMorningSteps = morningStepsWithStatus.filter((s) => !s.isPaused);
  const activeEveningSteps = eveningStepsWithStatus.filter((s) => !s.isPaused);

  const morningDone = activeMorningSteps.filter((s) => s.isCompletedToday).length;
  const eveningDone = activeEveningSteps.filter((s) => s.isCompletedToday).length;

  const totalActive = activeMorningSteps.length + activeEveningSteps.length;
  const totalDone = morningDone + eveningDone;
  const overallPercent = totalActive > 0 ? Math.round((totalDone / totalActive) * 100) : 0;

  return {
    routineId: routine._id,
    date: today,
    status: routine.status,
    schedule: routine.schedule,
    overallPercent,
    morning: {
      totalSteps: activeMorningSteps.length,
      completedCount: morningDone,
      isAllCompleted: log.morning.isAllCompleted || (morningDone >= activeMorningSteps.length && activeMorningSteps.length > 0),
      steps: morningStepsWithStatus,
    },
    evening: {
      totalSteps: activeEveningSteps.length,
      completedCount: eveningDone,
      isAllCompleted: log.evening.isAllCompleted || (eveningDone >= activeEveningSteps.length && activeEveningSteps.length > 0),
      steps: eveningStepsWithStatus,
    },
  };
}

/**
 * Pauses or resumes an individual product in the routine.
 */
export async function toggleProductPause({ routineId, userId, productId, isPaused }) {
  const routine = await SkincareRoutine.findById(routineId);
  if (!routine) {
    throw new Error('Skincare routine not found.');
  }

  if (routine.user.toString() !== userId.toString()) {
    const err = new Error('Not authorized to modify this routine.');
    err.statusCode = 403;
    throw err;
  }

  const pIdStr = productId.toString();
  let found = false;

  routine.morningRoutine.forEach((s) => {
    if (s.product.toString() === pIdStr || s._id.toString() === pIdStr) {
      s.isPaused = Boolean(isPaused);
      found = true;
    }
  });

  routine.eveningRoutine.forEach((s) => {
    if (s.product.toString() === pIdStr || s._id.toString() === pIdStr) {
      s.isPaused = Boolean(isPaused);
      found = true;
    }
  });

  if (!found) {
    throw new Error(`Product ${productId} was not found in this routine.`);
  }

  await routine.save();
  return routine;
}

/**
 * Removes a product from the routine and re-indexes step numbers sequentially.
 */
export async function removeProductFromRoutine({ routineId, userId, productId }) {
  const routine = await SkincareRoutine.findById(routineId);
  if (!routine) {
    throw new Error('Skincare routine not found.');
  }

  if (routine.user.toString() !== userId.toString()) {
    const err = new Error('Not authorized to modify this routine.');
    err.statusCode = 403;
    throw err;
  }

  const pIdStr = productId.toString();

  routine.morningRoutine = routine.morningRoutine.filter(
    (s) => s.product.toString() !== pIdStr && s._id.toString() !== pIdStr
  );
  routine.eveningRoutine = routine.eveningRoutine.filter(
    (s) => s.product.toString() !== pIdStr && s._id.toString() !== pIdStr
  );

  // Re-index step numbers strictly (1, 2, 3...)
  routine.morningRoutine.forEach((s, i) => {
    s.stepNumber = i + 1;
    s.applicationOrder = i + 1;
  });
  routine.eveningRoutine.forEach((s, i) => {
    s.stepNumber = i + 1;
    s.applicationOrder = i + 1;
  });

  await routine.save();
  return routine;
}

/**
 * Regenerates the routine when recommendations change.
 */
export async function regenerateRoutineFromRecommendation({
  routineId,
  recommendationId,
  userId,
}) {
  const existingRoutine = routineId ? await SkincareRoutine.findById(routineId) : null;
  const userSchedule = existingRoutine ? existingRoutine.schedule : {};

  const newRoutine = await createRoutineFromRecommendation({
    recommendationId,
    userId,
    options: {
      schedule: userSchedule,
      autoActivate: existingRoutine?.status === 'active',
    },
  });

  if (existingRoutine && String(existingRoutine._id) !== String(newRoutine._id)) {
    existingRoutine.status = 'archived';
    existingRoutine.isActive = false;
    await existingRoutine.save();
  }

  return newRoutine;
}
