// models/Product.js
import mongoose from 'mongoose';

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    concentration: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const aiGeneratedContentSchema = new mongoose.Schema(
  {
    version: { type: Number, default: 1 },
    contentSource: { type: String, enum: ['ai-generated-guidance'], default: 'ai-generated-guidance' },
    generatedAt: { type: Date, default: null },
    model: { type: String, default: '' },
    description: { type: String, default: '' },
    skinGoals: {
      targetConcerns: { type: [String], default: [] },
      suitableSkinTypes: { type: [String], default: [] },
      benefits: { type: [String], default: [] },
    },
    howToUse: {
      instructions: { type: [String], default: [] },
      timeOfUse: { type: String, default: 'Follow the product label for timing' },
      precautions: { type: [String], default: [] },
    },
    ingredientFunctions: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, required: true },
            function: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const contentProvenanceSchema = new mongoose.Schema(
  {
    description: { type: String, enum: ['manufacturer', 'catalog'], default: 'catalog' },
    ingredients: { type: String, enum: ['manufacturer', 'catalog'], default: 'catalog' },
    targetConcerns: { type: String, enum: ['manufacturer', 'catalog'], default: 'catalog' },
    suitableSkinTypes: { type: String, enum: ['manufacturer', 'catalog'], default: 'catalog' },
    benefits: { type: String, enum: ['manufacturer', 'catalog'], default: 'catalog' },
    usageInstructions: { type: String, enum: ['manufacturer', 'catalog'], default: 'catalog' },
    precautions: { type: String, enum: ['manufacturer', 'catalog'], default: 'catalog' },
  },
  { _id: false }
);

const slugify = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    slug: { type: String, trim: true },
    category: {
      type: String,
      enum: [
        'Cleanser',
        'Face Wash',
        'FaceWash',
        'Moisturizer',
        'Serum',
        'Sunscreen',
        'Toner',
        'Exfoliator',
        'Face Mask',
        'FaceMask',
        'Treatment',
      ],
      default: 'Treatment',
      required: true,
    },
    description: { type: String, default: '' },
    contentSource: { type: contentProvenanceSchema, default: () => ({}) },
    aiGeneratedContent: { type: aiGeneratedContentSchema, default: null },
    imageUrl: { type: String, default: '/product-placeholder.svg' },
    price: { type: Number, default: null, min: 0 },
    currency: { type: String, default: 'INR' },
    ingredients: { type: [ingredientSchema], default: [] },
    targetConcerns: { type: [String], default: [] },
    suitableSkinTypes: { type: [String], default: [] },
    benefits: { type: [String], default: [] },
    usageInstructions: { type: [String], default: [] },
    precautions: { type: [String], default: [] },
    productSize: { type: String, default: '' },
    availability: { type: String, default: 'Information not available' },
    officialSourceUrl: { type: String, default: '' },
    buyLink: { type: String, default: '' },
    lastVerifiedAt: { type: Date, default: null },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    isActive: { type: Boolean, default: true },
    skinTypes: { type: [String], default: [] },
    seedSource: { type: String, default: '' },
  },
  { timestamps: true }
);

productSchema.index({ brand: 1, category: 1, isActive: 1 });
productSchema.index({ name: 'text', brand: 'text', description: 'text' });
productSchema.index({ slug: 1 }, { unique: true, sparse: true });

productSchema.pre('validate', function setCanonicalSlug() {
  if (!this.slug && this.brand && this.name) {
    this.slug = slugify(`${this.brand}-${this.name}`);
  }
});

const Product = mongoose.model('Product', productSchema);
export default Product;