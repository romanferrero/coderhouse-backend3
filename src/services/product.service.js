import productRepository from '../repositories/product.repository.js';
import { PRODUCT_STATUS } from '../constants/index.js';
import AppError from '../utils/AppError.js';
import { pick } from '../utils/pick.js';
import { normalizePagination, buildPaginatedResult } from '../utils/pagination.js';

const CREATE_FIELDS = ['title', 'description', 'code', 'price', 'stock', 'category'];
const UPDATE_FIELDS = CREATE_FIELDS;
const REQUIRED_FIELDS = ['title', 'code', 'price', 'category'];
const LISTABLE_STATUSES = [PRODUCT_STATUS.AVAILABLE, PRODUCT_STATUS.OUT_OF_STOCK];

class ProductService {
  constructor(repository) {
    this.repository = repository;
  }

  // Regla de negocio: el estado de un producto se deriva de su stock.
  resolveStatus(stock) {
    return stock > 0 ? PRODUCT_STATUS.AVAILABLE : PRODUCT_STATUS.OUT_OF_STOCK;
  }

  validateNumbers({ price, stock }) {
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      throw AppError.badRequest('El precio debe ser un número mayor o igual a 0.');
    }
    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
      throw AppError.badRequest('El stock debe ser un número entero mayor o igual a 0.');
    }
  }

  // Por defecto el catálogo solo muestra productos con stock.
  // Se puede pedir explícitamente otro estado listable (ej. OUT_OF_STOCK).
  async getProducts({ page, limit, category, status } = {}) {
    const requestedStatus = status ? String(status).toUpperCase() : PRODUCT_STATUS.AVAILABLE;
    if (!LISTABLE_STATUSES.includes(requestedStatus)) {
      throw AppError.badRequest(`Estado inválido. Valores permitidos: ${LISTABLE_STATUSES.join(', ')}.`);
    }

    const filter = { status: requestedStatus };
    if (category) filter.category = String(category).toLowerCase();

    const pagination = normalizePagination({ page, limit });
    const { docs, total } = await this.repository.findAll({ filter, ...pagination });
    return buildPaginatedResult({ docs, total, ...pagination });
  }

  async getProductById(id) {
    const product = await this.repository.findById(id);
    if (!product) throw AppError.notFound(`Producto con id "${id}" no encontrado.`);
    return product;
  }

  async createProduct(payload) {
    const data = pick(payload, CREATE_FIELDS);

    const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined || data[field] === '');
    if (missing.length > 0) {
      throw AppError.badRequest(`Faltan campos obligatorios: ${missing.join(', ')}.`);
    }
    this.validateNumbers(data);

    if (await this.repository.existsByCode(data.code)) {
      throw AppError.conflict(`Ya existe un producto con el código "${data.code}".`);
    }

    data.stock = data.stock ?? 0;
    data.status = this.resolveStatus(data.stock);
    return this.repository.create(data);
  }

  async updateProduct(id, payload) {
    const data = pick(payload, UPDATE_FIELDS);
    if (Object.keys(data).length === 0) {
      throw AppError.badRequest(`No se enviaron campos para actualizar. Permitidos: ${UPDATE_FIELDS.join(', ')}.`);
    }
    this.validateNumbers(data);

    await this.getProductById(id);

    if (data.code && (await this.repository.existsByCode(data.code, id))) {
      throw AppError.conflict(`Ya existe un producto con el código "${data.code}".`);
    }

    if (data.stock !== undefined) data.status = this.resolveStatus(data.stock);
    return this.repository.updateById(id, data);
  }

  // Baja lógica: el producto pasa a DISCONTINUED y deja de listarse.
  async deleteProduct(id) {
    await this.getProductById(id);
    await this.repository.updateById(id, { status: PRODUCT_STATUS.DISCONTINUED });
  }
}

export default new ProductService(productRepository);
