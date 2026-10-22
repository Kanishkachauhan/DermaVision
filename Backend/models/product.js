// models/Product.js
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['Cleanser', 'Moisturizer', 'Serum', 'Sunscreen', 'FaceWash', 'Toner', 'Exfoliator', 'FaceMask'],
      required: true,
    },
    ingredients: { type: [String], default: [] },
    skinTypes: { type: [String], enum: ['Oily', 'Dry', 'Combination', 'Normal'], required: true },
    targetConditions: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    imageUrl: { type: String, default: '' },
    buyLink: { type: String, default: '' },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);
export default Product;