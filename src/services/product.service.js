import productRepository from '../repositories/product.repository.js';
import logger from '../logger/index.js';
import { PRODUCT_STATUS } from '../constants/index.js';
import {
  InvalidDataError,
  InvalidFieldTypeError,
  InvalidStatusError,
  MissingFieldsError,
  BlankFieldsError,
  NoFieldsToUpdateError,
  ProductNotFoundError,
  ProductCodeAlreadyExistsError,
} from '../errors/index.js';
import { pick } from '../utils/pick.js';
import { findBlankFields, findBlankProvidedFields, findNonStringFields } from '../utils/validation.js';
import { normalizePagination, buildPaginatedResult } from '../utils/pagination.js';

const CREATE_FIELDS = ['title', 'description', 'code', 'price', 'stock', 'category'];
const UPDATE_FIELDS = CREATE_FIELDS;
const REQUIRED_FIELDS = ['title', 'code', 'price', 'category'];
const TEXT_FIELDS = ['title', 'description', 'code', 'category'];
const LISTABLE_STATUSES = [PRODUCT_STATUS.AVAILABLE, PRODUCT_STATUS.OUT_OF_STOCK];

class ProductService {
  constructor(repository) {
    this.repository = repository;
  }

  // Regla de negocio: el estado de un producto se deriva de su stock.
  resolveStatus(stock) {
    return stock > 0 ? PRODUCT_STATUS.AVAILABLE : PRODUCT_STATUS.OUT_OF_STOCK;
  }

  // Los campos de texto tienen que llegar como string: un array u objeto no es un valor válido
  // y, sin este control, terminaría en un 500 o llegaría tal cual a las consultas de MongoDB.
  validateTextFields(data) {
    const invalid = findNonStringFields(data, TEXT_FIELDS);
    if (invalid.length > 0) throw new InvalidFieldTypeError(invalid);
  }

  validateNumbers({ price, stock }) {
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      throw new InvalidDataError('El precio debe ser un número mayor o igual a 0.', { field: 'price' });
    }
    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
      throw new InvalidDataError('El stock debe ser un número entero mayor o igual a 0.', { field: 'stock' });
    }
  }

  // Por defecto el catálogo solo muestra productos con stock.
  // Se puede pedir explícitamente otro estado listable (ej. OUT_OF_STOCK).
  async getProducts({ page, limit, category, status } = {}) {
    const requestedStatus = status ? String(status).toUpperCase() : PRODUCT_STATUS.AVAILABLE;
    if (!LISTABLE_STATUSES.includes(requestedStatus)) {
      throw new InvalidStatusError(status, LISTABLE_STATUSES);
    }

    const filter = { status: requestedStatus };
    if (category) filter.category = String(category).toLowerCase();

    const pagination = normalizePagination({ page, limit });
    const { docs, total } = await this.repository.findAll({ filter, ...pagination });
    return buildPaginatedResult({ docs, total, ...pagination });
  }

  async getProductById(id) {
    const product = await this.repository.findById(id);
    if (!product) throw new ProductNotFoundError(id);
    return product;
  }

  async createProduct(payload) {
    const data = pick(payload, CREATE_FIELDS);

    const missing = findBlankFields(data, REQUIRED_FIELDS);
    if (missing.length > 0) {
      throw new MissingFieldsError(missing);
    }
    this.validateTextFields(data);
    this.validateNumbers(data);

    if (await this.repository.existsByCode(data.code)) {
      throw new ProductCodeAlreadyExistsError(data.code);
    }

    data.stock = data.stock ?? 0;
    data.status = this.resolveStatus(data.stock);
    const product = await this.repository.create(data);
    logger.info(`Producto creado: ${product._id} (código ${product.code})`);
    return product;
  }

  async updateProduct(id, payload) {
    const data = pick(payload, UPDATE_FIELDS);
    if (Object.keys(data).length === 0) {
      throw new NoFieldsToUpdateError(UPDATE_FIELDS);
    }

    const blank = findBlankProvidedFields(data, REQUIRED_FIELDS);
    if (blank.length > 0) {
      throw new BlankFieldsError(blank);
    }
    this.validateTextFields(data);
    this.validateNumbers(data);

    await this.getProductById(id);

    if (data.code && (await this.repository.existsByCode(data.code, id))) {
      throw new ProductCodeAlreadyExistsError(data.code);
    }

    if (data.stock !== undefined) data.status = this.resolveStatus(data.stock);
    return this.repository.updateById(id, data);
  }

  // Baja lógica: el producto pasa a DISCONTINUED y deja de listarse.
  async deleteProduct(id) {
    await this.getProductById(id);
    await this.repository.updateById(id, { status: PRODUCT_STATUS.DISCONTINUED });
    logger.info(`Producto dado de baja: ${id}`);
  }
}

export default new ProductService(productRepository);
