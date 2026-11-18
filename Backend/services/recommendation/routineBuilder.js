// Backend/services/recommendation/routineBuilder.js
/**
 * Routine Builder and Output Synthesizer for DermaVision Recommendation System
 *
 * Responsibilities:
 * 1. Assembles simple, gentle AM & PM routines.
 * 2. Formats every recommended product strictly according to user specifications:
 *    - Product ID, Product name, Brand, Product image, Category, Price,
 *      Relevant concern, Reason for recommendation, Ingredients, Application instructions,
 *      Warnings, Product purchase URL.
 * 3. Handles insufficient report data gracefully with safe baseline routines.
 * 4. Handles empty product catalogs gracefully without crashing.
 * 5. Applies active separation to avoid irritations (e.g. Retinoids vs Acids).
 */

import { MEDICAL_DISCLAIMER, enforceActiveSafetyRules } from './clinicalRules.js';

/**
 * Normalizes ingredient list to an array of ingredient names.
 */
function normalizeIngredientsList(ingredients = []) {
  if (!Array.isArray(ingredients)) return [];
  return ingredients.map((i) => {
    if (typeof i === 'string') return i.trim();
    if (i && typeof i === 'object') {
      return i.concentration ? `${i.name} (${i.concentration})` : i.name || '';
    }
    return '';
  }).filter(Boolean);
}

/**
 * Formats a product document into the exact specified recommendation output format.
 */
export function formatProductOutput(scoredItem) {
  const product = scoredItem.product || scoredItem;
  const matchScore = scoredItem.matchScore || 80;
  const reason = scoredItem.recommendationReason || scoredItem.primaryReason ||
    `Recommended for ${product.category} step to support skin barrier integrity.`;
  const relevantConcern = (scoredItem.targetedConcerns && scoredItem.targetedConcerns[0]) ||
    (product.targetConcerns && product.targetConcerns[0]) ||
    product.category;

  // Application instructions
  let appInstructions = 'Apply as directed on product label.';
  if (Array.isArray(product.usageInstructions) && product.usageInstructions.length > 0) {
    appInstructions = product.usageInstructions.join(' ');
  } else if (product.category === 'Cleanser' || product.category === 'Face Wash') {
    appInstructions = 'Dispense onto damp hands, gently massage in circular motions for 45-60 seconds, and rinse with lukewarm water. Pat dry.';
  } else if (product.category === 'Sunscreen') {
    appInstructions = 'Apply two finger-lengths generously to face and neck as the final morning step 15 minutes before UV exposure. Reapply every 2 hours outdoors.';
  } else if (product.category === 'Moisturizer') {
    appInstructions = 'Warm a dime-sized amount between palms and smooth evenly across face and neck to lock in active treatments.';
  } else if (['Serum', 'Treatment'].includes(product.category)) {
    appInstructions = 'Dispense 3-4 drops directly onto skin after cleansing. Gently press into skin with fingertips until fully absorbed.';
  } else if (['Eye care', 'Eye Care', 'EyeCare'].includes(product.category)) {
    appInstructions = 'Tap a small rice-grain amount gently along the orbital bone using your ring finger. Do not rub eyelids.';
  }

  const warnings = Array.isArray(product.warnings) && product.warnings.length > 0
    ? product.warnings
    : Array.isArray(product.precautions) && product.precautions.length > 0
    ? product.precautions
    : ['For external cosmetic use only. Discontinue use if persistent irritation develops.'];

  return {
    productId: product._id ? String(product._id) : null,
    name: product.name || 'Curated Skincare Item',
    brand: product.brand || 'DermaVision Recommended',
    imageUrl: product.imageUrl || '/product-placeholder.svg',
    category: product.category || 'Treatment',
    price: typeof product.price === 'number' ? product.price : null,
    relevantConcern,
    reason,
    matchScore,
    scoreBreakdown: scoredItem.scoreBreakdown || null,
    ingredients: normalizeIngredientsList(product.ingredients),
    applicationInstructions: appInstructions,
    warnings,
    productUrl: product.productUrl || product.buyLink || product.officialSourceUrl || '',
  };
}

/**
 * Builds the complete AM and PM personalized routine from scored candidate products.
 *
 * @param {Array} scoredCandidates - List of scored products
 * @param {Object} diagnostics - Parsed skin diagnostics
 * @returns {Object} Complete routine breakdown and product outputs
 */
export function buildPersonalizedRoutine(scoredCandidates = [], diagnostics = {}) {
  // Gracefully handle empty candidate catalog
  if (!scoredCandidates || scoredCandidates.length === 0) {
    return {
      selectedProducts: [],
      morningRoutine: [],
      eveningRoutine: [],
      safetyNotes: [
        'No matching active products found in the catalog matching all specified criteria.',
        'Please review allergy restrictions or contact catalog support.',
      ],
      notice: 'Product catalog is currently empty or all items were filtered out by safety criteria.',
      disclaimer: MEDICAL_DISCLAIMER,
    };
  }

  // 1. Separate candidates by category
  const cleansers = scoredCandidates.filter((item) =>
    ['Cleanser', 'Face Wash', 'FaceWash'].includes(item.product.category)
  );
  const moisturizers = scoredCandidates.filter((item) =>
    item.product.category === 'Moisturizer'
  );
  const sunscreens = scoredCandidates.filter((item) =>
    item.product.category === 'Sunscreen'
  );
  const serums = scoredCandidates.filter((item) =>
    ['Serum', 'Treatment'].includes(item.product.category)
  );
  const eyeCareItems = scoredCandidates.filter((item) =>
    ['Eye care', 'Eye Care', 'EyeCare'].includes(item.product.category)
  );

  // 2. Select the top candidate in each role
  const bestCleanser = cleansers[0] || null;
  const bestMoisturizer = moisturizers[0] || null;
  const bestSunscreen = sunscreens[0] || null;

  // Active serum selection (prefer non-irritating pair for AM & PM)
  const bestActiveAM = serums[0] || null;
  const bestActivePM = serums.length > 1
    ? serums.find((s) => String(s.product._id) !== String(bestActiveAM?.product?._id)) || bestActiveAM
    : bestActiveAM;

  // Eye care selection (only if dark circles is a detected concern)
  const hasDarkCircles = diagnostics.detectedConcerns?.some(
    (c) => c.concern === 'Dark circles' && (c.severity !== 'Low' || c.score >= 35)
  );
  const bestEyeCare = hasDarkCircles && eyeCareItems.length > 0 ? eyeCareItems[0] : null;

  // 3. Collect chosen products and enforce active safety rules
  const candidatePicks = [
    bestCleanser && { ...bestCleanser, timeOfDay: 'both', stepName: 'Cleanse' },
    bestEyeCare && { ...bestEyeCare, timeOfDay: 'both', stepName: 'Eye Care' },
    bestActiveAM && { ...bestActiveAM, timeOfDay: 'morning', stepName: 'Target / Treat (AM)' },
    bestActivePM && { ...bestActivePM, timeOfDay: 'evening', stepName: 'Active Repair (PM)' },
    bestMoisturizer && { ...bestMoisturizer, timeOfDay: 'both', stepName: 'Barrier Hydration' },
    bestSunscreen && { ...bestSunscreen, timeOfDay: 'morning', stepName: 'Sun Protection' },
  ].filter(Boolean);

  const safePicks = enforceActiveSafetyRules(candidatePicks, diagnostics);

  // 4. Format products list
  const selectedProducts = safePicks.map(formatProductOutput);

  // 5. Build Morning Routine (AM)
  const morningRoutine = [];
  let stepOrderAM = 1;

  if (bestCleanser) {
    morningRoutine.push({
      stepOrder: stepOrderAM++,
      stepName: 'Cleanse',
      product: bestCleanser.product._id,
      productName: bestCleanser.product.name,
      brand: bestCleanser.product.brand,
      productImage: bestCleanser.product.imageUrl || '/product-placeholder.svg',
      category: bestCleanser.product.category || 'Cleanser',
      instructions: 'Rinse with lukewarm water and cleanse gently to remove overnight metabolic sebum.',
      activeIngredients: bestCleanser.matchedActives || [],
      frequency: 'Daily (AM)',
    });
  }

  if (bestActiveAM) {
    morningRoutine.push({
      stepOrder: stepOrderAM++,
      stepName: 'Target & Protect',
      product: bestActiveAM.product._id,
      productName: bestActiveAM.product.name,
      brand: bestActiveAM.product.brand,
      productImage: bestActiveAM.product.imageUrl || '/product-placeholder.svg',
      category: bestActiveAM.product.category || 'Serum',
      instructions: 'Pat 3-4 drops across face. Delivers daytime antioxidant shielding.',
      activeIngredients: bestActiveAM.matchedActives || [],
      frequency: 'Daily (AM)',
    });
  }

  if (bestEyeCare) {
    morningRoutine.push({
      stepOrder: stepOrderAM++,
      stepName: 'Under-Eye Care',
      product: bestEyeCare.product._id,
      productName: bestEyeCare.product.name,
      brand: bestEyeCare.product.brand,
      productImage: bestEyeCare.product.imageUrl || '/product-placeholder.svg',
      category: bestEyeCare.product.category || 'Eye Care',
      instructions: 'Gently tap a rice-grain amount along the infraorbital bone to stimulate microcirculation.',
      activeIngredients: bestEyeCare.matchedActives || [],
      frequency: 'Daily (AM)',
    });
  }

  if (bestMoisturizer) {
    morningRoutine.push({
      stepOrder: stepOrderAM++,
      stepName: 'Moisturize',
      product: bestMoisturizer.product._id,
      productName: bestMoisturizer.product.name,
      brand: bestMoisturizer.product.brand,
      productImage: bestMoisturizer.product.imageUrl || '/product-placeholder.svg',
      category: bestMoisturizer.product.category || 'Moisturizer',
      instructions: 'Smooth over skin to seal in hydration and reinforce natural barrier lipids.',
      activeIngredients: bestMoisturizer.matchedActives || [],
      frequency: 'Daily (AM)',
    });
  }

  if (bestSunscreen) {
    morningRoutine.push({
      stepOrder: stepOrderAM++,
      stepName: 'Sun Shield (SPF 50+)',
      product: bestSunscreen.product._id,
      productName: bestSunscreen.product.name,
      brand: bestSunscreen.product.brand,
      productImage: bestSunscreen.product.imageUrl || '/product-placeholder.svg',
      category: bestSunscreen.product.category || 'Sunscreen',
      instructions: 'Mandatory daily photoprotection. Apply generously 15 minutes prior to sun exposure.',
      activeIngredients: bestSunscreen.matchedActives || [],
      frequency: 'Daily (AM)',
    });
  }

  // 6. Build Evening Routine (PM)
  const eveningRoutine = [];
  let stepOrderPM = 1;

  if (bestCleanser) {
    eveningRoutine.push({
      stepOrder: stepOrderPM++,
      stepName: 'Cleanse & Clarify',
      product: bestCleanser.product._id,
      productName: bestCleanser.product.name,
      brand: bestCleanser.product.brand,
      productImage: bestCleanser.product.imageUrl || '/product-placeholder.svg',
      category: bestCleanser.product.category || 'Cleanser',
      instructions: 'Double-cleanse to thoroughly lift airborne pollutants, sunscreen residue, and excess pore oils.',
      activeIngredients: bestCleanser.matchedActives || [],
      frequency: 'Daily (PM)',
    });
  }

  if (bestEyeCare) {
    eveningRoutine.push({
      stepOrder: stepOrderPM++,
      stepName: 'Nocturnal Eye Care',
      product: bestEyeCare.product._id,
      productName: bestEyeCare.product.name,
      brand: bestEyeCare.product.brand,
      productImage: bestEyeCare.product.imageUrl || '/product-placeholder.svg',
      category: bestEyeCare.product.category || 'Eye Care',
      instructions: 'Tap gently along the orbital margin before heavier night creams.',
      activeIngredients: bestEyeCare.matchedActives || [],
      frequency: 'Daily (PM)',
    });
  }

  if (bestActivePM) {
    eveningRoutine.push({
      stepOrder: stepOrderPM++,
      stepName: 'Targeted Night Treatment',
      product: bestActivePM.product._id,
      productName: bestActivePM.product.name,
      brand: bestActivePM.product.brand,
      productImage: bestActivePM.product.imageUrl || '/product-placeholder.svg',
      category: bestActivePM.product.category || 'Serum',
      instructions: 'Apply to clean, dry skin. Begin 2-3 nights per week to build epidermal tolerance.',
      activeIngredients: bestActivePM.matchedActives || [],
      frequency: '2-3x per week or nightly as tolerated',
    });
  }

  if (bestMoisturizer) {
    eveningRoutine.push({
      stepOrder: stepOrderPM++,
      stepName: 'Nocturnal Barrier Recovery',
      product: bestMoisturizer.product._id,
      productName: bestMoisturizer.product.name,
      brand: bestMoisturizer.product.brand,
      productImage: bestMoisturizer.product.imageUrl || '/product-placeholder.svg',
      category: bestMoisturizer.product.category || 'Moisturizer',
      instructions: 'Seal in hydration with barrier lipids to prevent overnight transepidermal water loss.',
      activeIngredients: bestMoisturizer.matchedActives || [],
      frequency: 'Daily (PM)',
    });
  }

  // 7. Safety notes and guidelines
  const safetyNotes = [
    'Perform a 24-hour patch test behind your ear before full facial application of new active formulas.',
    'Daily broad-spectrum SPF 50+ is mandatory every morning to prevent photosensitivity and pigment recurrence.',
    'Do not combine physical abrasive scrubs with chemical exfoliants (AHA/BHA) or retinoids.',
    'If peeling, stinging, or redness occurs, pause active treatments and focus on ceramide barrier hydration.',
  ];

  return {
    selectedProducts,
    morningRoutine,
    eveningRoutine,
    safetyNotes,
    disclaimer: MEDICAL_DISCLAIMER,
  };
}
