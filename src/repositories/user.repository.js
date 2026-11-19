import { isValidObjectId } from 'mongoose';
import { UserModel } from '../models/user.model.js';

// El hash de la contraseña nunca sale del repositorio salvo que se pida explícitamente.
const PUBLIC_PROJECTION = 'first_name last_name email age role documents createdAt';
// En el listado no van los documentos: crecen con cada carga y se consultan por usuario
// (GET /api/users/:uid/documents). Así cada página pesa lo mismo tenga cada usuario 0 o 10 documentos.
const LIST_PROJECTION = 'first_name last_name email age role createdAt';

class UserRepository {
  async findAll({ filter = {}, page = 1, limit = 10, sort = { createdAt: -1 } } = {}) {
    const [docs, total] = await Promise.all([
      UserModel.find(filter, LIST_PROJECTION)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);
    return { docs, total };
  }

  async findById(id) {
    if (!isValidObjectId(id)) return null;
    return UserModel.findById(id, PUBLIC_PROJECTION).lean();
  }

  // Pensado para autenticación: permite traer el hash cuando se necesite comparar.
  async findByEmail(email, { includePassword = false } = {}) {
    const projection = includePassword ? `${PUBLIC_PROJECTION} password` : PUBLIC_PROJECTION;
    return UserModel.findOne({ email: email.toLowerCase() }, projection).lean();
  }

  async existsByEmail(email, excludeId = null) {
    const query = { email: email.toLowerCase() };
    if (excludeId) query._id = { $ne: excludeId };
    const found = await UserModel.exists(query);
    return Boolean(found);
  }

  async countByRole(role) {
    return UserModel.countDocuments({ role });
  }

  async findIdsByEmailDomain(domain, { role } = {}) {
    const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = { email: new RegExp(`@${escaped}$`) };
    if (role) filter.role = role;
    return UserModel.distinct('_id', filter);
  }

  async create(data) {
    const created = await UserModel.create(data);
    return this.findById(created._id);
  }

  // Inserción masiva: corre las validaciones del esquema y devuelve la cantidad insertada.
  async createMany(users) {
    const created = await UserModel.insertMany(users);
    return created.length;
  }

  // Metadatos de los documentos de varios usuarios (para borrar sus archivos junto con ellos).
  async findDocumentsByIds(ids) {
    const users = await UserModel.find({ _id: { $in: ids } }, 'documents').lean();
    return users.flatMap((user) => user.documents ?? []);
  }

  async deleteByIds(ids) {
    const { deletedCount } = await UserModel.deleteMany({ _id: { $in: ids } });
    return deletedCount;
  }

  async updateById(id, data) {
    if (!isValidObjectId(id)) return null;
    return UserModel.findByIdAndUpdate(id, data, {
      returnDocument: 'after',
      runValidators: true,
      projection: PUBLIC_PROJECTION,
    }).lean();
  }

  // Agrega los metadatos de un documento subido. Devuelve el usuario actualizado.
  async addDocument(id, document) {
    if (!isValidObjectId(id)) return null;
    return UserModel.findByIdAndUpdate(
      id,
      { $push: { documents: document } },
      { returnDocument: 'after', runValidators: true, projection: PUBLIC_PROJECTION }
    ).lean();
  }

  async deleteById(id) {
    if (!isValidObjectId(id)) return null;
    return UserModel.findByIdAndDelete(id, { projection: PUBLIC_PROJECTION }).lean();
  }
}

export default new UserRepository();
