import { randomInt } from 'node:crypto';
import orderRepository from '../repositories/order.repository.js';
import userRepository from '../repositories/user.repository.js';
import deliveryRepository from '../repositories/delivery.repository.js';
import logger from '../logger/index.js';
import {
  ORDER_STATUS,
  ORDER_PRIORITY,
  ORDER_STATUS_TRANSITIONS,
  USER_ROLES,
  DELIVERY_STATUS_BY_ORDER_STATUS,
  DELIVERY_STATUSES_WITH_COURIER,
} from '../constants/index.js';
import {
  InvalidDataError,
  InvalidFieldTypeError,
  InvalidStatusError,
  InvalidPriorityError,
  MissingFieldsError,
  OrderNotFoundError,
  OrderStatusTransitionError,
  OrderCourierRequiredError,
  UserNotFoundError,
} from '../errors/index.js';
import { pick } from '../utils/pick.js';
import { findBlankFields, findNonStringFields } from '../utils/validation.js';
import { normalizePagination, buildPaginatedResult } from '../utils/pagination.js';

const VALID_STATUSES = Object.values(ORDER_STATUS);
const VALID_PRIORITIES = Object.values(ORDER_PRIORITY);

const CREATE_FIELDS = ['customer', 'items', 'shippingAddress', 'priority'];
const REQUIRED_FIELDS = ['customer', 'items', 'shippingAddress'];
const ADDRESS_FIELDS = ['street', 'city', 'zipCode'];

// Código legible del pedido con el mismo formato que los mocks: ORD-7KQ2M9XA.
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 8;
const generateOrderCode = () =>
  `ORD-${Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')}`;

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// Redondeo a centavos para que la suma de precios con decimales no arrastre errores de coma flotante.
const roundAmount = (value) => Math.round(value * 100) / 100;

class OrderService {
  constructor({ orderRepository, userRepository, deliveryRepository }) {
    this.repository = orderRepository;
    this.userRepository = userRepository;
    this.deliveryRepository = deliveryRepository;
  }

  normalizeEnum(value, allowed, InvalidValueError) {
    const normalized = String(value).toUpperCase();
    if (!allowed.includes(normalized)) throw new InvalidValueError(value, allowed);
    return normalized;
  }

  // ---------- Validaciones del alta ----------

  validateAddress(address) {
    if (!isPlainObject(address)) {
      throw new InvalidDataError('La dirección de envío debe ser un objeto con street, city y zipCode.', {
        field: 'shippingAddress',
      });
    }
    const data = pick(address, ADDRESS_FIELDS);
    const prefixed = (fields) => fields.map((field) => `shippingAddress.${field}`);

    const missing = findBlankFields(data, ADDRESS_FIELDS);
    if (missing.length > 0) throw new MissingFieldsError(prefixed(missing));

    const invalid = findNonStringFields(data, ADDRESS_FIELDS);
    if (invalid.length > 0) throw new InvalidFieldTypeError(prefixed(invalid));
    return data;
  }

  validateItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new InvalidDataError('El pedido debe tener al menos un ítem.', { field: 'items' });
    }
    return items.map((item, index) => {
      const field = (name) => `items[${index}]${name ? `.${name}` : ''}`;
      if (!isPlainObject(item)) {
        throw new InvalidDataError('Cada ítem debe ser un objeto con title, quantity y unitPrice.', { field: field() });
      }
      const { title, quantity, unitPrice } = item;
      if (typeof title !== 'string' || title.trim() === '') {
        throw new InvalidDataError('Cada ítem necesita un título (texto no vacío).', { field: field('title') });
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new InvalidDataError('La cantidad de cada ítem debe ser un número entero mayor o igual a 1.', {
          field: field('quantity'),
        });
      }
      if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new InvalidDataError('El precio unitario de cada ítem debe ser un número mayor o igual a 0.', {
          field: field('unitPrice'),
        });
      }
      return { title, quantity, unitPrice };
    });
  }

  // Regla de negocio: solo un cliente (rol USER) puede hacer pedidos.
  async findCustomer(id) {
    const customer = await this.userRepository.findById(id);
    if (!customer) throw new UserNotFoundError(id);
    if (customer.role !== USER_ROLES.USER) {
      throw new InvalidDataError(`El cliente del pedido debe tener rol ${USER_ROLES.USER}.`, {
        field: 'customer',
        role: customer.role,
      });
    }
    return customer;
  }

  // ---------- Consultas ----------

  async getOrders({ page, limit, status, priority } = {}) {
    const filter = {};
    if (status) filter.status = this.normalizeEnum(status, VALID_STATUSES, InvalidStatusError);
    if (priority) filter.priority = this.normalizeEnum(priority, VALID_PRIORITIES, InvalidPriorityError);

    const pagination = normalizePagination({ page, limit });
    const { docs, total } = await this.repository.findAll({ filter, ...pagination });
    return buildPaginatedResult({ docs, total, ...pagination });
  }

  async getOrderById(id) {
    const order = await this.repository.findById(id);
    if (!order) throw new OrderNotFoundError(id);
    return order;
  }

  // ---------- Alta y cambio de estado ----------

  // Todo pedido nuevo empieza en PENDING y sin entrega. El código y el total los calcula
  // la API: si el cliente los envía (o envía un status), se ignoran.
  async createOrder(payload) {
    const data = pick(payload, CREATE_FIELDS);

    const missing = findBlankFields(data, REQUIRED_FIELDS);
    if (missing.length > 0) throw new MissingFieldsError(missing);
    if (typeof data.customer !== 'string') throw new InvalidFieldTypeError(['customer']);

    const shippingAddress = this.validateAddress(data.shippingAddress);
    const items = this.validateItems(data.items);
    const priority =
      data.priority === undefined
        ? ORDER_PRIORITY.NORMAL
        : this.normalizeEnum(data.priority, VALID_PRIORITIES, InvalidPriorityError);
    const customer = await this.findCustomer(data.customer);

    const order = await this.repository.create({
      code: generateOrderCode(),
      customer: customer._id,
      items,
      total: roundAmount(items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)),
      shippingAddress,
      priority,
      status: ORDER_STATUS.PENDING,
    });
    logger.info(`Pedido creado: ${order._id} (código ${order.code})`);
    return order;
  }

  // Primero se valida el estado y después que el pedido exista. Si ya tiene ese estado, se
  // devuelve sin cambios. Si el pedido tiene entrega, su estado se actualiza junto con el del pedido.
  async changeOrderStatus(id, status) {
    if (typeof status !== 'string') throw new InvalidStatusError(status, VALID_STATUSES);
    const nextStatus = this.normalizeEnum(status, VALID_STATUSES, InvalidStatusError);

    const order = await this.getOrderById(id);
    if (order.status === nextStatus) return order;

    const allowed = ORDER_STATUS_TRANSITIONS[order.status];
    if (!allowed.includes(nextStatus)) {
      throw new OrderStatusTransitionError({ from: order.status, to: nextStatus, allowed });
    }

    const delivery = await this.deliveryRepository.findByOrder(order._id);
    const deliveryStatus = DELIVERY_STATUS_BY_ORDER_STATUS[nextStatus];
    if (DELIVERY_STATUSES_WITH_COURIER.includes(deliveryStatus) && !delivery?.courier) {
      throw new OrderCourierRequiredError({ id, status: nextStatus });
    }

    const updated = await this.repository.updateById(id, { status: nextStatus });
    if (delivery) {
      const deliveryChanges = { status: deliveryStatus };
      if (nextStatus === ORDER_STATUS.DELIVERED) deliveryChanges.deliveredAt = new Date();
      await this.deliveryRepository.updateById(delivery._id, deliveryChanges);
    }
    logger.info(`Estado del pedido ${id} cambiado de ${order.status} a ${nextStatus}`);
    return updated;
  }
}

export default new OrderService({ orderRepository, userRepository, deliveryRepository });
