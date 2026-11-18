// Backend/services/recommendation/productScorer.js
/**
 * Transparent Product Scoring & Ranking Engine for DermaVision
 *
 * Enforces:
 * - Transparent 0–100 score calculation with itemized breakdown
 * - Explainable clinical/cosmetic reasoning for every recommended item
 * - Strict adherence to the rule: ML detection confidence is not severity;
 *   high confidence alone does not force a high product score.
 */

import { CONCERN_CLINICAL_MAP } from './clinicalRules.js';

/**
 * Calculates a transparent match score and explanation for a single product.
 *
 * @param {Object} product - Product document
 * @param {Object} context - Scoring context { diagnostics, clinicalStrategy, preferences }
 * @returns {Object} { matchScore, scoreBreakdown, matchedActives, targetedConcerns, recommendationReason }
 */
export function scoreProduct(product, context = {}) {
  const { diagnostics = {}, clinicalStrategy = {}, preferences = {} } = context;

  const scoreBreakdown = {
    base: 50,
    skinTypeScore: 0,
    concernScore: 0,
    activeSynergyScore: 0,
    soothingBonus: 0,
    brandBonus: 0,
    ratingBonus: 0,
    contraindicationPenalty: 0,
  };

  const matchedActives = [];
  const matchedConcerns = [];
  const prodText = `${product.name} ${product.brand} ${product.description || ''}`.toLowerCase();
  const prodIngredients = (product.ingredients || []).map((i) =>
    (typeof i === 'string' ? i : i.name || '').toLowerCase()
  );
  const prodConcerns = (product.targetConcerns || []).map((c) => c.toLowerCase());
  const prodSkinTypes = (product.suitableSkinTypes || [])
    .concat(product.skinTypes || [])
    .map((s) => s.toLowerCase());

  // ── 1. SKIN TYPE ALIGNMENT (+15 or -10) ────────────────────────────────────
  const userSkinType = (diagnostics.skinType || 'Combination').toLowerCase();
  if (prodSkinTypes.length > 0) {
    if (prodSkinTypes.some((st) => st.includes(userSkinType) || st.includes('all') || st.includes('universal'))) {
      scoreBreakdown.skinTypeScore = 15;
    } else {
      scoreBreakdown.skinTypeScore = -10;
    }
  } else {
    scoreBreakdown.skinTypeScore = 5; // Neutral
  }

  // ── 2. CONCERN ALIGNMENT (+20 Primary, +10 Secondary) ─────────────────────
  const primaryConcern = diagnostics.primaryConcern?.concern;
  if (primaryConcern) {
    const pcLower = primaryConcern.toLowerCase();
    const matchesPrimary =
      prodConcerns.some((c) => c.includes(pcLower)) ||
      prodText.includes(pcLower) ||
      (primaryConcern === 'Acne' && (prodText.includes('blemish') || prodText.includes('salicylic'))) ||
      (primaryConcern === 'Redness' && (prodText.includes('calming') || prodText.includes('soothing') || prodText.includes('cica'))) ||
      (primaryConcern === 'Dark circles' && (prodText.includes('caffeine') || prodText.includes('under-eye') || product.category.toLowerCase().includes('eye'))) ||
      (primaryConcern === 'Visible pores' && prodText.includes('pore'));

    if (matchesPrimary) {
      scoreBreakdown.concernScore += 20;
      matchedConcerns.push(primaryConcern);
    }
  }

  // Secondary concerns
  const secondaries = diagnostics.secondaryConcerns || [];
  for (const sec of secondaries) {
    const scLower = sec.concern.toLowerCase();
    const matchesSec = prodConcerns.some((c) => c.includes(scLower)) || prodText.includes(scLower);
    if (matchesSec && !matchedConcerns.includes(sec.concern)) {
      scoreBreakdown.concernScore += 10;
      matchedConcerns.push(sec.concern);
    }
  }

  // Foundational categories (Cleanser, Sunscreen, Moisturizer) get baseline concern relevance
  if (matchedConcerns.length === 0 && ['Cleanser', 'Face Wash', 'FaceWash', 'Moisturizer', 'Sunscreen'].includes(product.category)) {
    scoreBreakdown.concernScore = 10;
    matchedConcerns.push('Skin Barrier Maintenance');
  }

  // ── 3. ACTIVE INGREDIENT SYNERGY (+10 per matched active, max +30) ────────
  const candidateActives = clinicalStrategy.targetedActives || [];
  for (const active of candidateActives) {
    const activeLower = active.toLowerCase();
    const hasInIngredients = prodIngredients.some((i) => i.includes(activeLower));
    const hasInText = prodText.includes(activeLower);

    if (hasInIngredients || hasInText) {
      if (scoreBreakdown.activeSynergyScore < 30) {
        scoreBreakdown.activeSynergyScore += 10;
      }
      matchedActives.push(active);
    }
  }

  // ── 4. SOOTHING / BARRIER REPAIR BONUS (+10) ──────────────────────────────
  const isReactive = diagnostics.detectedConcerns?.some(
    (c) => (c.concern === 'Redness' && c.severity !== 'Low') || (c.concern === 'Dryness' && c.severity !== 'Low')
  );
  if (isReactive) {
    const soothingActives = ['centella', 'ceramide', 'bisabolol', 'panthenol', 'squalane', 'oat'];
    if (soothingActives.some((sa) => prodText.includes(sa) || prodIngredients.some((i) => i.includes(sa)))) {
      scoreBreakdown.soothingBonus = 10;
    }
  }

  // ── 5. USER PREFERENCE / BRAND MATCH (+10) ────────────────────────────────
  const preferredBrands = (preferences.preferredBrands || []).map((b) => b.toLowerCase());
  if (preferredBrands.includes(product.brand.toLowerCase())) {
    scoreBreakdown.brandBonus = 10;
  }

  // ── 6. VERIFIED HIGH RATING BONUS (+5) ────────────────────────────────────
  if (product.rating && product.rating >= 4.0) {
    scoreBreakdown.ratingBonus = Math.min(8, Math.round(product.rating * 1.5));
  }

  // ── 7. CONTRAINDICATION PENALTY (-30) ──────────────────────────────────────
  const avoidList = clinicalStrategy.avoidActives || [];
  for (const avoid of avoidList) {
    const avoidLower = avoid.toLowerCase();
    if (prodIngredients.some((i) => i.includes(avoidLower)) || prodText.includes(avoidLower)) {
      scoreBreakdown.contraindicationPenalty -= 30;
      break;
    }
  }

  // Compute final score
  const rawTotal =
    scoreBreakdown.base +
    scoreBreakdown.skinTypeScore +
    scoreBreakdown.concernScore +
    scoreBreakdown.activeSynergyScore +
    scoreBreakdown.soothingBonus +
    scoreBreakdown.brandBonus +
    scoreBreakdown.ratingBonus +
    scoreBreakdown.contraindicationPenalty;

  const matchScore = Math.max(15, Math.min(99, rawTotal));
  scoreBreakdown.total = matchScore;

  // ── 8. SYNTHESIZE CLINICAL & COSMETIC EXPLANATION (WHY) ────────────────────
  const reason = buildRecommendationReason({
    product,
    diagnostics,
    matchedActives: Array.from(new Set(matchedActives)),
    matchedConcerns,
    matchScore,
  });

  return {
    matchScore,
    scoreBreakdown,
    matchedActives: Array.from(new Set(matchedActives)),
    targetedConcerns: matchedConcerns.length > 0 ? matchedConcerns : [product.category],
    recommendationReason: reason,
  };
}

/**
 * Generates an explainable reason tailored to user's exact diagnostic state.
 */
function buildRecommendationReason({ product, diagnostics, matchedActives, matchedConcerns, matchScore }) {
  const category = product.category;
  const skinType = diagnostics.skinType || 'Combination';
  const primaryConcern = diagnostics.primaryConcern?.concern || 'Barrier Health';
  const activesStr = matchedActives.length > 0 ? matchedActives.slice(0, 3).join(', ') : null;

  if (['Cleanser', 'Face Wash', 'FaceWash'].includes(category)) {
    return `Gentle, non-stripping cleanser calibrated for ${skinType.toLowerCase()} skin. Cleanses pores and removes surface metabolic impurities without disturbing stratum corneum lipid bilayers.`;
  }

  if (category === 'Sunscreen') {
    return `Essential daily photoprotection (SPF 50+). Shields cellular DNA against UVA/UVB photo-aging, micro-vascular erythema dilation, and post-blemish pigment darkening.`;
  }

  if (category === 'Moisturizer') {
    return `Locks in physiological hydration and reinforces natural intercellular barrier lipids for ${skinType.toLowerCase()} skin, preventing transepidermal water loss.`;
  }

  if (['Eye care', 'Eye Care', 'EyeCare'].includes(category)) {
    return `Targeted periorbital micro-circulation support. Formulated with ${activesStr || 'gentle active peptides and caffeine'} to diminish infraorbital dark circle shadow contrast.`;
  }

  if (['Serum', 'Treatment'].includes(category)) {
    if (activesStr) {
      return `Targeted active treatment formulated with ${activesStr} to address ${primaryConcern.toLowerCase()}, promoting cellular turnover without compromising barrier tolerance.`;
    }
    return `Targeted clinical treatment calibrated for ${primaryConcern.toLowerCase()} on ${skinType.toLowerCase()} skin.`;
  }

  return `Formulated to support ${primaryConcern.toLowerCase()} and maintain skin barrier integrity on ${skinType.toLowerCase()} skin.`;
}

/**
 * Scores and ranks an array of candidate products, returning them in descending matchScore order.
 */
export function rankProducts(products = [], context = {}) {
  const scored = products.map((product) => {
    const scoredDetails = scoreProduct(product, context);
    return {
      product,
      ...scoredDetails,
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);
  return scored;
}
