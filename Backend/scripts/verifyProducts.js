import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/product.js';
import connectDB from '../config/db.js';

dotenv.config();

const PRODUCT_IMAGE_PLACEHOLDER = '/product-placeholder.svg';
const isUsableImageUrl = (imageUrl) => {
  if (imageUrl === PRODUCT_IMAGE_PLACEHOLDER) return true;
  try {
    const parsedUrl = new URL(imageUrl);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
};

try {
  await connectDB();
  const allProducts = await Product.find()
    .select('brand slug imageUrl seedSource isActive')
    .lean();
  const activeProducts = allProducts.filter((product) => product.isActive !== false);
  const byBrand = activeProducts.reduce((counts, product) => {
    counts[product.brand] = (counts[product.brand] || 0) + 1;
    return counts;
  }, {});
  const seededProducts = activeProducts.filter(
    (product) => product.seedSource === 'verified-brand-catalog'
  );
  const missingImages = allProducts.filter(
    (product) => !isUsableImageUrl(product.imageUrl)
  ).length;
  const placeholderImages = allProducts.filter(
    (product) => product.imageUrl === PRODUCT_IMAGE_PLACEHOLDER
  ).length;
  const duplicateSeedSlugs = seededProducts.length -
    new Set(seededProducts.map((product) => product.slug).filter(Boolean)).size;
  const biodermaProducts = allProducts.filter((product) =>
    /^\s*Bioderma\s*$/i.test(product.brand)
  ).length;
  const result = {
    totalProducts: allProducts.length,
    totalActiveProducts: activeProducts.length,
    productCountByBrand: byBrand,
    catalogProducts: seededProducts.length,
    missingImages,
    fallbackPlaceholderImages: placeholderImages,
    biodermaProductsRemaining: biodermaProducts,
    duplicateSeedSlugs,
  };
  console.log(JSON.stringify(result, null, 2));

  if (
    seededProducts.length < 50 ||
    missingImages > 0 ||
    biodermaProducts > 0 ||
    duplicateSeedSlugs > 0
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error('[Product verification] Failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
