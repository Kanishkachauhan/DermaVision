// controllers/productController.js
import asyncHandler from 'express-async-handler';
import Product from '../models/product.js';

export const getProducts = asyncHandler(async (req, res) => {
  const { skinType, category, condition, page = 1, limit = 20 } = req.query;
  const filter = { isActive: true };
  if (skinType) filter.skinTypes = skinType;
  if (category) filter.category = category;
  if (condition) filter.targetConditions = condition;

  const products = await Product.find(filter).sort({ rating: -1 }).skip((page - 1) * limit).limit(Number(limit));
  const total = await Product.countDocuments(filter);
  res.json({ success: true, total, page: Number(page), products });
});

export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, product });
});

export const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, product });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, message: 'Product deactivated' });
});