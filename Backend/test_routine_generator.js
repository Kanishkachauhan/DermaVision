// Backend/test_routine_generator.js
/**
 * Comprehensive Test Suite for DermaVision Personalized Routine Generator
 *
 * Covers:
 * 1. Product Ordering (AM: Cleanse -> Treat -> Moisturize -> SPF 50+; PM: Cleanse -> Treat -> Moisturize)
 * 2. Missing Products handling (Graceful sequencing without gaps)
 * 3. Incompatible combinations (Retinoid + Peeling Acid separation and safety warnings)
 * 4. Validated waiting times extraction (Strict: 0 when not specified; extracts validated minutes)
 * 5. Schedule generation & Reminders (Draft review mode & user activation)
 * 6. Daily step completion tracking (Morning & Evening status, overall percentage)
 * 7. Product management (Pausing product, removing product with step re-sequencing)
 * 8. Live MongoDB Atlas persistence and relationship linking (User, Recommendation, Report)
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
  generateRoutinePure,
  extractValidatedWaitingTime,
  mapCategoryToStepKey,
  createRoutineFromRecommendation,
  activateRoutine,
  markRoutineStepCompleted,
  getTodayRoutineStatus,
  toggleProductPause,
  removeProductFromRoutine,
} from './services/routine/routineGeneratorService.js';

// ── Mock Curated Products for Pure Unit Tests ──
const MOCK_CLEANSER = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Gentle Barrier Hydrating Cleanser',
  brand: 'DermaVision Lab',
  category: 'Cleanser',
  price: 399,
  usageInstructions: ['Wash gently with lukewarm water for 60 seconds.'],
  warnings: ['Avoid contact with eyes.'],
  isActive: true,
};

const MOCK_AM_SERUM = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Niacinamide 10% + Zinc PCA Daytime Serum',
  brand: 'DermaVision Lab',
  category: 'Serum',
  price: 549,
  usageInstructions: ['Apply 3-4 drops directly across clean skin in the morning.'],
  warnings: ['Sunscreen is mandatory.'],
  isActive: true,
};

const MOCK_PM_RETINOL = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Retinol 0.3% Anti-Aging Night Serum',
  brand: 'DermaVision Lab',
  category: 'Serum',
  price: 699,
  usageInstructions: ['Apply pea-sized amount at night. Allow 2 minutes to absorb before cream.'],
  warnings: ['Do not combine with other peeling acids. Avoid sun exposure without SPF.'],
  isActive: true,
};

const MOCK_PM_ACID = {
  _id: new mongoose.Types.ObjectId(),
  name: 'AHA 10% + BHA 2% Peeling Solution',
  brand: 'Active Clinicals',
  category: 'Treatment',
  price: 599,
  usageInstructions: ['Apply evenly across clean face. Leave on for 10 minutes then rinse with cold water.'],
  warnings: ['Contains high-concentration Alpha Hydroxy Acid. Sunburn alert.'],
  isActive: true,
};

const MOCK_MOISTURIZER = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Ceramide Complex Barrier Cream',
  brand: 'DermaVision Lab',
  category: 'Moisturizer',
  price: 499,
  usageInstructions: ['Smooth over face and neck to lock in moisture.'],
  warnings: ['External use only.'],
  isActive: true,
};

const MOCK_SUNSCREEN = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Broad-Spectrum Mineral Sunscreen SPF 50+ PA++++',
  brand: 'DermaVision Lab',
  category: 'Sunscreen',
  price: 599,
  usageInstructions: ['Apply two finger-lengths generously as the final morning step 15 minutes prior to sun exposure.'],
  warnings: ['Reapply every 2 hours outdoors.'],
  isActive: true,
};

const MOCK_EYE_CREAM = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Caffeine 5% Under-Eye Peptide Gel',
  brand: 'DermaVision Lab',
  category: 'Eye care',
  price: 449,
  usageInstructions: ['Tap gently along the orbital bone morning and night.'],
  warnings: ['Do not apply directly into eyeballs.'],
  isActive: true,
};

async function runRoutineTestSuite() {
  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log('DERMAVISION: PERSONALIZED SKINCARE ROUTINE GENERATOR TEST SUITE');
  console.log('═════════════════════════════════════════════════════════════════\n');

  let passedAssertions = 0;
  const assert = (condition, message) => {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    passedAssertions++;
    console.log(`  ✓ ${message}`);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. UNIT TEST: Validated Waiting Times (Never Invent Fake Numbers)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('─── [1/8] Unit Test: Validated Waiting Time Extraction ───');
  {
    // Test explicit "leave on for 10 minutes"
    const wait10 = extractValidatedWaitingTime('Leave on for 10 minutes then rinse with water.');
    assert(wait10.minutes === 10, 'Extracted validated 10 minutes waiting time');

    // Test explicit "allow 2 minutes to absorb"
    const wait2 = extractValidatedWaitingTime('Allow 2 minutes to absorb before applying moisturizer.');
    assert(wait2.minutes === 2, 'Extracted validated 2 minutes waiting time');

    // Test generic instruction without waiting time
    const wait0 = extractValidatedWaitingTime('Massage gently onto skin and pat dry.');
    assert(wait0.minutes === 0, 'Did not invent waiting time when unspecified (0 minutes)');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. UNIT TEST: Correct Product Ordering (AM & PM Regimens)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [2/8] Unit Test: Product Ordering & Sequence Verification ───');
  {
    const selectedProducts = [
      { product: MOCK_SUNSCREEN, timeOfDay: 'morning' },
      { product: MOCK_MOISTURIZER, timeOfDay: 'both' },
      { product: MOCK_CLEANSER, timeOfDay: 'both' },
      { product: MOCK_AM_SERUM, timeOfDay: 'morning' },
      { product: MOCK_EYE_CREAM, timeOfDay: 'both' },
      { product: MOCK_PM_RETINOL, timeOfDay: 'evening' },
    ];

    const routine = generateRoutinePure({
      products: selectedProducts,
      diagnostics: { skinType: 'Combination', detectedConcerns: [{ concern: 'Dark circles' }] },
    });

    assert(routine.morningRoutine.length === 5, 'Morning routine contains 5 steps');
    assert(routine.eveningRoutine.length === 4, 'Evening routine contains 4 steps');

    // Verify Morning Chronological Order:
    // 1. Cleanse -> 2. Eye Care -> 3. Treat -> 4. Moisturize -> 5. Sunscreen
    assert(routine.morningRoutine[0].stepKey === 'cleanse', 'Morning step 1 is Cleanse');
    assert(routine.morningRoutine[1].stepKey === 'eye_care', 'Morning step 2 is Eye Care');
    assert(routine.morningRoutine[2].stepKey === 'treat', 'Morning step 3 is Treatment/Serum');
    assert(routine.morningRoutine[3].stepKey === 'moisturize', 'Morning step 4 is Moisturize');
    assert(routine.morningRoutine[4].stepKey === 'sunscreen', 'Morning step 5 (Final) is Sunscreen SPF 50+');

    // Verify Evening Chronological Order:
    // 1. Cleanse -> 2. Eye Care -> 3. Treat -> 4. Moisturize (No Sunscreen at night!)
    assert(routine.eveningRoutine[0].stepKey === 'cleanse', 'Evening step 1 is Cleanse');
    assert(routine.eveningRoutine[1].stepKey === 'eye_care', 'Evening step 2 is Eye Care');
    assert(routine.eveningRoutine[2].stepKey === 'treat', 'Evening step 3 is Active Night Treatment');
    assert(routine.eveningRoutine[3].stepKey === 'moisturize', 'Evening step 4 is Nocturnal Recovery');
    assert(!routine.eveningRoutine.some((s) => s.stepKey === 'sunscreen'), 'No sunscreen in evening routine');

    // Verify stepNumber and applicationOrder are strictly sequential (1, 2, 3...)
    routine.morningRoutine.forEach((s, idx) => {
      assert(s.stepNumber === idx + 1, `Morning step ${idx + 1} has sequential stepNumber`);
    });
    routine.eveningRoutine.forEach((s, idx) => {
      assert(s.stepNumber === idx + 1, `Evening step ${idx + 1} has sequential stepNumber`);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. UNIT TEST: Missing Products (Minimalist Routine Handling)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [3/8] Unit Test: Missing Products & Minimalist Sequencing ───');
  {
    // Minimalist: Only Cleanser and Moisturizer
    const minimalProducts = [
      { product: MOCK_CLEANSER, timeOfDay: 'both' },
      { product: MOCK_MOISTURIZER, timeOfDay: 'both' },
    ];

    const routine = generateRoutinePure({
      products: minimalProducts,
      diagnostics: { skinType: 'Dry' },
    });

    assert(routine.morningRoutine.length === 2, 'Generated 2-step minimalist morning routine');
    assert(routine.eveningRoutine.length === 2, 'Generated 2-step minimalist evening routine');
    assert(routine.morningRoutine[0].stepNumber === 1, 'Cleanse is step 1');
    assert(routine.morningRoutine[1].stepNumber === 2, 'Moisturize is step 2 (No numbering gaps)');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. UNIT TEST: Incompatible Active Combinations (Retinoids + Peeling Acids)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [4/8] Unit Test: Incompatible Active Collision Resolution ───');
  {
    const conflictingProducts = [
      { product: MOCK_CLEANSER, timeOfDay: 'both' },
      { product: MOCK_PM_RETINOL, timeOfDay: 'evening' },
      { product: MOCK_PM_ACID, timeOfDay: 'evening' }, // Concurrent strong peeling acid!
      { product: MOCK_MOISTURIZER, timeOfDay: 'both' },
    ];

    const routine = generateRoutinePure({
      products: conflictingProducts,
      diagnostics: { skinType: 'Oily' },
    });

    const eveningAcid = routine.eveningRoutine.find((s) => s.productName.includes('Peeling'));
    assert(eveningAcid !== undefined, 'Peeling acid included in evening candidate list');
    assert(
      eveningAcid.frequency.includes('Alternate nights'),
      'Frequency updated to alternate nights with Retinoid'
    );
    assert(
      eveningAcid.safetyWarnings.some((w) => w.includes('Avoid layering concurrently with retinoid')),
      'Incompatibility safety warning attached to prevent barrier irritation'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. UNIT TEST: Schedule Configuration & Draft Review Lifecycle
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [5/8] Unit Test: Schedule & Draft Review Workflow ───');
  {
    const routine = generateRoutinePure({
      products: [{ product: MOCK_CLEANSER, timeOfDay: 'both' }],
      scheduleConfig: {
        morningTime: '07:30',
        eveningTime: '21:30',
        remindersEnabled: true,
      },
    });

    assert(routine.status === 'draft', 'Generated routine initially in "draft" mode for user review');
    assert(routine.schedule.morningTime === '07:30', 'Preserved user morning schedule: 07:30');
    assert(routine.schedule.eveningTime === '21:30', 'Preserved user evening schedule: 21:30');
    assert(routine.schedule.remindersEnabled === true, 'Reminders enabled in schedule configuration');
    assert(routine.patchTestingGuidance.recommendedWaitHours === 24, 'Included 24-hour patch-testing protocol');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. INTEGRATION TEST: MongoDB Atlas Persistence & Activation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [6/8] Integration Test: MongoDB Persistence & Activation ───');
  await connectDB();
  console.log('  ✓ Connected to MongoDB Atlas');

  const testUser = await User.create({
    name: 'Routine Engine Subject',
    email: `routine_test_${Date.now()}@dermavision.ai`,
    password: 'Password123!',
    role: 'user',
    isVerified: true,
  });

  const testReport = await Report.create({
    user: testUser._id,
    imageUrl: '/test-scan.jpg',
    skinType: 'Combination',
    healthScore: 78,
    predictions: [{ condition: 'Acne & Blemishes', confidence: 91, severity: 'Moderate' }],
  });

  const realCleanser = (await Product.findOne({ category: { $in: ['Cleanser', 'Face Wash', 'FaceWash'] }, isActive: true })) || MOCK_CLEANSER;
  const realSunscreen = (await Product.findOne({ category: 'Sunscreen', isActive: true })) || MOCK_SUNSCREEN;

  const testRec = await Recommendation.create({
    user: testUser._id,
    report: testReport._id,
    selectedProducts: [
      {
        product: realCleanser._id,
        stepName: 'Cleanse',
        timeOfDay: 'both',
        primaryReason: 'Gentle Cleansing',
      },
      {
        product: realSunscreen._id,
        stepName: 'Sun Protection',
        timeOfDay: 'morning',
        primaryReason: 'UV Shield',
      },
    ],
    status: 'active',
  });

  // Create routine from recommendation
  const createdRoutine = await createRoutineFromRecommendation({
    recommendationId: testRec._id,
    userId: testUser._id,
    options: {
      schedule: { morningTime: '08:15', eveningTime: '22:00' },
    },
  });

  assert(createdRoutine._id !== undefined, 'SkincareRoutine saved with MongoDB ObjectId');
  assert(createdRoutine.status === 'draft', 'Saved in "draft" status awaiting user review');
  assert(String(createdRoutine.recommendation) === String(testRec._id), 'Linked directly to Recommendation ID');
  assert(String(createdRoutine.report) === String(testReport._id), 'Linked directly to Report ID');

  // Activate Routine
  const activated = await activateRoutine(createdRoutine._id, testUser._id);
  assert(activated.status === 'active', 'User reviewed and activated routine (status: active)');
  assert(activated.activatedAt !== null, 'Activated timestamp recorded');

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. INTEGRATION TEST: Daily Step Completion Tracking
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [7/8] Integration Test: Daily Routine Step Completion Tracking ───');
  {
    const today = new Date().toISOString().split('T')[0];
    const morningStepId = activated.morningRoutine[0]._id;

    const completion = await markRoutineStepCompleted({
      routineId: activated._id,
      userId: testUser._id,
      timeOfDay: 'morning',
      stepId: morningStepId,
      date: today,
    });

    assert(completion.success === true, 'Step marked as completed for today');
    assert(completion.completedStepsCount === 1, 'Completed steps count is 1');

    // Retrieve today's status
    const todayStatus = await getTodayRoutineStatus(activated._id, testUser._id, today);
    assert(todayStatus.date === today, 'Retrieved today status for current calendar date');
    assert(todayStatus.morning.completedCount === 1, 'Morning completed count matches');
    assert(todayStatus.morning.steps[0].isCompletedToday === true, 'Individual step flagged isCompletedToday: true');
    assert(todayStatus.overallPercent > 0, `Overall completion percentage calculated: ${todayStatus.overallPercent}%`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. INTEGRATION TEST: Product Pausing & Removal with Re-Sequencing
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── [8/8] Integration Test: Product Pausing & Removal Re-Sequencing ───');
  {
    const targetProduct = activated.morningRoutine[0].product;

    // Pause product
    const pausedRoutine = await toggleProductPause({
      routineId: activated._id,
      userId: testUser._id,
      productId: targetProduct,
      isPaused: true,
    });
    assert(pausedRoutine.morningRoutine[0].isPaused === true, 'Product successfully paused in routine');

    // Remove product and check step re-sequencing
    const originalCount = pausedRoutine.morningRoutine.length;
    const removedRoutine = await removeProductFromRoutine({
      routineId: activated._id,
      userId: testUser._id,
      productId: targetProduct,
    });
    assert(removedRoutine.morningRoutine.length === originalCount - 1, 'Product removed from routine');
    if (removedRoutine.morningRoutine.length > 0) {
      assert(removedRoutine.morningRoutine[0].stepNumber === 1, 'Remaining steps re-sequenced starting at step 1');
      assert(removedRoutine.morningRoutine[0].applicationOrder === 1, 'applicationOrder re-indexed to 1');
    }
  }

  // Clean up
  await SkincareRoutine.deleteMany({ user: testUser._id });
  await Recommendation.deleteMany({ user: testUser._id });
  await Report.findByIdAndDelete(testReport._id);
  await User.findByIdAndDelete(testUser._id);
  console.log('\n  ✓ Cleaned up test documents from database.');

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`ALL ${passedAssertions} ASSERTIONS PASSED! ROUTINE GENERATOR IS PRODUCTION READY.`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  await mongoose.connection.close();
  process.exit(0);
}

runRoutineTestSuite().catch((err) => {
  console.error('\n❌ Routine test suite failed with error:', err);
  process.exit(1);
});
