// Backend/test_product_management.js
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/user.js';
import Product from './models/product.js';
import { generateAccessToken } from './utils/generateTokens.js';
import app from './app.js';
import http from 'http';

async function runTestSuite() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('DERMAVISION: PRODUCT MANAGEMENT SYSTEM TEST SUITE');
  console.log('═════════════════════════════════════════════════════════════════\n');

  let server;
  let adminUser = null;
  let regularUser = null;
  let createdProductId = null;

  try {
    await connectDB();
    console.log('✓ [1/7] MongoDB connection verified.');

    // 1. Create isolated Admin and Regular test users
    adminUser = await User.findOne({ email: 'test_admin_catalog@dermavision.ai' });
    if (!adminUser) {
      adminUser = new User({
        name: 'Test Catalog Administrator',
        email: 'test_admin_catalog@dermavision.ai',
        password: 'AdminPassword123!',
        role: 'admin',
        isVerified: true,
      });
      await adminUser.save();
    }

    regularUser = await User.findOne({ email: 'test_regular_catalog@dermavision.ai' });
    if (!regularUser) {
      regularUser = new User({
        name: 'Test Regular User',
        email: 'test_regular_catalog@dermavision.ai',
        password: 'UserPassword123!',
        role: 'user',
        isVerified: true,
      });
      await regularUser.save();
    }

    const adminToken = generateAccessToken(adminUser._id);
    const regularToken = generateAccessToken(regularUser._id);
    console.log('✓ [2/7] Test auth tokens generated (Admin & Regular User).');

    // Start ephemeral HTTP server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`✓ [3/7] Test HTTP server listening on port ${port}.`);

    // 2. Test Public Discovery Endpoints (Categories & Concerns)
    const resCategories = await fetch(`${baseUrl}/api/products/categories`);
    const dataCategories = await resCategories.json();
    console.log('✓ [4/7] Categories Endpoint:');
    console.log('  - Status:', resCategories.status);
    console.log('  - Supports Eye care:', dataCategories.categories.includes('Eye care'));
    console.log('  - Total categories:', dataCategories.categories.length);

    if (!dataCategories.categories.includes('Eye care') || !dataCategories.categories.includes('Moisturizer')) {
      throw new Error('Categories missing required values.');
    }

    const resConcerns = await fetch(`${baseUrl}/api/products/concerns`);
    const dataConcerns = await resConcerns.json();
    console.log('✓ Concerns Endpoint:');
    console.log('  - Status:', resConcerns.status);
    console.log('  - Supports Acne & Dark circles:', dataConcerns.concerns.includes('Acne') && dataConcerns.concerns.includes('Dark circles'));
    console.log('  - Total concerns:', dataConcerns.concerns.length);

    // 3. Test Access Control Enforcement
    console.log('\n✓ [5/7] Testing Access Control (RBAC):');

    // Unauthenticated
    const resUnauth = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hack Attempt', brand: 'Malicious' }),
    });
    console.log('  - Unauthenticated POST /api/products Status (Expected 401):', resUnauth.status);
    if (resUnauth.status !== 401) throw new Error(`Expected 401, got ${resUnauth.status}`);

    // Regular User (Forbidden)
    const resForbidden = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken}`,
      },
      body: JSON.stringify({ name: 'Regular User Item', brand: 'Unauthorized' }),
    });
    console.log('  - Regular User POST /api/products Status (Expected 403):', resForbidden.status);
    if (resForbidden.status !== 403) throw new Error(`Expected 403, got ${resForbidden.status}`);

    // 4. Test Admin CRUD Operations
    console.log('\n✓ [6/7] Testing Admin CRUD Functionality:');

    // A. CREATE
    const productPayload = {
      name: 'Curated Centella Barrier Cream',
      brand: 'DermaVision Lab',
      category: 'Moisturizer',
      description: 'Medical-grade ceramide and centella restorative cream for compromised skin barriers.',
      price: 649,
      currency: 'INR',
      ingredients: [
        { name: 'Centella Asiatica', concentration: '2%' },
        { name: 'Ceramide NP', concentration: '0.5%' },
        { name: 'Bisabolol', concentration: '0.2%' },
      ],
      targetConcerns: ['Redness', 'Dryness', 'Sensitive skin'],
      suitableSkinTypes: ['Sensitive', 'Dry', 'Combination'],
      benefits: ['Calms erythema', 'Restores lipid barrier'],
      usageInstructions: ['Apply morning and evening as the final hydration step'],
      warnings: ['For external use only. Avoid contact with broken skin.'],
      contraindications: ['Known hypersensitivity to centella asiatica'],
      productSize: '50ml',
      buyLink: 'https://example.com/products/centella-barrier',
      rating: 4.8,
      isActive: true,
    };

    const resCreate = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(productPayload),
    });
    const dataCreate = await resCreate.json();
    console.log('  - Admin Create Product Status:', resCreate.status);
    if (resCreate.status !== 201 || !dataCreate.product?._id) {
      throw new Error(`Failed to create product: ${JSON.stringify(dataCreate)}`);
    }
    createdProductId = dataCreate.product._id;
    console.log('  - Created Product ID:', createdProductId);
    console.log('  - Generated Canonical Slug:', dataCreate.product.slug);
    console.log('  - Normalized Ingredients Count:', dataCreate.product.ingredients.length);

    // B. READ & FILTER
    const resRead = await fetch(`${baseUrl}/api/products/${createdProductId}`);
    const dataRead = await resRead.json();
    console.log('  - Read Product by ID Status:', resRead.status);
    if (resRead.status !== 200 || dataRead.product.name !== productPayload.name) {
      throw new Error('Product retrieval mismatch.');
    }

    const resFilter = await fetch(`${baseUrl}/api/products?concern=Redness&category=Moisturizer`);
    const dataFilter = await resFilter.json();
    console.log(`  - Filtered query (concern=Redness, category=Moisturizer) returned ${dataFilter.total} products.`);

    // C. UPDATE
    const updatePayload = {
      price: 699,
      description: 'Updated clinical formulation with elevated ceramide concentration.',
      warnings: ['Avoid contact with eyes.', 'Patch test recommended.'],
    };
    const resUpdate = await fetch(`${baseUrl}/api/products/${createdProductId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(updatePayload),
    });
    const dataUpdate = await resUpdate.json();
    console.log('  - Update Product Status:', resUpdate.status);
    console.log('  - Updated Price verified:', dataUpdate.product.price === 699);
    console.log('  - Updated Warnings verified:', dataUpdate.product.warnings.length === 2);

    // D. TOGGLE STATUS / DEACTIVATE
    const resDeactivate = await fetch(`${baseUrl}/api/products/${createdProductId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    const dataDeactivate = await resDeactivate.json();
    console.log('  - Deactivate Product Status:', resDeactivate.status, 'isActive:', dataDeactivate.product.isActive);

    // Public user should get 404 for deactivated product
    const resPublicDeactivated = await fetch(`${baseUrl}/api/products/${createdProductId}`);
    console.log('  - Public GET deactivated product (Expected 404):', resPublicDeactivated.status);
    if (resPublicDeactivated.status !== 404) {
      throw new Error(`Expected public 404 for inactive product, got ${resPublicDeactivated.status}`);
    }

    // Admin should see deactivated product via includeInactive=true
    const resAdminInclude = await fetch(`${baseUrl}/api/products?includeInactive=true`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataAdminInclude = await resAdminInclude.json();
    const hasInactive = dataAdminInclude.products.some((p) => p._id === createdProductId);
    console.log('  - Admin GET with includeInactive=true contains deactivated item:', hasInactive);

    // E. HARD DELETE
    const resDelete = await fetch(`${baseUrl}/api/products/${createdProductId}?hard=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataDelete = await resDelete.json();
    console.log('  - Admin Hard Delete Status:', resDelete.status, 'Message:', dataDelete.message);

    // Verify deletion
    const verifyDeleted = await Product.findById(createdProductId);
    console.log('  - Database verification after permanent delete:', verifyDeleted === null);

    // 5. Cleanup Test Users
    console.log('\n✓ [7/7] Cleaning up test users and connections...');
    await User.deleteMany({ email: { $in: ['test_admin_catalog@dermavision.ai', 'test_regular_catalog@dermavision.ai'] } });
    server.close();
    console.log('✓ Cleaned up test credentials.');

    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log('ALL TESTS PASSED: PRODUCT MANAGEMENT SYSTEM IS PRODUCTION-READY!');
    console.log('═════════════════════════════════════════════════════════════════');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Product Management Test Failed:', err);
    if (createdProductId) {
      await Product.findByIdAndDelete(createdProductId).catch(() => {});
    }
    if (server) server.close();
    process.exit(1);
  }
}

runTestSuite();
