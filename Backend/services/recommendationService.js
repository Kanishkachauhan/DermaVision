// Backend/services/recommendationService.js
/**
 * Recommendation Service Facade
 *
 * Forwards requests to the modular AI recommendation system:
 * - reportParser
 * - clinicalRules
 * - productFilter
 * - productScorer
 * - routineBuilder
 * - recommendationEngine
 */

export {
  generatePersonalizedRecommendation,
  getRecommendationForReport,
  getUserRecommendations,
  getUserActiveRoutine,
  evaluateRecommendationPure,
  deriveClinicalStrategyFromDiagnostics,
} from './recommendation/recommendationEngine.js';

export { parseSkinReport, mapConditionToCanonical, normalizeSeverity, CANONICAL_CONCERNS } from './recommendation/reportParser.js';
export { CONCERN_CLINICAL_MAP, MEDICAL_DISCLAIMER, ALLERGEN_SYNONYMS, checkAllergenConflict } from './recommendation/clinicalRules.js';
export { evaluateProductFilters, filterProductCatalog } from './recommendation/productFilter.js';
export { scoreProduct, rankProducts } from './recommendation/productScorer.js';
export { buildPersonalizedRoutine, formatProductOutput } from './recommendation/routineBuilder.js';
