import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/product.js';
import connectDB from '../config/db.js';

dotenv.config();

const PRODUCT_IMAGE_PLACEHOLDER = '/product-placeholder.svg';
const MAX_CONCURRENT_CHECKS = 6;
const isPlaceholder = (imageUrl) => imageUrl === PRODUCT_IMAGE_PLACEHOLDER;

const isAccessibleImage = async (imageUrl) => {
  if (isPlaceholder(imageUrl)) return true;

  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false;

  try {
    let response = await fetch(imageUrl, {
      method: 'HEAD',
      headers: { 'user-agent': 'DermaVision product image validation' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
      response = await fetch(imageUrl, {
        headers: {
          range: 'bytes=0-0',
          'user-agent': 'DermaVision product image validation',
        },
        signal: AbortSignal.timeout(15000),
      });
    }
    const isImage = response.ok && response.headers.get('content-type')?.startsWith('image/');
    await response.body?.cancel();
    return Boolean(isImage);
  } catch {
    return false;
  }
};

try {
  await connectDB();
  const products = await Product.find().select('_id name brand imageUrl').lean();
  let repaired = 0;
  let checked = 0;
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_CHECKS, products.length) },
    async () => {
      while (nextIndex < products.length) {
        const product = products[nextIndex];
        nextIndex += 1;
        checked += 1;

        if (await isAccessibleImage(product.imageUrl)) continue;

        await Product.updateOne(
          { _id: product._id },
          { $set: { imageUrl: PRODUCT_IMAGE_PLACEHOLDER } }
        );
        repaired += 1;
        console.log(`Using placeholder for ${product.brand} - ${product.name}.`);
      }
    }
  );

  await Promise.all(workers);
  console.log(`Image check complete: checked ${checked}, repaired ${repaired}.`);
} catch (error) {
  console.error('[Product image repair] Failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
