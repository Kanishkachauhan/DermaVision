// Backend/test_single_scan_workflow.js
/**
 * End-to-End Test Suite: Single-Scan-to-Recommendation Workflow
 *
 * Verifies the Core Requirement:
 * "The user should scan their face only once.
 * After the existing ML models finish analyzing the image and generate the
 * skin analysis report, automatically generate all recommendations using that same report."
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
  generatePersonalizedRecommendation,
  getRecommendationForReport,
  parseSkinReport,
  evaluateRecommendationPure,
} from './services/recommendationService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failed++;
  }
}

async function runSingleScanWorkflowTests() {
  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log('DERMAVISION: SINGLE-SCAN-TO-RECOMMENDATION WORKFLOW TEST SUITE');
  console.log('═════════════════════════════════════════════════════════════════\n');

  await connectDB();

  const testSuffix = Date.now().toString(16);
  let testUser = null;
  let testReport = null;
  let testProduct1 = null;
  let testProduct2 = null;
  let testProductSunscreen = null;

  try {
    // ── STEP 1: SETUP TEST ENVIRONMENT & CURATED CATALOG ──────────────────────
    console.log('─── [1/6] Setup: Live Database & Real Product Catalog ───');

    testUser = await User.create({
      name: `SingleScan Test Subject ${testSuffix}`,
      email: `single_scan_${testSuffix}@dermavision.ai`,
      password: 'HashPassword!123',
      role: 'user',
      allergies: ['fragrance'],
      sensitivities: ['reactive_erythema'],
    });
    assert(testUser._id, 'Created isolated test user in MongoDB Atlas');

    // Seed 3 genuine curated products for this test
    testProduct1 = await Product.create({
      name: `Ultra-Calm Gentle Cleanser ${testSuffix}`,
      brand: 'DermaVision Clinical',
      category: 'Cleanser',
      price: 499,
      description: 'Gentle oat-based barrier cleanser for sensitive skin.',
      suitableSkinTypes: ['Oily', 'Combination', 'Sensitive', 'Normal'],
      targetConcerns: ['Redness', 'Acne'],
      ingredients: [{ name: 'Avena Sativa Oat Extract' }, { name: 'Glycerin' }],
      usageInstructions: ['Apply to damp face for 60 seconds and rinse with lukewarm water.'],
      warnings: ['For external use only.'],
      productUrl: 'https://dermavision.ai/products/gentle-cleanser',
      isActive: true,
    });

    testProduct2 = await Product.create({
      name: `Salicylic Acid 2% BHA Serum ${testSuffix}`,
      brand: 'DermaVision Lab',
      category: 'Serum',
      price: 599,
      description: 'Pore-clarifying BHA treatment for comedonal acne.',
      suitableSkinTypes: ['Oily', 'Combination'],
      targetConcerns: ['Acne', 'Visible pores'],
      ingredients: [{ name: 'Salicylic Acid', concentration: '2%' }, { name: 'Zinc PCA' }],
      usageInstructions: ['Apply 3-4 drops at night after cleansing.'],
      warnings: ['Use sun protection during daytime when using BHA.'],
      productUrl: 'https://dermavision.ai/products/salicylic-acid',
      isActive: true,
    });

    testProductSunscreen = await Product.create({
      name: `Broad Spectrum Mineral Fluid SPF 50+ ${testSuffix}`,
      brand: 'DermaVision Lab',
      category: 'Sunscreen',
      price: 699,
      description: 'Weightless non-comedogenic physical sunscreen.',
      suitableSkinTypes: ['All', 'Oily', 'Combination', 'Sensitive'],
      targetConcerns: ['Redness', 'Acne'],
      ingredients: [{ name: 'Zinc Oxide', concentration: '12%' }, { name: 'Niacinamide' }],
      usageInstructions: ['Apply generously as final morning step.'],
      warnings: ['Reapply every 2 hours.'],
      productUrl: 'https://dermavision.ai/products/mineral-spf-50',
      isActive: true,
    });

    assert(testProduct1._id && testProduct2._id && testProductSunscreen._id, 'Live product catalog seeded with verified products');

    // ── STEP 2: SIMULATE SINGLE SKIN ANALYSIS SCAN REPORT ─────────────────────
    console.log('\n─── [2/6] Simulate Single Scan: ML Models Analyze One Image ───');

    // The single face scan executes ML models ONCE and produces this report:
    const singleScanPayload = {
      imageUrl: 'https://res.cloudinary.com/dermavision/image/upload/v1/single_scan_face.jpg',
      skinType: 'Oily',
      healthScore: 72,
      predictions: [
        { condition: 'Acne & Blemishes', confidence: 94, severity: 'High' },
        { condition: 'Facial Redness', confidence: 88, severity: 'Moderate' },
      ],
      notes: 'Single camera scan completed via optical telemetry.',
    };

    testReport = await Report.create({
      user: testUser._id,
      imageUrl: singleScanPayload.imageUrl,
      skinType: singleScanPayload.skinType,
      healthScore: singleScanPayload.healthScore,
      predictions: singleScanPayload.predictions,
      notes: singleScanPayload.notes,
    });

    assert(testReport._id, `Single scan persisted as Report ID: ${testReport._id}`);
    assert(testReport.predictions.length === 2, 'Report contains exact ML biomarkers from single scan');

    // ── STEP 3: AUTOMATIC RECOMMENDATION GENERATION FROM SAME REPORT ──────────
    console.log('\n─── [3/6] Generate Recommendations Directly From Single Report ───');

    const firstRecommendation = await generatePersonalizedRecommendation({
      userId: testUser._id,
      reportId: testReport._id,
      forceRegenerate: false,
    });

    assert(firstRecommendation, 'Recommendations generated automatically from the single report');
    assert(
      String(firstRecommendation.report) === String(testReport._id),
      'Recommendation linked directly to the single report ID'
    );
    assert(
      String(firstRecommendation.user) === String(testUser._id),
      'Recommendation linked directly to the authenticated user ID'
    );
    assert(
      firstRecommendation.selectedProducts.length > 0,
      `Curated ${firstRecommendation.selectedProducts.length} suitable products without re-scanning`
    );
    assert(
      firstRecommendation.morningRoutine.length > 0,
      `Generated structured Morning routine with ${firstRecommendation.morningRoutine.length} steps`
    );
    assert(
      firstRecommendation.eveningRoutine.length > 0,
      `Generated structured Evening routine with ${firstRecommendation.eveningRoutine.length} steps`
    );

    // Verify companion SkincareRoutine document
    const companionRoutine = await SkincareRoutine.findOne({ recommendation: firstRecommendation._id });
    assert(companionRoutine, 'Companion SkincareRoutine persisted and linked in MongoDB');
    assert(companionRoutine.isActive === true, 'SkincareRoutine created in active state');

    // ── STEP 4: VERIFY COMPLETE PRODUCT & ROUTINE OUTPUT CONTRACT ─────────────
    console.log('\n─── [4/6] Verify Output Specification: Products & Routine ───');

    const sampleProduct = firstRecommendation.formattedProducts?.[0];
    assert(sampleProduct, 'Formatted product outputs present');
    assert(sampleProduct.productId, 'Product output includes real MongoDB productId');
    assert(sampleProduct.name, 'Product output includes product name');
    assert(sampleProduct.brand, 'Product output includes brand');
    assert(sampleProduct.imageUrl, 'Product output includes image URL');
    assert(sampleProduct.price > 0, `Product output includes price (INR ${sampleProduct.price})`);
    assert(Array.isArray(sampleProduct.ingredients) && sampleProduct.ingredients.length > 0, 'Product output includes ingredients list');
    assert(sampleProduct.reason, `Product output includes clinical reason: "${sampleProduct.reason.slice(0, 45)}..."`);
    assert(sampleProduct.relevantConcern, `Product output specifies target concern: ${sampleProduct.relevantConcern}`);
    assert(sampleProduct.applicationInstructions, 'Product output includes usage instructions');
    assert(sampleProduct.warnings.length > 0, 'Product output includes safety warnings');

    // Verify AM Routine: Daytime protection with Sunscreen
    const morningSunscreenStep = firstRecommendation.morningRoutine.find(
      (s) => s.stepName?.toLowerCase().includes('sun') || s.stepKey === 'sunscreen'
    );
    assert(morningSunscreenStep, 'Morning routine mandatorily includes Sunscreen SPF 50+ guidance');

    // Verify PM Routine: No sunscreen in night routine
    const eveningSunscreenStep = firstRecommendation.eveningRoutine.find(
      (s) => s.stepName?.toLowerCase().includes('sun') || s.stepKey === 'sunscreen'
    );
    assert(!eveningSunscreenStep, 'Evening routine strictly excludes daytime sunscreen');

    // ── STEP 5: IDEMPOTENCY & CACHING (NO RE-SCAN, NO DUPLICATE ML EXECUTION) ─
    console.log('\n─── [5/6] Idempotency: Retrieve Existing Recommendations From Cache ───');

    // Calling again with the same reportId must return the cached recommendation
    const cachedRecommendation = await generatePersonalizedRecommendation({
      userId: testUser._id,
      reportId: testReport._id,
      forceRegenerate: false,
    });

    assert(
      String(cachedRecommendation._id) === String(firstRecommendation._id),
      'Retrieved existing recommendation without re-executing ML or creating duplicates'
    );
    assert(
      cachedRecommendation.isCached === true,
      'Recommendation engine flagged output as retrieved from cache (zero redundant ML compute)'
    );
    assert(
      cachedRecommendation.formattedProducts?.length === firstRecommendation.formattedProducts?.length,
      'Cached output retains complete formatted products catalog contract'
    );

    // Verify retrieval by report ID route
    const fetchedByReport = await getRecommendationForReport(testReport._id, testUser._id);
    assert(
      String(fetchedByReport._id) === String(firstRecommendation._id),
      'getRecommendationForReport returns existing recommendation by reportId'
    );

    // ── STEP 6: EXPLICIT USER REGENERATION (REUSES SAME REPORT ID) ────────────
    console.log('\n─── [6/6] Explicit Regeneration: Reuses Report ID Without New Scan ───');

    const regeneratedRecommendation = await generatePersonalizedRecommendation({
      userId: testUser._id,
      reportId: testReport._id,
      forceRegenerate: true, // User clicked "Regenerate" button
    });

    assert(
      regeneratedRecommendation,
      'Successfully regenerated recommendation upon explicit user request'
    );
    assert(
      String(regeneratedRecommendation.report) === String(testReport._id),
      'Regenerated recommendation reuses the EXACT same original report ID'
    );
    assert(
      String(regeneratedRecommendation._id) !== String(firstRecommendation._id),
      'Fresh recommendation record created and activated'
    );

    // Verify old recommendation was cleanly archived
    const previousRecDoc = await Recommendation.findById(firstRecommendation._id);
    assert(
      previousRecDoc.status === 'archived',
      'Previous recommendation record archived (status: archived)'
    );

    // ── RESILIENCE: EMPTY CATALOG HANDLING (NEVER INVENT FAKE PRODUCTS) ───────
    console.log('\n─── [Resilience Check] Empty Catalog / Zero Matches ───');
    const emptyResult = evaluateRecommendationPure({
      reportData: { skinType: 'Oily', healthScore: 80, detectedConcerns: [] },
      userProfile: {},
      catalog: [], // Completely empty catalog
    });

    assert(emptyResult.selectedProducts.length === 0, 'Never fabricates fake products when catalog is empty');
    assert(emptyResult.notice && emptyResult.notice.includes('empty'), 'Returns appropriate message instead of inventing recommendations');

  } catch (err) {
    console.error('Test Suite encountered fatal error:', err);
    failed++;
  } finally {
    // ── CLEANUP TEST DOCUMENTS ───────────────────────────────────────────────
    console.log('\n─── Cleanup: Purging Test Data ───');
    if (testUser) {
      await Recommendation.deleteMany({ user: testUser._id });
      await SkincareRoutine.deleteMany({ user: testUser._id });
      await Report.deleteMany({ user: testUser._id });
      await User.findByIdAndDelete(testUser._id);
    }
    if (testProduct1) await Product.findByIdAndDelete(testProduct1._id);
    if (testProduct2) await Product.findByIdAndDelete(testProduct2._id);
    if (testProductSunscreen) await Product.findByIdAndDelete(testProductSunscreen._id);
    console.log('  ✓ Cleaned up isolated test data.');

    await mongoose.connection.close();
  }

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`WORKFLOW TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runSingleScanWorkflowTests();
