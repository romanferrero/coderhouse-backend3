import { isValidObjectId } from 'mongoose';
import { ProductModel } from '../models/product.model.js';
import { PRODUCT_STATUS } from '../constants/index.js';

// Los productos discontinuados se conservan en la base (baja lógica),
// pero nunca salen de este repositorio en las consultas normales.
const DEFAULT_FILTER = Object.freeze({ status: { $ne: PRODUCT_STATUS.DISCONTINUED } });

// Campos que se exponen hacia afuera: se ocultan los metadatos internos.
const PUBLIC_PROJECTION = 'title description code price stock category status';

class ProductRepository {
  async findAll({ filter = {}, page = 1, limit = 10, sort = { createdAt: -1 } } = {}) {
    const query = { ...DEFAULT_FILTER, ...filter };
    const [docs, total] = await Promise.all([
      ProductModel.find(query, PUBLIC_PROJECTION)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductModel.countDocuments(query),
    ]);
    return { docs, total };
  }

  async findById(id) {
    if (!isValidObjectId(id)) return null;
    return ProductModel.findOne({ _id: id, ...DEFAULT_FILTER }, PUBLIC_PROJECTION).lean();
  }

  // Incluye discontinuados: un código queda reservado aunque el producto se dé de baja.
  async existsByCode(code, excludeId = null) {
    const query = { code };
    if (excludeId) query._id = { $ne: excludeId };
    const found = await ProductModel.exists(query);
    return Boolean(found);
  }

  async create(data) {
    const created = await ProductModel.create(data);
    return this.findById(created._id);
  }

  async updateById(id, data) {
    if (!isValidObjectId(id)) return null;
    return ProductModel.findOneAndUpdate({ _id: id, ...DEFAULT_FILTER }, data, {
      returnDocument: 'after',
      runValidators: true,
      projection: PUBLIC_PROJECTION,
    }).lean();
  }
}

export default new ProductRepository();
