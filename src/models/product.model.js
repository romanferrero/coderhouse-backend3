import { Schema, model } from 'mongoose';
import { PRODUCT_STATUS } from '../constants/index.js';

const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    category: { type: String, required: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.AVAILABLE,
    },
  },
  { timestamps: true, versionKey: false }
);

// Índices para el catálogo (GET /api/products): siempre filtra por estado y ordena por fecha,
// y opcionalmente filtra por categoría.
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ category: 1, status: 1, createdAt: -1 });

export const ProductModel = model('Product', productSchema);
