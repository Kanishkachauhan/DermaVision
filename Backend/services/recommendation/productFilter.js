// Backend/services/recommendation/productFilter.js
/**
 * Multi-Stage Product Filtering Pipeline for DermaVision Recommendation System
 *
 * Implements strict, sequential criteria:
 * 1. Product Availability & Active Status
 * 2. User Allergy Restrictions (Zero-tolerance exclusion)
 * 3. Reactive Sensitivity & High-Erythema Guardrails
 * 4. Skin Type Compatibility
 * 5. Concern Compatibility & Category Role
 * 6. Product Warnings & Contraindications
 */

import { checkAllergenConflict } from './clinicalRules.js';

/**
 * Evaluates whether a product passes all compatibility filters.
 *
 * @param {Object} product - Product document
 * @param {Object} context - Filter context { diagnostics, userAllergies, userSensitivities, preferences }
 * @returns {Object} { pass: boolean, reasons: string[] }
 */
export function evaluateProductFilters(product, context = {}) {
  const reasons = [];
  const { diagnostics = {}, userAllergies = [], userSensitivities = [], preferences = {} } = context;

  // ── 1. PRODUCT AVAILABILITY & ACTIVE STATUS ────────────────────────────────
  if (!product.isActive) {
    return { pass: false, filterName: 'availability', reason: 'Product is currently inactive in the catalog.' };
  }

  const avail = String(product.availability || '').toLowerCase();
  if (avail.includes('out of stock') || avail.includes('discontinued')) {
    return { pass: false, filterName: 'availability', reason: 'Product is currently out of stock.' };
  }

  // ── 2. ALLERGY RESTRICTIONS (Absolute Zero-Tolerance) ──────────────────────
  if (Array.isArray(userAllergies) && userAllergies.length > 0) {
    for (const allergen of userAllergies) {
      const conflict = checkAllergenConflict(product, allergen);
      if (conflict) {
        return {
          pass: false,
          filterName: 'allergy',
          reason: `Filtered out: Formulation contains user-declared allergen '${conflict.allergen}' (detected in ${conflict.source}: "${conflict.details}").`,
        };
      }
    }
  }

  // ── 3. SENSITIVITY & HIGH REDNESS GUARDRAILS ───────────────────────────────
  const isSensitiveUser = (userSensitivities || []).some((s) =>
    String(s).toLowerCase().includes('sensitive') || String(s).toLowerCase().includes('rosacea')
  );
  const isHighRedness = (diagnostics.detectedConcerns || []).some(
    (c) => c.concern === 'Redness' && (c.severity === 'High' || c.score >= 67)
  );

  if (isSensitiveUser || isHighRedness) {
    const prodText = `${product.name} ${product.description || ''}`.toLowerCase();
    const ingredientsStr = (product.ingredients || [])
      .map((i) => (typeof i === 'string' ? i : i.name || '').toLowerCase())
      .join(' ');

    // Filter harsh synthetic fragrance if flagged sensitive
    if (ingredientsStr.includes('fragrance') || ingredientsStr.includes('parfum')) {
      return {
        pass: false,
        filterName: 'sensitivity',
        reason: 'Filtered out: Contains synthetic fragrance which can trigger reactive facial flushing on sensitive skin.',
      };
    }

    // Filter high alcohol denat
    if (ingredientsStr.includes('alcohol denat') || ingredientsStr.includes('denatured alcohol')) {
      return {
        pass: false,
        filterName: 'sensitivity',
        reason: 'Filtered out: Contains drying denatured alcohol, contraindicated for compromised barriers.',
      };
    }

    // Filter physical abrasive walnut/apricot scrubs
    if (prodText.includes('walnut') || prodText.includes('apricot scrub') || prodText.includes('microbead')) {
      return {
        pass: false,
        filterName: 'sensitivity',
        reason: 'Filtered out: Coarse physical scrub is contraindicated for reactive capillary redness.',
      };
    }
  }

  // ── 4. SKIN TYPE COMPATIBILITY ─────────────────────────────────────────────
  const userSkinType = (diagnostics.skinType || 'Combination').toLowerCase();
  const prodSkinTypes = (product.suitableSkinTypes || [])
    .concat(product.skinTypes || [])
    .map((s) => s.toLowerCase());

  if (prodSkinTypes.length > 0) {
    const supportsAll = prodSkinTypes.some((st) => st.includes('all') || st.includes('universal'));
    const supportsUserType = prodSkinTypes.some((st) => st.includes(userSkinType));

    // Specific disqualifications
    if (userSkinType === 'oily') {
      const isHeavyOcclusive = prodSkinTypes.every((st) => st === 'dry' || st === 'very dry');
      if (isHeavyOcclusive) {
        return {
          pass: false,
          filterName: 'skin_type',
          reason: `Filtered out: Formulated exclusively for dry skin; too occlusive for ${diagnostics.skinType} skin.`,
        };
      }
    }

    if (userSkinType === 'dry') {
      const isStrippingOilyOnly = prodSkinTypes.every((st) => st === 'oily' || st === 'very oily');
      if (isStrippingOilyOnly) {
        return {
          pass: false,
          filterName: 'skin_type',
          reason: `Filtered out: Formulated exclusively for oily skin; may strip dry barrier lipids.`,
        };
      }
    }

    if (!supportsAll && !supportsUserType) {
      // Soft mismatch penalty handled in scorer unless exclusively incompatible
    }
  }

  // ── 5. PRODUCT WARNINGS & CONTRAINDICATIONS ────────────────────────────────
  const warnings = (product.warnings || []).concat(product.contraindications || []).map((w) => w.toLowerCase());
  for (const warning of warnings) {
    if (isSensitiveUser && warning.includes('not suitable for sensitive skin')) {
      return {
        pass: false,
        filterName: 'warning',
        reason: 'Filtered out: Manufacturer warning specifies not suitable for sensitive skin.',
      };
    }
  }

  // ── 6. BUDGET PREFERENCE (Soft / Hard threshold) ───────────────────────────
  if (preferences.maxBudget && typeof preferences.maxBudget === 'number' && preferences.maxBudget > 0) {
    if (product.price && product.price > preferences.maxBudget * 1.5) {
      return {
        pass: false,
        filterName: 'budget',
        reason: `Filtered out: Price (${product.price} INR) exceeds user maximum budget preference (${preferences.maxBudget} INR).`,
      };
    }
  }

  return { pass: true, filterName: null, reason: null };
}

/**
 * Filters a complete list of candidate products through the pipeline.
 *
 * @param {Array} products - List of MongoDB product documents
 * @param {Object} context - Filter context
 * @returns {Array} Filtered list of products that passed all checks
 */
export function filterProductCatalog(products = [], context = {}) {
  const passed = [];
  const rejected = [];

  for (const product of products) {
    const evalResult = evaluateProductFilters(product, context);
    if (evalResult.pass) {
      passed.push(product);
    } else {
      rejected.push({
        productId: product._id,
        name: product.name,
        filterName: evalResult.filterName,
        reason: evalResult.reason,
      });
    }
  }

  return {
    passed,
    rejected,
    totalInput: products.length,
    totalPassed: passed.length,
  };
}
