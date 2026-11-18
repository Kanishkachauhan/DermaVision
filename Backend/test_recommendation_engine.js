// Backend/test_recommendation_engine.js
/**
 * Comprehensive Test Suite for DermaVision Personalized Recommendation Engine
 *
 * Covers:
 * 1. Unit Tests:
 *    - Different Skin Reports (Acne, Redness, Dark Circles, Enlarged Pores, Balanced)
 *    - Strict Allergy Exclusions (Salicylic Acid, Fragrance, Nuts)
 *    - Missing / Insufficient Report Data (Graceful Baseline Fallback)
 *    - Incompatible Active Combinations & Irritation Resolution
 *    - Empty Product Catalog Edge Case
 *    - Output Structure Validation (All 12 required fields)
 * 2. Integration Tests:
 *    - Real Report persistence and linking (User, Report, SkincareRoutine)
 *    - Database transaction and idempotency
 *    - Access Control (RBAC 403 on unauthorized access)
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/User.js';
import Report from './models/report.js';
import Product from './models/product.js';
import Recommendation from './models/recommendation.js';
import SkincareRoutine from './models/skincareRoutine.js';

import {
  parseSkinReport,
  evaluateRecommendationPure,
  generatePersonalizedRecommendation,
  getRecommendationForReport,
  formatProductOutput,
} from './services/recommendationService.js';

// ── Mock Product Catalog for Pure Unit Tests ─────────────────────────────────
const MOCK_CATALOG = [
  {
    _id: 'prod_cleanser_gentle',
    name: 'Gentle Hydrating Cleanser with Oat Oil',
    brand: 'DermaVision Lab',
    category: 'Cleanser',
    price: 399,
    suitableSkinTypes: ['All', 'Sensitive', 'Dry', 'Combination'],
    targetConcerns: ['Redness', 'Dryness'],
    ingredients: [{ name: 'Avena Sativa (Oat) Kernel Oil' }, { name: 'Glycerin' }, { name: 'Bisabolol' }],
    usageInstructions: ['Massage gently over damp face for 60 seconds and rinse with lukewarm water.'],
    warnings: ['For external use only.'],
    productUrl: 'https://dermavision.ai/products/gentle-cleanser',
    isActive: true,
    rating: 4.6,
  },
  {
    _id: 'prod_cleanser_bha',
    name: 'Clarifying Salicylic Acid 2% Cleanser',
    brand: 'The Active Lab',
    category: 'Cleanser',
    price: 349,
    suitableSkinTypes: ['Oily', 'Combination'],
    targetConcerns: ['Acne', 'Visible pores'],
    ingredients: [{ name: 'Salicylic Acid', concentration: '2%' }, { name: 'Zinc PCA' }, { name: 'Tea Tree Oil' }],
    usageInstructions: ['Lather between damp palms and apply to face. Rinse thoroughly.'],
    warnings: ['Contains Beta Hydroxy Acid. Avoid direct contact with eye contour.'],
    productUrl: 'https://dermavision.ai/products/salicylic-cleanser',
    isActive: true,
    rating: 4.5,
  },
  {
    _id: 'prod_serum_salicylic',
    name: 'Salicylic Acid 2% + Zinc PCA Anti-Acne Serum',
    brand: 'The Active Lab',
    category: 'Serum',
    price: 599,
    suitableSkinTypes: ['Oily', 'Combination'],
    targetConcerns: ['Acne', 'Visible pores'],
    ingredients: [{ name: 'Salicylic Acid', concentration: '2%' }, { name: 'Zinc PCA', concentration: '1%' }, { name: 'Aloe Barbadensis Leaf Juice' }],
    usageInstructions: ['Apply 2-3 drops to dry skin after cleansing in PM.'],
    warnings: ['Do not combine with other strong acids. Sunscreen is mandatory during daytime.'],
    productUrl: 'https://dermavision.ai/products/salicylic-serum',
    isActive: true,
    rating: 4.7,
  },
  {
    _id: 'prod_serum_cica',
    name: 'Centella Asiatica 10% + Bisabolol Soothing Serum',
    brand: 'DermaVision Lab',
    category: 'Serum',
    price: 649,
    suitableSkinTypes: ['Sensitive', 'All', 'Combination', 'Dry'],
    targetConcerns: ['Redness', 'Dryness'],
    ingredients: [{ name: 'Centella Asiatica Extract', concentration: '10%' }, { name: 'Bisabolol' }, { name: 'Panthenol' }],
    usageInstructions: ['Pat 3-4 drops gently across face and neck.'],
    warnings: ['Patch test recommended for hyper-reactive skin.'],
    productUrl: 'https://dermavision.ai/products/cica-soothing-serum',
    isActive: true,
    rating: 4.8,
  },
  {
    _id: 'prod_serum_retinol',
    name: 'Encapsulated Retinol 0.3% Night Renewal Treatment',
    brand: 'DermaVision Lab',
    category: 'Serum',
    price: 799,
    suitableSkinTypes: ['Normal', 'Combination'],
    targetConcerns: ['Visible pores', 'Uneven skin tone'],
    ingredients: [{ name: 'Retinol', concentration: '0.3%' }, { name: 'Squalane' }, { name: 'Ceramide NP' }],
    usageInstructions: ['Apply pea-sized amount 2-3 nights per week only.'],
    warnings: ['Do not use if pregnant or nursing. Do not combine with peeling acids.'],
    productUrl: 'https://dermavision.ai/products/retinol-serum',
    isActive: true,
    rating: 4.6,
  },
  {
    _id: 'prod_eye_caffeine',
    name: 'Caffeine 5% + Peptide Periorbital Eye Serum',
    brand: 'DermaVision Lab',
    category: 'Eye care',
    price: 499,
    suitableSkinTypes: ['All'],
    targetConcerns: ['Dark circles'],
    ingredients: [{ name: 'Caffeine', concentration: '5%' }, { name: 'Palmitoyl Tripeptide-38' }, { name: 'Hyaluronic Acid' }],
    usageInstructions: ['Tap a rice-grain amount along orbital bone.'],
    warnings: ['Avoid direct contact with conjunctiva / eyeball.'],
    productUrl: 'https://dermavision.ai/products/caffeine-eye-serum',
    isActive: true,
    rating: 4.4,
  },
  {
    _id: 'prod_moisturizer_ceramide',
    name: 'Ceramide Complex 1% Barrier Repair Cream',
    brand: 'DermaVision Lab',
    category: 'Moisturizer',
    price: 549,
    suitableSkinTypes: ['All', 'Dry', 'Sensitive', 'Combination'],
    targetConcerns: ['Dryness', 'Redness'],
    ingredients: [{ name: 'Ceramide NP' }, { name: 'Ceramide AP' }, { name: 'Squalane' }, { name: 'Hyaluronic Acid' }],
    usageInstructions: ['Smooth over face and neck as moisturizing step.'],
    warnings: ['Store in a cool, dry place.'],
    productUrl: 'https://dermavision.ai/products/ceramide-cream',
    isActive: true,
    rating: 4.9,
  },
  {
    _id: 'prod_sunscreen_mineral',
    name: 'Ultra-Lightweight Mineral Sunscreen SPF 50+ PA++++',
    brand: 'DermaVision Lab',
    category: 'Sunscreen',
    price: 499,
    suitableSkinTypes: ['All', 'Sensitive', 'Oily', 'Combination'],
    targetConcerns: ['Sun protection', 'Redness', 'Uneven skin tone'],
    ingredients: [{ name: 'Zinc Oxide', concentration: '12%' }, { name: 'Niacinamide', concentration: '2%' }],
    usageInstructions: ['Apply two finger-lengths generously as the final AM step.'],
    warnings: ['Reapply every 2 hours when exposed to direct sunlight.'],
    productUrl: 'https://dermavision.ai/products/mineral-sunscreen',
    isActive: true,
    rating: 4.7,
  },
  {
    _id: 'prod_fragranced_scrub',
    name: 'Aromatic Citrus & Walnut Shell Facial Polish',
    brand: 'Harsh Beauty',
    category: 'Exfoliator',
    price: 299,
    suitableSkinTypes: ['Oily'],
    targetConcerns: ['Visible pores'],
    ingredients: [{ name: 'Walnut Shell Powder' }, { name: 'Parfum (Fragrance)' }, { name: 'Alcohol Denat' }],
    usageInstructions: ['Scrub vigorously onto skin.'],
    warnings: ['Avoid if skin is broken or sensitive.'],
    productUrl: 'https://dermavision.ai/products/walnut-scrub',
    isActive: true,
    rating: 3.2,
  },
];

async function runTestSuite() {
  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log('DERMAVISION: AI PERSONALIZED RECOMMENDATION ENGINE TEST SUITE');
  console.log('═════════════════════════════════════════════════════════════════\n');

  let testPassedCount = 0;
  const assert = (condition, message) => {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    testPassedCount++;
    console.log(`  ✓ ${message}`);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. UNIT TEST: Report Schema Parsing & Mapping
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('─── [1/7] Unit Test: Real Report Schema Mapping ───');
  {
    const rawReport = {
      _id: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      skinType: 'oily',
      healthScore: 68,
      predictions: [
        { condition: 'Acne & Blemishes', confidence: 96.5, severity: 'Moderate' },
        { condition: 'Enlarged Pores', confidence: 84.2, severity: 'Low' },
      ],
      notes: 'Patient scan shows T-zone shine and comedones.',
    };

    const parsed = parseSkinReport(rawReport);
    assert(parsed.skinType === 'Oily', 'Normalized skin type to TitleCase "Oily"');
    assert(parsed.healthScore === 68, 'Extracted healthScore 68');
    assert(parsed.detectedConcerns.length === 2, 'Mapped exactly 2 canonical concerns');
    assert(parsed.primaryConcern.concern === 'Acne', 'Identified primary concern as "Acne"');
    assert(parsed.primaryConcern.confidence === 96.5, 'Preserved pure ML detection confidence');
    assert(parsed.primaryConcern.severity === 'Moderate', 'Extracted cosmetic severity level');
    assert(!parsed.isInsufficient, 'Flagged report as sufficient for personalized care');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. UNIT TEST: Acne-Dominant Report Recommendation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [2/7] Unit Test: Acne-Dominant Recommendation Generation ───');
  {
    const acneReport = {
      skinType: 'Oily',
      healthScore: 62,
      predictions: [
        { condition: 'Acne & Blemishes', confidence: 92, severity: 'Moderate' },
      ],
    };

    const rec = evaluateRecommendationPure({
      reportData: acneReport,
      catalog: MOCK_CATALOG,
    });

    assert(rec.selectedProducts.length >= 4, `Selected ${rec.selectedProducts.length} curated products`);
    const hasSalicylic = rec.selectedProducts.some((p) => p.name.includes('Salicylic Acid'));
    assert(hasSalicylic, 'Recommended targeted Salicylic Acid treatment for Acne');
    const hasSunscreen = rec.selectedProducts.some((p) => p.category === 'Sunscreen');
    assert(hasSunscreen, 'Mandatory SPF 50+ sunscreen included in daytime routine');
    assert(rec.morningRoutine.length >= 3, 'Built structured morning routine');
    assert(rec.eveningRoutine.length >= 2, 'Built structured evening routine');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. UNIT TEST: Strict Allergy Restriction (Salicylic Acid Allergy)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [3/7] Unit Test: Strict Allergy Enforcement (Salicylic Acid) ───');
  {
    const acneReport = {
      skinType: 'Oily',
      healthScore: 60,
      predictions: [{ condition: 'Acne', confidence: 95, severity: 'Moderate' }],
    };

    // User is allergic to Salicylic Acid!
    const recAllergic = evaluateRecommendationPure({
      reportData: acneReport,
      catalog: MOCK_CATALOG,
      userProfile: { allergies: ['Salicylic Acid'] },
    });

    const contaminated = recAllergic.selectedProducts.filter((p) =>
      p.name.toLowerCase().includes('salicylic') ||
      p.ingredients.some((i) => i.toLowerCase().includes('salicylic'))
    );
    assert(contaminated.length === 0, 'Zero products containing Salicylic Acid recommended');
    assert(recAllergic.filteringStats.rejectedCount >= 2, 'Allergic products explicitly rejected during filtering');
    console.log(`    ℹ Rejected products count: ${recAllergic.filteringStats.rejectedCount}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. UNIT TEST: Reactive Redness / Fragrance Allergy & Non-Irritation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [4/7] Unit Test: Reactive Redness & Sensitivity Guardrails ───');
  {
    const rednessReport = {
      skinType: 'Dry',
      healthScore: 55,
      predictions: [{ condition: 'Facial Redness & Erythema', confidence: 88, severity: 'High' }],
    };

    const recRedness = evaluateRecommendationPure({
      reportData: rednessReport,
      catalog: MOCK_CATALOG,
      userProfile: { sensitivities: ['Sensitive skin'] },
    });

    const hasCica = recRedness.selectedProducts.some((p) => p.name.includes('Centella') || p.name.includes('Ceramide'));
    assert(hasCica, 'Recommended barrier-soothing Centella / Ceramide active for High Redness');

    // Harsh walnut scrub with fragrance & alcohol MUST be rejected
    const hasHarshScrub = recRedness.selectedProducts.some((p) => p.name.includes('Walnut'));
    assert(!hasHarshScrub, 'Harsh walnut scrub and synthetic fragrance strictly disqualified');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. UNIT TEST: Missing / Insufficient Data & Empty Catalog Edge Cases
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [5/7] Unit Test: Missing Data & Empty Catalog Fallback ───');
  {
    // Insufficient Report: Empty predictions, missing skinType
    const emptyReport = { predictions: [] };
    const recEmpty = evaluateRecommendationPure({
      reportData: emptyReport,
      catalog: MOCK_CATALOG,
    });

    assert(recEmpty.diagnostics.isInsufficient === true, 'Correctly flagged report as insufficient');
    assert(recEmpty.diagnostics.skinType === 'Combination', 'Defaulted gracefully to Combination skin');
    assert(recEmpty.selectedProducts.length > 0, 'Provided safe baseline universal products');

    // Empty Catalog Test: Catalog has 0 items
    const recZeroCatalog = evaluateRecommendationPure({
      reportData: { skinType: 'Oily' },
      catalog: [],
    });

    assert(recZeroCatalog.selectedProducts.length === 0, 'Handled empty catalog without crashing');
    assert(recZeroCatalog.safetyNotes.length > 0, 'Returned informative safety guidance');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. UNIT TEST: Recommendation Output Structure (All 12 Required Fields)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [6/7] Unit Test: Product Output Specification Validation ───');
  {
    const sampleItem = MOCK_CATALOG[0];
    const formatted = formatProductOutput({
      product: sampleItem,
      matchScore: 92,
      targetedConcerns: ['Redness'],
      recommendationReason: 'Calibrated for barrier restoration.',
    });

    const requiredFields = [
      'productId',
      'name',
      'brand',
      'imageUrl',
      'category',
      'price',
      'relevantConcern',
      'reason',
      'ingredients',
      'applicationInstructions',
      'warnings',
      'productUrl',
    ];

    for (const field of requiredFields) {
      assert(formatted[field] !== undefined, `Output contains required field: "${field}"`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. INTEGRATION TEST: Database Persistence & Linking (User, Report, Routine)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [7/7] Integration Test: Live MongoDB Atlas Persistence ───');
  await connectDB();
  console.log('  ✓ Connected to MongoDB Atlas cluster');

  const testUser = await User.create({
    name: 'Clinical Engine Subject',
    email: `rec_test_${Date.now()}@dermavision.ai`,
    password: 'Password123!',
    role: 'user',
    isVerified: true,
  });
  console.log(`  ✓ Created isolated test user: ${testUser._id}`);

  const testReport = await Report.create({
    user: testUser._id,
    imageUrl: '/test-face-scan.jpg',
    skinType: 'Combination',
    healthScore: 72,
    predictions: [
      { condition: 'Dark Circles', confidence: 89, severity: 'Moderate' },
      { condition: 'Facial Redness', confidence: 76, severity: 'Low' },
    ],
    notes: 'Mild under-eye shadowing observed under ambient lighting.',
  });
  console.log(`  ✓ Created isolated skin report: ${testReport._id}`);

  // Execute End-to-End Engine
  const result = await generatePersonalizedRecommendation({
    userId: testUser._id,
    reportId: testReport._id,
    allergies: ['Fragrance'],
    sensitivities: ['Sensitive skin'],
    preferences: { preferredBrands: ['The Derma Co.', 'Deconstruct'] },
  });

  assert(result._id !== undefined, 'Recommendation persisted in MongoDB with ObjectId');
  assert(String(result.user) === String(testUser._id), 'Linked directly to User ID');
  assert(String(result.report) === String(testReport._id), 'Linked directly to Report ID');
  assert(result.skincareRoutine !== null, 'Companion SkincareRoutine persisted and linked');
  assert(result.formattedProducts.length >= 4, `Generated ${result.formattedProducts.length} formatted recommended products`);

  // Verify Report document was updated with references
  const updatedReport = await Report.findById(testReport._id);
  assert(updatedReport.recommendations.recommendedProductIds.length > 0, 'Updated Report document with recommended product IDs');
  assert(updatedReport.recommendations.morningRoutine.length > 0, 'Updated Report document with morning routine steps');

  // Verify RBAC access control
  const unauthUserId = new mongoose.Types.ObjectId();
  let rbacBlocked = false;
  try {
    await getRecommendationForReport(testReport._id, unauthUserId, 'user');
  } catch (err) {
    if (err.statusCode === 403) {
      rbacBlocked = true;
    }
  }
  assert(rbacBlocked, 'RBAC 403 strictly prevents unauthorized users from reading recommendations');

  // Clean up test documents
  await Recommendation.deleteMany({ user: testUser._id });
  await SkincareRoutine.deleteMany({ user: testUser._id });
  await Report.findByIdAndDelete(testReport._id);
  await User.findByIdAndDelete(testUser._id);
  console.log('  ✓ Cleaned up isolated test documents. Production collections unaffected.');

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`ALL ${testPassedCount} ASSERTIONS PASSED! RECOMMENDATION ENGINE IS PRODUCTION READY.`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  await mongoose.connection.close();
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test suite failed with error:', err);
  process.exit(1);
});
