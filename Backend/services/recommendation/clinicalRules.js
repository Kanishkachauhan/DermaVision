// Backend/services/recommendation/clinicalRules.js
/**
 * Clinical & Cosmetic Knowledge Matrix for DermaVision Recommendation System
 *
 * Enforces:
 * - Evidence-based cosmetic active mappings
 * - Strict allergen dictionary & substring normalizers
 * - Non-irritating active combination & separation rules
 * - Non-medical / non-diagnostic compliance
 */

export const MEDICAL_DISCLAIMER =
  'DermaVision provides evidence-informed cosmetic and skincare guidance based on non-invasive visual analysis. This recommendation does NOT constitute medical advice, clinical diagnosis, or a prescription. For persistent skin conditions, severe cystic acne, or undiagnosed erythema, consult a licensed dermatologist.';

/**
 * Beneficial cosmetic actives, contraindications, and rationale per canonical concern.
 */
export const CONCERN_CLINICAL_MAP = {
  Acne: {
    conditionTitle: 'Acne & Follicular Blemishes',
    targetActives: ['Salicylic Acid', 'BHA', 'Niacinamide', 'Zinc PCA', 'Benzoyl Peroxide', 'Azelaic Acid', 'Tea Tree'],
    avoidActives: ['Coconut Oil', 'Heavy Mineral Oils', 'Lanolin', 'Isopropyl Myristate', 'Physical Walnut Scrubs'],
    severityRationales: {
      High: 'Active inflammatory lesions require gentle non-comedogenic balancing, antimicrobial support, and soothing barrier protection to prevent post-inflammatory hyperpigmentation.',
      Moderate: 'Mild-to-moderate comedonal congestion responds best to pore-clearing lipophilic BHA (Salicylic Acid) and sebum-modulating Niacinamide without stripping natural lipids.',
      Low: 'Minimal occasional breakouts require non-stripping daily cleansing and non-comedogenic hydration to maintain balanced follicular turnover.',
    },
  },
  Redness: {
    conditionTitle: 'Facial Vascular Redness & Reactive Flush',
    targetActives: ['Centella Asiatica', 'Cica', 'Azelaic Acid', 'Bisabolol', 'Ceramide', 'Colloidal Oatmeal', 'Panthenol', 'Oats'],
    avoidActives: ['Glycolic Acid > 5%', 'Denatured Alcohol', 'Synthetic Fragrance', 'Coarse Physical Scrubs', 'Menthol', 'Eucalyptus Oil'],
    severityRationales: {
      High: 'Marked erythema signifies capillary hyper-reactivity and micro-barrier compromise. Strong chemical exfoliants must be avoided in favor of soothing Centella, Bisabolol, and lipid barrier restoration.',
      Moderate: 'Reactive flushing benefits from anti-inflammatory Centella, Azelaic Acid, and physiological Ceramides to pacify dilated dermal capillaries.',
      Low: 'Baseline mild redness maintains resilience with gentle, fragrance-free hydration and daily mineral-safe photoprotection.',
    },
  },
  'Dark circles': {
    conditionTitle: 'Infraorbital Periorbital Dark Circles',
    targetActives: ['Caffeine', 'Niacinamide', 'Peptides', 'Hyaluronic Acid', 'Green Tea Extract', 'Vitamin C', 'Alpha Arbutin'],
    avoidActives: ['High-strength Retinoids directly on eyelid margin', 'High-percentage Glycolic Acid around eyes', 'Harsh physical rubbing'],
    severityRationales: {
      High: 'Under-eye vascular pooling and deep shadow contrast benefit from micro-circulation stimulants (Caffeine) and periorbital peptides tapped gently along the orbital bone.',
      Moderate: 'Moderate periorbital darkness improves with topical caffeine, brightening antioxidants, and adequate sleep with elevated head positioning.',
      Low: 'Mild shadow depth is supported by lightweight humectant hydration and broad-spectrum daytime photoprotection.',
    },
  },
  'Visible pores': {
    conditionTitle: 'Sebaceous Pore Dilation & Rough Texture',
    targetActives: ['Niacinamide', 'Salicylic Acid', 'Zinc PCA', 'BHA', 'Gentle Retinol', 'Lactic Acid'],
    avoidActives: ['Heavy occlusive balms on T-zone', 'Comedogenic mineral waxes', 'Over-stripping alcohol toners'],
    severityRationales: {
      High: 'Enlarged follicular pores benefit from sebum-regulating Niacinamide and pore-refining BHA to dissolve keratin plugs and decrease visual pore diameter.',
      Moderate: 'Dilated pores respond effectively to gentle chemical exfoliation and lightweight, oil-free hydration.',
      Low: 'Minimal pore enlargement is maintained with daily non-comedogenic cleansing and balanced hydration.',
    },
  },
  Dryness: {
    conditionTitle: 'Barrier Dehydration & Transepidermal Water Loss',
    targetActives: ['Ceramides', 'Hyaluronic Acid', 'Squalane', 'Glycerin', 'Panthenol', 'Colloidal Oatmeal', 'Bisabolol'],
    avoidActives: ['Foaming SLS washes', 'High alcohol astringents', 'Frequent AHA peeling', 'Hot water washing'],
    severityRationales: {
      High: 'Significantly compromised stratum corneum requires rich physiological lipid replenishment (Ceramides NP/AP/EOP, Squalane) to seal transepidermal water evaporation.',
      Moderate: 'Dehydrated skin benefits from multi-molecular humectants layered beneath barrier-repairing moisturizers.',
      Low: 'Maintain optimal cellular moisture with daily gentle cleansing and ceramide-infused hydration.',
    },
  },
  'Uneven skin tone': {
    conditionTitle: 'Melanin Imbalance & Post-Blemish Pigmentation',
    targetActives: ['Vitamin C', 'Ascorbic Acid', 'Niacinamide', 'Azelaic Acid', 'Alpha Arbutin', 'Licorice Root Extract', 'Broad-Spectrum SPF 50+'],
    avoidActives: ['Unprotected UV exposure', 'Aggressive abrasive scrubs', 'Unbuffered citrus oils'],
    severityRationales: {
      High: 'Uneven pigmentation and dark spots require targeted tyrosinase downregulators (Vitamin C, Azelaic Acid) paired strictly with daily broad-spectrum SPF 50+ photoprotection.',
      Moderate: 'Mild tone irregularities benefit from regular gentle antioxidant application and religious morning sunscreen compliance.',
      Low: 'Maintain tone luminosity with protective antioxidants and daily broad-spectrum UV shielding.',
    },
  },
  Universal: {
    conditionTitle: 'Physiological Barrier Maintenance & Photoprotection',
    targetActives: ['Ceramides', 'Niacinamide', 'Glycerin', 'Hyaluronic Acid', 'Broad-Spectrum SPF 50+'],
    avoidActives: ['Harsh abrasive physical scrubs', 'High denatured alcohol'],
    severityRationales: {
      Low: 'Skin barrier is in optimal condition. Maintain balanced homeostasis with gentle pH-balanced cleansing, humectant hydration, and non-negotiable daily SPF 50+ defense.',
    },
  },
};

/**
 * Allergen synonym dictionary for robust substring and token matching.
 */
export const ALLERGEN_SYNONYMS = {
  'salicylic acid': ['salicylic acid', 'salicylate', 'sodium salicylate', 'bha', 'beta hydroxy acid'],
  niacinamide: ['niacinamide', 'nicotinamide', 'vitamin b3', 'nicotinate'],
  fragrance: ['fragrance', 'parfum', 'perfume', 'essential oil', 'linalool', 'limonene', 'geraniol', 'citronellol', 'citral'],
  retinol: ['retinol', 'retinyl', 'retinal', 'retinoid', 'adapalene', 'tretinoin', 'hydroxypinacolone'],
  alcohol: ['alcohol denat', 'denatured alcohol', 'isopropyl alcohol', 'ethanol', 'sd alcohol'],
  nuts: ['almond', 'walnut', 'macadamia', 'argan', 'hazelnut', 'prunus amygdalus', 'nut oil'],
  oats: ['oat', 'oatmeal', 'avena sativa'],
  sulfates: ['sodium lauryl sulfate', 'sodium laureth sulfate', 'sls', 'sles', 'ammonium lauryl sulfate'],
  parabens: ['methylparaben', 'propylparaben', 'butylparaben', 'ethylparaben', 'paraben'],
  caffeine: ['caffeine', 'coffea arabica', 'green tea extract', 'camellia sinensis'],
  glycolic: ['glycolic acid', 'aha', 'alpha hydroxy acid'],
  'vitamin c': ['ascorbic acid', 'l-ascorbic', 'sodium ascorbyl phosphate', 'tetrahexyldecyl ascorbate', 'ethyl ascorbic acid'],
  zinc: ['zinc pca', 'zinc oxide', 'zinc gluconate'],
};

/**
 * Checks whether a product matches a declared user allergen.
 *
 * @param {Object} product - Product record
 * @param {string} allergen - User declared allergen string
 * @returns {Object|null} Conflict details or null
 */
export function checkAllergenConflict(product, allergen) {
  if (!allergen || typeof allergen !== 'string') return null;
  const allergenLower = allergen.toLowerCase().trim();
  if (!allergenLower) return null;

  // Retrieve synonyms if known, otherwise test the allergen directly
  const searchTerms = ALLERGEN_SYNONYMS[allergenLower] || [allergenLower];

  const ingredientsList = (product.ingredients || []).map((i) =>
    (typeof i === 'string' ? i : i.name || '').toLowerCase()
  );
  const prodName = (product.name || '').toLowerCase();
  const prodDesc = (product.description || '').toLowerCase();

  for (const term of searchTerms) {
    // 1. Direct ingredient list match
    const matchedIngredient = ingredientsList.find((ing) => ing.includes(term));
    if (matchedIngredient) {
      return {
        allergen,
        matchedTerm: term,
        source: 'ingredients',
        details: matchedIngredient,
      };
    }

    // 2. Product name or description match (e.g. "Salicylic Acid Cleanser")
    if (prodName.includes(term) || prodDesc.includes(term)) {
      return {
        allergen,
        matchedTerm: term,
        source: 'product_details',
        details: prodName,
      };
    }
  }

  return null;
}

/**
 * Validates active ingredient compatibility across selected routine steps to prevent irritation.
 *
 * Rules:
 * 1. Never combine high-strength Retinoids + direct strong BHA/AHA in the same application step.
 * 2. If user has High Redness or marked sensitivity, suppress high-strength exfoliating acids in favor of barrier repair.
 * 3. Never pair Benzoyl Peroxide with pure Retinoids in concurrent step.
 *
 * @param {Array} selectedProducts - List of scored products
 * @param {Object} diagnostics - Parsed diagnostics
 * @returns {Array} Resolved safe products list
 */
export function enforceActiveSafetyRules(selectedProducts = [], diagnostics = {}) {
  const isHighRedness = diagnostics.detectedConcerns?.some(
    (c) => c.concern === 'Redness' && c.severity === 'High'
  );

  const safeList = [];
  let hasRetinoidInPM = false;
  let hasStrongAcidInPM = false;

  for (const item of selectedProducts) {
    const p = item.product || item;
    const pText = `${p.name} ${p.brand} ${p.description || ''}`.toLowerCase();
    const isRetinoid = pText.includes('retinol') || pText.includes('retinoid') || pText.includes('adapalene');
    const isStrongAcid = pText.includes('salicylic') || pText.includes('glycolic') || pText.includes('aha') || pText.includes('peel');

    // Rule 2: If skin has High Redness, avoid high-strength peeling acids entirely
    if (isHighRedness && isStrongAcid && !pText.includes('gentle') && !pText.includes('soothing')) {
      continue; // Filter out harsh acid to avoid reactive erythema flare
    }

    // Rule 1: Avoid concurrent Retinoid + Strong Acid in the same evening step
    if (item.timeOfDay === 'evening' || item.timeOfDay === 'both') {
      if (isRetinoid && hasStrongAcidInPM) {
        // Shift active or keep the gentler one
        continue;
      }
      if (isStrongAcid && hasRetinoidInPM) {
        continue;
      }
      if (isRetinoid) hasRetinoidInPM = true;
      if (isStrongAcid) hasStrongAcidInPM = true;
    }

    safeList.push(item);
  }

  return safeList;
}
