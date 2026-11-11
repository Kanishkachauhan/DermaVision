import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { isDeepStrictEqual } from 'node:util';
import Product from '../models/product.js';
import catalogProducts from '../data/productsCatalog.js';
import connectDB from '../config/db.js';

dotenv.config();

const REQUIRED_BRANDS = ['The Derma Co.', 'Deconstruct', 'Cetaphil', 'Dot & Key'];
const PRODUCT_IMAGE_PLACEHOLDER = '/product-placeholder.svg';
const normalizeKey = (value) => value.trim().toLowerCase();
const normalizeComparableValue = (field, value) => {
  if (field === 'lastVerifiedAt' && value) {
    return new Date(value).toISOString().slice(0, 10);
  }
  return value ?? null;
};

const seedProducts = async () => {
  if (catalogProducts.length < 50) {
    throw new Error(`Catalog contains ${catalogProducts.length} products; at least 50 are required.`);
  }
  if (catalogProducts.some((product) => /^bioderma$/i.test(product.brand))) {
    throw new Error('The catalog must not contain Bioderma products.');
  }
  const catalogBrands = [...new Set(catalogProducts.map((product) => product.brand))];
  if (
    catalogBrands.length !== REQUIRED_BRANDS.length ||
    REQUIRED_BRANDS.some((brand) => !catalogBrands.includes(brand))
  ) {
    throw new Error(`Catalog brands must be exactly: ${REQUIRED_BRANDS.join(', ')}.`);
  }
  if (
    catalogProducts.some((product) => {
      if (product.imageUrl === PRODUCT_IMAGE_PLACEHOLDER) return false;
      try {
        return !['http:', 'https:'].includes(new URL(product.imageUrl).protocol);
      } catch {
        return true;
      }
    })
  ) {
    throw new Error('Every catalog product needs an HTTP image URL or the approved placeholder.');
  }

  const slugs = catalogProducts.map((product) => product.slug);
  if (new Set(slugs).size !== slugs.length) {
    throw new Error('Catalog contains duplicate product slugs.');
  }

  await connectDB();
  await Product.init();

  const brands = catalogBrands;
  const names = [...new Set(catalogProducts.map((product) => product.name))];
  const existingProducts = await Product.find({
    $or: [
      { slug: { $in: slugs } },
      { brand: { $in: brands }, name: { $in: names } },
    ],
  })
    .select(Object.keys(catalogProducts[0]).join(' '))
    .lean();

  const existingBySlug = new Map(existingProducts.filter((product) => product.slug).map((product) => [product.slug, product]));
  const existingByName = new Map(
    existingProducts.map((product) => [`${normalizeKey(product.brand)}:${normalizeKey(product.name)}`, product])
  );
  const operations = [];
  let skipped = 0;

  for (const product of catalogProducts) {
    const existing =
      existingBySlug.get(product.slug) ||
      existingByName.get(`${normalizeKey(product.brand)}:${normalizeKey(product.name)}`);

    if (existing && existing.seedSource !== 'verified-brand-catalog') {
      skipped += 1;
      continue;
    }

    if (existing) {
      const hasCatalogChanges = Object.keys(product).some(
        (field) =>
          !isDeepStrictEqual(
            normalizeComparableValue(field, existing[field]),
            normalizeComparableValue(field, product[field])
          )
      );
      if (!hasCatalogChanges) {
        skipped += 1;
        continue;
      }
      operations.push({
        updateOne: {
          filter: { _id: existing._id },
          update: { $set: product },
        },
      });
      continue;
    }

    operations.push({
      updateOne: {
        filter: { slug: product.slug },
        update: { $setOnInsert: product },
        upsert: true,
      },
    });
  }

  const result = operations.length
    ? await Product.bulkWrite(operations, { ordered: true })
    : { upsertedCount: 0, modifiedCount: 0, matchedCount: 0 };

  const inserted = result.upsertedCount || 0;
  const updated = result.modifiedCount || 0;
  const unchanged = Math.max(0, (result.matchedCount || 0) - updated);
  const brandCounts = Object.fromEntries(
    brands.map((brand) => [brand, catalogProducts.filter((product) => product.brand === brand).length])
  );

  console.log(`Product seed complete: inserted ${inserted}, updated ${updated}, skipped ${skipped + unchanged}.`);
  console.log(`Catalog records verified by official listings: ${catalogProducts.length}.`);
  console.log(`Catalog distribution: ${Object.entries(brandCounts).map(([brand, count]) => `${brand} ${count}`).join(', ')}.`);
};

try {
  await seedProducts();
} catch (error) {
  console.error('[Seed products] Failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
