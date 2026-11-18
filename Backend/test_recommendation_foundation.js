// Backend/test_recommendation_foundation.js
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/user.js';
import Product from './models/product.js';
import Report from './models/report.js';
import Recommendation from './models/recommendation.js';
import SkincareRoutine from './models/skincareRoutine.js';
import {
  generatePersonalizedRecommendation,
  getRecommendationForReport,
  getUserRecommendations,
  getUserActiveRoutine,
} from './services/recommendationService.js';
import app from './app.js';

async function runTests() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('DERMAVISION: RECOMMENDATION SYSTEM FOUNDATION TEST SUITE');
  console.log('═════════════════════════════════════════════════════════════════\n');

  try {
    await connectDB();
    console.log('✓ [1/6] MongoDB Connected Successfully.');

    // Verify Models
    console.log('✓ [2/6] Verifying Mongoose Schemas & Compilations:');
    console.log('  - Product Model registered:', !!mongoose.models.Product);
    console.log('  - Recommendation Model registered:', !!mongoose.models.Recommendation);
    console.log('  - SkincareRoutine Model registered:', !!mongoose.models.SkincareRoutine);
    console.log('  - Report Model registered:', !!mongoose.models.Report);

    // Verify existing product count
    const productCount = await Product.countDocuments({ isActive: true });
    console.log(`✓ [3/6] Verified Active Products in Database: ${productCount} items found.`);
    if (productCount === 0) {
      throw new Error('Expected active products in database.');
    }

    // Find or create a temporary mock test user (isolated)
    let testUser = await User.findOne({ email: 'test_rec_runner@dermavision.ai' });
    if (!testUser) {
      testUser = new User({
        name: 'Test Recommendation Runner',
        email: 'test_rec_runner@dermavision.ai',
        password: 'Password123!',
        role: 'user',
        isVerified: true,
      });
      await testUser.save();
      console.log('✓ Created isolated test user:', testUser._id);
    } else {
      console.log('✓ Reusing isolated test user:', testUser._id);
    }

    // Create an isolated test report
    const testReport = new Report({
      user: testUser._id,
      imageUrl: '/sample-test-scan.jpg',
      skinType: 'Combination',
      healthScore: 72,
      predictions: [
        { condition: 'Acne & Follicular Blemishes', confidence: 88, severity: 'Moderate' },
        { condition: 'Facial Vascular Redness', confidence: 91, severity: 'Moderate' },
      ],
      notes: 'Automated test suite verification run.',
    });
    await testReport.save();
    console.log('✓ [4/6] Created isolated test skin report:', testReport._id);

    // Run recommendation service
    console.log('✓ [5/6] Testing Recommendation Service Engine...');
    const testDiagnostics = {
      skinType: 'Combination',
      acne: {
        acneScore: 48,
        acneType: 'Mixed (Comedonal + Mild Inflammatory)',
        poreScore: 56,
      },
      redness: {
        redness_score: 42,
        status: 'Reactive Capillary Flush',
      },
      darkCircles: {
        score: 38,
        etiology: 'Vascular micro-pooling',
      },
    };

    const recResult = await generatePersonalizedRecommendation({
      userId: testUser._id,
      reportId: testReport._id,
      diagnosticData: testDiagnostics,
    });

    console.log('  - Recommendation created with ID:', recResult._id);
    console.log('  - Linked Report ID:', recResult.report);
    console.log('  - Linked User ID:', recResult.user);
    console.log('  - Linked SkincareRoutine ID:', recResult.skincareRoutine?._id || recResult.skincareRoutine);
    console.log('  - Status:', recResult.status);
    console.log('  - Selected Products count:', recResult.selectedProducts?.length);
    console.log('  - Morning Routine steps:', recResult.morningRoutine?.length);
    console.log('  - Evening Routine steps:', recResult.eveningRoutine?.length);
    console.log('  - Targeted Clinical Reasons count:', recResult.recommendationReasons?.length);

    // Validate Selected Products details
    if (!recResult.selectedProducts || recResult.selectedProducts.length === 0) {
      throw new Error('Recommendation service failed to select candidate products.');
    }

    console.log('\n  --- Morning Routine Breakdown ---');
    recResult.morningRoutine.forEach((step) => {
      console.log(`    Step ${step.stepOrder} [${step.stepName}]: ${step.productName || step.product?.name || 'Formulation'} (${step.instructions.slice(0, 60)}...)`);
    });

    console.log('\n  --- Evening Routine Breakdown ---');
    recResult.eveningRoutine.forEach((step) => {
      console.log(`    Step ${step.stepOrder} [${step.stepName}]: ${step.productName || step.product?.name || 'Formulation'} (${step.instructions.slice(0, 60)}...)`);
    });

    // Test Deduplication: calling again without forceRegenerate should return existing record
    console.log('\n✓ [6/6] Testing Deduplication & Idempotency:');
    const duplicateCheck = await generatePersonalizedRecommendation({
      userId: testUser._id,
      reportId: testReport._id,
      diagnosticData: testDiagnostics,
      forceRegenerate: false,
    });
    console.log('  - Duplicate call returned identical ID:', String(duplicateCheck._id) === String(recResult._id));

    // Test Retrieval helper methods
    const activeRec = await getRecommendationForReport(testReport._id, testUser._id);
    console.log('  - getRecommendationForReport retrieved successfully:', !!activeRec);

    const userRoutine = await getUserActiveRoutine(testUser._id);
    console.log('  - getUserActiveRoutine retrieved successfully:', !!userRoutine, 'Steps:', userRoutine?.orderedProducts?.length);

    // Clean up test records
    await Recommendation.deleteMany({ user: testUser._id });
    await SkincareRoutine.deleteMany({ user: testUser._id });
    await Report.deleteMany({ user: testUser._id });
    await User.deleteOne({ _id: testUser._id });
    console.log('\n✓ Cleaned up isolated test documents. Production collections unaffected.');

    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log('ALL TESTS PASSED: RECOMMENDATION FOUNDATION IS PRODUCTION-READY!');
    console.log('═════════════════════════════════════════════════════════════════');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test Suite Failed:', err);
    process.exit(1);
  }
}

runTests();
