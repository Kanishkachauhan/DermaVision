import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/product.js';
import connectDB from '../config/db.js';

dotenv.config();

try {
  await connectDB();
  const result = await Product.deleteMany({ brand: /^\s*Bioderma\s*$/i });
  console.log(`Removed ${result.deletedCount} product(s) whose brand field is Bioderma.`);
} catch (error) {
  console.error('[Bioderma cleanup] Failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
