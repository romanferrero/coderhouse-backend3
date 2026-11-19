import { Schema, model } from 'mongoose';
import { DELIVERY_STATUS, DELIVERY_STATUSES_WITH_COURIER, DELIVERY_PROOF_TYPES } from '../constants/index.js';
import { createDocumentSchema } from './document.schema.js';

const deliverySchema = new Schema(
  {
    // Cada pedido tiene como máximo una entrega.
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    courier: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      required: [
        function () {
          return DELIVERY_STATUSES_WITH_COURIER.includes(this.status);
        },
        'Una entrega asignada, en tránsito o entregada necesita un repartidor.',
      ],
    },
    trackingCode: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: Object.values(DELIVERY_STATUS),
      default: DELIVERY_STATUS.WAITING_COURIER,
    },
    estimatedAt: { type: Date, required: true },
    deliveredAt: { type: Date, default: null },
    // Metadatos de los comprobantes (foto, remito firmado). Los archivos están en uploads/deliveries/.
    proofs: { type: [createDocumentSchema(Object.values(DELIVERY_PROOF_TYPES))], default: [] },
  },
  { timestamps: true, versionKey: false }
);

// Índices para el listado (GET /api/deliveries, filtro por estado, orden por fecha) y para buscar
// las entregas de un repartidor.
deliverySchema.index({ createdAt: -1 });
deliverySchema.index({ status: 1, createdAt: -1 });
deliverySchema.index({ courier: 1 });

export const DeliveryModel = model('Delivery', deliverySchema);
