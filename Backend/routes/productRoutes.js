// Backend/routes/productRoutes.js
import express from 'express';
import {
  getProducts,
  getProductById,
  getCategories,
  getConcerns,
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
  uploadProductImageAction,
} from '../controllers/productController.js';
import { protect, adminOnly, optionalAuth } from '../middleware/auth.js';
import uploadProductImage from '../middleware/upload.js';

const router = express.Router();

// ─── PUBLIC DISCOVERY ROUTES (WITH OPTIONAL ADMIN CONTEXT) ───────────────────
// GET /api/products/categories (lists all supported product categories)
router.get('/categories', getCategories);

// GET /api/products/concerns (lists all supported skin concerns)
router.get('/concerns', getConcerns);

// GET /api/products (browse catalog with filtering and pagination; admin can view inactive)
router.get('/', optionalAuth, getProducts);

// GET /api/products/:id (view specific product by ID or slug)
router.get('/:id', optionalAuth, getProductById);


// ─── ADMIN-ONLY PRODUCT MANAGEMENT ROUTES ───────────────────────────────────
// POST /api/products (curate and add a verified product)
router.post('/', protect, adminOnly, createProduct);

// POST /api/products/upload-image (upload product image to Cloudinary / storage)
router.post(
  '/upload-image',
  protect,
  adminOnly,
  uploadProductImage.single('image'),
  uploadProductImageAction
);

// PUT /api/products/:id (update product details, ingredients, concerns)
router.put('/:id', protect, adminOnly, updateProduct);

// POST /api/products/:id/image (upload and attach image to a specific product)
router.post(
  '/:id/image',
  protect,
  adminOnly,
  uploadProductImage.single('image'),
  (req, res, next) => {
    req.body.productId = req.params.id;
    uploadProductImageAction(req, res, next);
  }
);

// PATCH /api/products/:id/status (toggle active/inactive status)
router.patch('/:id/status', protect, adminOnly, updateProductStatus);

// DELETE /api/products/:id (deactivate or permanently remove product)
router.delete('/:id', protect, adminOnly, deleteProduct);

export default router;
