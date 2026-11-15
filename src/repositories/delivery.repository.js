import { isValidObjectId } from 'mongoose';
import { DeliveryModel } from '../models/delivery.model.js';

const ORDER_PROJECTION = 'code status priority total customer';
const COURIER_PROJECTION = 'first_name last_name email role';

const populateRelations = (query) =>
  query.populate('order', ORDER_PROJECTION).populate('courier', COURIER_PROJECTION);

class DeliveryRepository {
  async findAll({ filter = {}, page = 1, limit = 10, sort = { createdAt: -1 } } = {}) {
    const [docs, total] = await Promise.all([
      populateRelations(DeliveryModel.find(filter))
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DeliveryModel.countDocuments(filter),
    ]);
    return { docs, total };
  }

  async findById(id) {
    if (!isValidObjectId(id)) return null;
    return populateRelations(DeliveryModel.findById(id)).lean();
  }

  // Cada pedido tiene como máximo una entrega.
  async findByOrder(orderId) {
    return DeliveryModel.findOne({ order: orderId }).lean();
  }

  async updateById(id, data) {
    return DeliveryModel.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true }).lean();
  }

  // Agrega los metadatos de un comprobante. Devuelve la entrega actualizada, con pedido y repartidor.
  async addProof(id, proof) {
    if (!isValidObjectId(id)) return null;
    return populateRelations(
      DeliveryModel.findByIdAndUpdate(id, { $push: { proofs: proof } }, { returnDocument: 'after', runValidators: true })
    ).lean();
  }

  async createMany(deliveries) {
    const created = await DeliveryModel.insertMany(deliveries);
    return created.length;
  }

  // Metadatos de los comprobantes de las entregas que borraría deleteByOrdersOrCouriers.
  async findProofsByOrdersOrCouriers({ orderIds = [], courierIds = [] }) {
    const deliveries = await DeliveryModel.find(
      { $or: [{ order: { $in: orderIds } }, { courier: { $in: courierIds } }] },
      'proofs'
    ).lean();
    return deliveries.flatMap((delivery) => delivery.proofs ?? []);
  }

  async deleteByOrdersOrCouriers({ orderIds = [], courierIds = [] }) {
    const { deletedCount } = await DeliveryModel.deleteMany({
      $or: [{ order: { $in: orderIds } }, { courier: { $in: courierIds } }],
    });
    return deletedCount;
  }
}

export default new DeliveryRepository();
