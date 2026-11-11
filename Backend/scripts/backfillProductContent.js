import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/product.js';
import connectDB from '../config/db.js';
import {
  generateAiProductContent,
  hasCompleteAiProductContent,
} from '../utils/productContentGenerator.js';

dotenv.config();

const readLimit = () => {
  const argIndex = process.argv.findIndex((value) => value === '--limit' || value.startsWith('--limit='));
  if (argIndex < 0) return Infinity;
  const limitValue = process.argv[argIndex] === '--limit'
    ? process.argv[argIndex + 1]
    : process.argv[argIndex].slice('--limit='.length);
  const limit = Number(limitValue);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error('The --limit value must be a positive integer.');
  }
  return limit;
};

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

try {
  const limit = readLimit();
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured; set it in Backend/.env before backfilling product content.');
  }
  await connectDB();
  const products = await Product.find({ isActive: true }).sort({ brand: 1, name: 1 }).lean();
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (const product of products) {
    if (hasCompleteAiProductContent(product.aiGeneratedContent)) {
      skipped += 1;
      continue;
    }
    if (processed >= limit) break;
    processed += 1;

    try {
      const content = await generateAiProductContent(product);
      await Product.updateOne(
        { _id: product._id },
        { $set: { aiGeneratedContent: content } }
      );
      generated += 1;
      console.log(`[${processed}/${Math.min(products.length, limit)}] Generated guidance for ${product.brand} - ${product.name}.`);
    } catch (error) {
      failed += 1;
      console.error(`[Product content] Skipped ${product.brand} - ${product.name}: ${error.message}`);
      if (/API_KEY_INVALID|API_KEY_SERVICE_BLOCKED/.test(error.message)) break;
    }
    if (processed < limit && processed < products.length) await pause(1200);
  }

  console.log(
    `Product content backfill complete: generated ${generated}, skipped ${skipped}, failed ${failed}.`
  );
  if (failed) process.exitCode = 1;
} catch (error) {
  console.error('[Product content backfill] Failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
