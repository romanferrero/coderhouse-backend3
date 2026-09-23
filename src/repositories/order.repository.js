import { isValidObjectId } from 'mongoose';
import { OrderModel } from '../models/order.model.js';

// Del cliente solo se exponen datos de contacto, nunca el hash de la contraseña.
const CUSTOMER_PROJECTION = 'first_name last_name email role';

class OrderRepository {
  async findAll({ filter = {}, page = 1, limit = 10, sort = { createdAt: -1 } } = {}) {
    const [docs, total] = await Promise.all([
      OrderModel.find(filter)
        .populate('customer', CUSTOMER_PROJECTION)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      OrderModel.countDocuments(filter),
    ]);
    return { docs, total };
  }

  async findById(id) {
    if (!isValidObjectId(id)) return null;
    return OrderModel.findById(id).populate('customer', CUSTOMER_PROJECTION).lean();
  }

  async findIdsByCustomers(customerIds) {
    return OrderModel.distinct('_id', { customer: { $in: customerIds } });
  }

  // Inserción masiva: corre las validaciones del esquema y devuelve la cantidad insertada.
  async createMany(orders) {
    const created = await OrderModel.insertMany(orders);
    return created.length;
  }

  async deleteByIds(ids) {
    const { deletedCount } = await OrderModel.deleteMany({ _id: { $in: ids } });
    return deletedCount;
  }
}

export default new OrderRepository();
