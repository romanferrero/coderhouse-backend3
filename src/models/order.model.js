import { Schema, model } from 'mongoose';
import { ORDER_STATUS, ORDER_PRIORITY } from '../constants/index.js';

const orderItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const addressSchema = new Schema(
  {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    zipCode: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      validate: [(items) => items.length > 0, 'El pedido debe tener al menos un ítem.'],
    },
    total: { type: Number, required: true, min: 0 },
    shippingAddress: { type: addressSchema, required: true },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
    priority: {
      type: String,
      enum: Object.values(ORDER_PRIORITY),
      default: ORDER_PRIORITY.NORMAL,
    },
  },
  { timestamps: true, versionKey: false }
);

export const OrderModel = model('Order', orderSchema);
