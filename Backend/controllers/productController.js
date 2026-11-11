// controllers/productController.js
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Product from '../models/product.js';

const PRODUCT_IMAGE_PLACEHOLDER = '/product-placeholder.svg';
const INTERLEAVED_BRAND_ORDER = ['The Derma Co.', 'Cetaphil', 'Dot & Key', 'Deconstruct'];
const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeProductImageUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return PRODUCT_IMAGE_PLACEHOLDER;
  const imageUrl = value.trim();
  if (imageUrl === PRODUCT_IMAGE_PLACEHOLDER) return imageUrl;
  try {
    const parsedUrl = new URL(imageUrl);
    return ['http:', 'https:'].includes(parsedUrl.protocol)
      ? imageUrl
      : PRODUCT_IMAGE_PLACEHOLDER;
  } catch {
    return PRODUCT_IMAGE_PLACEHOLDER;
  }
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const createProductSlug = (brand, name) =>
  `${brand}-${name}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const normalizeIngredients = (ingredients) => {
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((ingredient) => {
      if (typeof ingredient === 'string') {
        return { name: ingredient.trim(), concentration: '' };
      }
      if (!ingredient || typeof ingredient.name !== 'string') return null;
      return {
        name: ingredient.name.trim(),
        concentration:
          typeof ingredient.concentration === 'string'
            ? ingredient.concentration.trim()
            : '',
      };
    })
    .filter((ingredient) => ingredient?.name);
};

export const getProducts = asyncHandler(async (req, res) => {
  const {
    brand,
    category,
    skinType,
    concern,
    search,
    page = 1,
    limit = 20,
  } = req.query;

  const filter = { isActive: true };

  if (brand) filter.brand = new RegExp(escapeRegex(normalizeText(brand)), 'i');
  if (category) {
    const normalizedCategory = normalizeText(category);
    const categoryAliases = {
      'Face Wash': ['Face Wash', 'FaceWash'],
      'Face Mask': ['Face Mask', 'FaceMask'],
    };
    filter.category = { $in: categoryAliases[normalizedCategory] || [normalizedCategory] };
  }
  if (skinType) {
    const skinTypeFilter = new RegExp(`^${escapeRegex(normalizeText(skinType))}$`, 'i');
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ suitableSkinTypes: skinTypeFilter }, { skinTypes: skinTypeFilter }] },
    ];
  }
  if (concern) {
    const concernFilter = new RegExp(escapeRegex(normalizeText(concern)), 'i');
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ targetConcerns: concernFilter }, { targetConditions: concernFilter }] },
    ];
  }

  if (search) {
    const searchFilter = new RegExp(escapeRegex(normalizeText(search)), 'i');
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { name: searchFilter },
          { brand: searchFilter },
          { description: searchFilter },
        ],
      },
    ];
  }

  const requestedPage = Number(page);
  const requestedLimit = Number(limit);
  const parsedPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const parsedLimit =
    Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 20;

  const skip = (parsedPage - 1) * parsedLimit;
  const [products, total] = await Promise.all([
    brand
      ? Product.find(filter)
        .sort({ rating: -1, createdAt: -1, _id: 1 })
        .skip(skip)
        .limit(parsedLimit)
      : Product.aggregate([
        { $match: filter },
        {
          $setWindowFields: {
            partitionBy: '$brand',
            sortBy: { _id: 1 },
            output: { brandRank: { $documentNumber: {} } },
          },
        },
        {
          $addFields: {
            brandOrder: {
              $switch: {
                branches: INTERLEAVED_BRAND_ORDER.map((brandName, index) => ({
                  case: { $eq: ['$brand', brandName] },
                  then: index,
                })),
                default: INTERLEAVED_BRAND_ORDER.length,
              },
            },
          },
        },
        { $sort: { brandRank: 1, brandOrder: 1, name: 1, _id: 1 } },
        { $skip: skip },
        { $limit: parsedLimit },
        { $project: { brandRank: 0, brandOrder: 0 } },
      ]),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    total,
    page: parsedPage,
    products,
  });
});

export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = mongoose.Types.ObjectId.isValid(id)
    ? await Product.findOne({ _id: id, isActive: true })
    : /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
      ? await Product.findOne({ slug: id, isActive: true })
      : null;
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.json({ success: true, product });
});

export const createProduct = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  delete payload._id;
  delete payload.contentSource;
  delete payload.aiGeneratedContent;
  payload.ingredients = normalizeIngredients(payload.ingredients);
  payload.imageUrl = normalizeProductImageUrl(payload.imageUrl);
  payload.slug = createProductSlug(payload.brand || '', payload.name || '');
  const product = await Product.create(payload);
  res.status(201).json({ success: true, product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const payload = { ...req.body };
  delete payload._id;
  delete payload.slug;
  delete payload.contentSource;
  delete payload.aiGeneratedContent;
  if (payload.ingredients) payload.ingredients = normalizeIngredients(payload.ingredients);
  if (Object.hasOwn(payload, 'imageUrl')) {
    payload.imageUrl = normalizeProductImageUrl(payload.imageUrl);
  }
  product.set(payload);
  const provenanceFields = {
    description: 'description',
    ingredients: 'ingredients',
    targetConcerns: 'targetConcerns',
    suitableSkinTypes: 'suitableSkinTypes',
    benefits: 'benefits',
    usageInstructions: 'usageInstructions',
    precautions: 'precautions',
  };
  for (const [payloadField, provenanceField] of Object.entries(provenanceFields)) {
    if (Object.hasOwn(payload, payloadField)) {
      product.contentSource[provenanceField] = 'catalog';
    }
  }
  if (payload.name || payload.brand) {
    product.slug = createProductSlug(product.brand, product.name);
  }
  await product.save();

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