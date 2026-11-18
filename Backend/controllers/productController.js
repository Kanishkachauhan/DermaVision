// Backend/controllers/productController.js
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Product from '../models/product.js';
import { uploadBufferToCloudinary, deleteCloudinaryImage } from '../config/cloudinary.js';

const PRODUCT_IMAGE_PLACEHOLDER = '/product-placeholder.svg';
const INTERLEAVED_BRAND_ORDER = ['The Derma Co.', 'Cetaphil', 'Dot & Key', 'Deconstruct'];

export const SUPPORTED_CATEGORIES = [
  'Cleanser',
  'Face Wash',
  'Moisturizer',
  'Serum',
  'Sunscreen',
  'Toner',
  'Eye care',
  'Exfoliator',
  'Face Mask',
  'Treatment',
];

export const SUPPORTED_CONCERNS = [
  'Acne',
  'Dark circles',
  'Visible pores',
  'Redness',
  'Dryness',
  'Uneven skin tone',
  'Sun protection',
  'Sensitive skin',
  'Excess oil',
  'Aging',
];

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

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
        const trimmed = ingredient.trim();
        return trimmed ? { name: trimmed, concentration: '' } : null;
      }
      if (!ingredient || typeof ingredient.name !== 'string') return null;
      const trimmedName = ingredient.name.trim();
      if (!trimmedName) return null;
      return {
        name: trimmedName,
        concentration:
          typeof ingredient.concentration === 'string'
            ? ingredient.concentration.trim()
            : '',
      };
    })
    .filter(Boolean);
};

const normalizeProductImageUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return PRODUCT_IMAGE_PLACEHOLDER;
  const imageUrl = value.trim();
  if (imageUrl === PRODUCT_IMAGE_PLACEHOLDER || imageUrl.startsWith('/')) return imageUrl;
  try {
    const parsedUrl = new URL(imageUrl);
    return ['http:', 'https:'].includes(parsedUrl.protocol)
      ? imageUrl
      : PRODUCT_IMAGE_PLACEHOLDER;
  } catch {
    return PRODUCT_IMAGE_PLACEHOLDER;
  }
};

/**
 * @desc    Get supported product categories
 * @route   GET /api/products/categories
 * @access  Public
 */
export const getCategories = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    categories: SUPPORTED_CATEGORIES,
  });
});

/**
 * @desc    Get supported skin concerns
 * @route   GET /api/products/concerns
 * @access  Public
 */
export const getConcerns = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    concerns: SUPPORTED_CONCERNS,
  });
});

/**
 * @desc    Get all products with filtering, search, and pagination
 * @route   GET /api/products
 * @access  Public (Admin can view inactive via ?includeInactive=true)
 */
export const getProducts = asyncHandler(async (req, res) => {
  const {
    brand,
    category,
    skinType,
    concern,
    search,
    includeInactive,
    page = 1,
    limit = 20,
    sort = 'recommended',
  } = req.query;

  const isAdmin = req.user && req.user.role === 'admin';
  const filter = {};

  // Inactive products are strictly excluded from public users
  if (isAdmin && includeInactive === 'true') {
    // Admin opted to view all statuses
  } else if (isAdmin && req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  } else {
    filter.isActive = true;
  }

  if (brand) {
    filter.brand = new RegExp(escapeRegex(normalizeText(brand)), 'i');
  }

  if (category && category !== 'All') {
    const normalizedCategory = normalizeText(category);
    const categoryAliases = {
      'Face Wash': ['Face Wash', 'FaceWash'],
      'Face Mask': ['Face Mask', 'FaceMask'],
      'Eye care': ['Eye care', 'Eye Care', 'EyeCare'],
      'Eye Care': ['Eye care', 'Eye Care', 'EyeCare'],
    };
    filter.category = { $in: categoryAliases[normalizedCategory] || [normalizedCategory] };
  }

  if (skinType && skinType !== 'All' && skinType !== 'All skin types') {
    const skinTypeFilter = new RegExp(`^${escapeRegex(normalizeText(skinType))}$`, 'i');
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ suitableSkinTypes: skinTypeFilter }, { skinTypes: skinTypeFilter }] },
    ];
  }

  if (concern && concern !== 'All' && concern !== 'All concerns') {
    const concernFilter = new RegExp(escapeRegex(normalizeText(concern)), 'i');
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ targetConcerns: concernFilter }, { targetConditions: concernFilter }, { description: concernFilter }] },
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
          { 'ingredients.name': searchFilter },
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

  // Sorting strategy
  let sortOption = { rating: -1, createdAt: -1, _id: 1 };
  if (sort === 'price_asc') sortOption = { price: 1, _id: 1 };
  else if (sort === 'price_desc') sortOption = { price: -1, _id: 1 };
  else if (sort === 'newest') sortOption = { createdAt: -1, _id: 1 };
  else if (sort === 'rating') sortOption = { rating: -1, _id: 1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parsedLimit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    total,
    page: parsedPage,
    totalPages: Math.ceil(total / parsedLimit),
    products,
  });
});

/**
 * @desc    Get single product by ID or Slug
 * @route   GET /api/products/:id
 * @access  Public
 */
export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user && req.user.role === 'admin';

  const filter = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id }
    : /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
    ? { slug: id }
    : null;

  if (!filter) {
    res.status(404);
    throw new Error('Product not found.');
  }

  if (!isAdmin) {
    filter.isActive = true;
  }

  const product = await Product.findOne(filter);
  if (!product) {
    res.status(404);
    throw new Error('Product not found or has been deactivated.');
  }

  res.json({ success: true, product });
});

/**
 * @desc    Create a new curated product
 * @route   POST /api/products
 * @access  Private/Admin
 */
export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    brand,
    category,
    description = '',
    price = null,
    currency = 'INR',
    ingredients = [],
    targetConcerns = [],
    suitableSkinTypes = [],
    benefits = [],
    usageInstructions = [],
    precautions = [],
    warnings = [],
    contraindications = [],
    productSize = '',
    availability = 'In Stock',
    officialSourceUrl = '',
    buyLink = '',
    imageUrl,
    imagePublicId = '',
    rating = 0,
    isActive = true,
  } = req.body;

  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('Product name is required.');
  }

  if (!brand || !brand.trim()) {
    res.status(400);
    throw new Error('Brand name is required.');
  }

  if (!category || !category.trim()) {
    res.status(400);
    throw new Error('Product category is required.');
  }

  const cleanName = name.trim();
  const cleanBrand = brand.trim();
  const cleanSlug = createProductSlug(cleanBrand, cleanName);

  // Check if product with identical slug already exists
  const existing = await Product.findOne({ slug: cleanSlug });
  if (existing) {
    res.status(409);
    throw new Error(`A product with the slug "${cleanSlug}" already exists in the catalog.`);
  }

  const normalizedIngredientsList = normalizeIngredients(ingredients);
  const normalizedImg = normalizeProductImageUrl(imageUrl);

  const product = new Product({
    name: cleanName,
    brand: cleanBrand,
    slug: cleanSlug,
    category: category.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    price: price != null && !isNaN(Number(price)) ? Math.max(0, Number(price)) : null,
    currency: currency || 'INR',
    ingredients: normalizedIngredientsList,
    targetConcerns: Array.isArray(targetConcerns) ? targetConcerns.map(normalizeText).filter(Boolean) : [],
    suitableSkinTypes: Array.isArray(suitableSkinTypes) ? suitableSkinTypes.map(normalizeText).filter(Boolean) : [],
    benefits: Array.isArray(benefits) ? benefits.map(normalizeText).filter(Boolean) : [],
    usageInstructions: Array.isArray(usageInstructions) ? usageInstructions.map(normalizeText).filter(Boolean) : [],
    precautions: Array.isArray(precautions) ? precautions.map(normalizeText).filter(Boolean) : [],
    warnings: Array.isArray(warnings) ? warnings.map(normalizeText).filter(Boolean) : [],
    contraindications: Array.isArray(contraindications) ? contraindications.map(normalizeText).filter(Boolean) : [],
    productSize: typeof productSize === 'string' ? productSize.trim() : '',
    availability: availability || 'In Stock',
    officialSourceUrl: officialSourceUrl || '',
    buyLink: buyLink || '',
    productUrl: buyLink || officialSourceUrl || '',
    imageUrl: normalizedImg,
    imagePublicId: imagePublicId || '',
    rating: Math.min(5, Math.max(0, Number(rating) || 0)),
    isActive: typeof isActive === 'boolean' ? isActive : true,
    lastVerifiedAt: new Date(),
  });

  await product.save();

  res.status(201).json({
    success: true,
    message: 'Product successfully added to the curated catalog.',
    product,
  });
});

/**
 * @desc    Update an existing product
 * @route   PUT /api/products/:id
 * @access  Private/Admin
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }

  const updates = { ...req.body };
  delete updates._id;

  if (updates.name || updates.brand) {
    const brand = updates.brand ? updates.brand.trim() : product.brand;
    const name = updates.name ? updates.name.trim() : product.name;
    updates.slug = createProductSlug(brand, name);
  }

  if (updates.ingredients) {
    updates.ingredients = normalizeIngredients(updates.ingredients);
  }

  if (updates.imageUrl) {
    // If the image is being replaced, clean up the old image
    if (product.imagePublicId && updates.imagePublicId && product.imagePublicId !== updates.imagePublicId) {
      await deleteCloudinaryImage(product.imagePublicId);
    }
    updates.imageUrl = normalizeProductImageUrl(updates.imageUrl);
  }

  if (updates.price !== undefined) {
    updates.price = updates.price != null && !isNaN(Number(updates.price)) ? Math.max(0, Number(updates.price)) : null;
  }

  if (updates.rating !== undefined) {
    updates.rating = Math.min(5, Math.max(0, Number(updates.rating) || 0));
  }

  if (updates.buyLink || updates.officialSourceUrl) {
    updates.productUrl = updates.buyLink || updates.officialSourceUrl || product.productUrl;
  }

  product.set(updates);
  product.lastVerifiedAt = new Date();
  await product.save();

  res.json({
    success: true,
    message: 'Product updated successfully.',
    product,
  });
});

/**
 * @desc    Upload product image to Cloudinary (or local storage fallback)
 * @route   POST /api/products/upload-image
 * @access  Private/Admin
 */
export const uploadProductImageAction = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    res.status(400);
    throw new Error('Image file is required (JPEG, PNG, or WebP).');
  }

  const result = await uploadBufferToCloudinary(req.file.buffer, {
    folder: 'dermavision/products',
  });

  // If a productId was provided in query or body, update the product directly
  const productId = req.body.productId || req.query.productId;
  if (productId && mongoose.Types.ObjectId.isValid(productId)) {
    const product = await Product.findById(productId);
    if (product) {
      if (product.imagePublicId && product.imagePublicId !== result.public_id) {
        await deleteCloudinaryImage(product.imagePublicId);
      }
      product.imageUrl = result.secure_url;
      product.imagePublicId = result.public_id;
      await product.save();
    }
  }

  res.status(200).json({
    success: true,
    message: 'Product image uploaded successfully.',
    imageUrl: result.secure_url,
    imagePublicId: result.public_id,
  });
});

/**
 * @desc    Toggle product active/inactive status
 * @route   PATCH /api/products/:id/status
 * @access  Private/Admin
 */
export const updateProductStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    res.status(400);
    throw new Error('isActive boolean is required.');
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { returnDocument: 'after', runValidators: true }
  );

  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }

  res.json({
    success: true,
    message: `Product successfully ${isActive ? 'activated' : 'deactivated'}.`,
    product,
  });
});

/**
 * @desc    Delete or deactivate a product
 * @route   DELETE /api/products/:id
 * @access  Private/Admin
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const { hard } = req.query;
  const isHardDelete = hard === 'true';

  if (isHardDelete) {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error('Product not found.');
    }
    if (product.imagePublicId) {
      await deleteCloudinaryImage(product.imagePublicId);
    }
    return res.json({
      success: true,
      message: 'Product permanently removed from database and media storage.',
    });
  }

  // Soft-delete / Deactivate by default
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { returnDocument: 'after' }
  );

  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }

  res.json({
    success: true,
    message: 'Product deactivated and excluded from recommendations and catalog.',
    product,
  });
});
