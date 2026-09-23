import orderRepository from '../repositories/order.repository.js';
import { ORDER_STATUS, ORDER_PRIORITY } from '../constants/index.js';
import AppError from '../utils/AppError.js';
import { normalizePagination, buildPaginatedResult } from '../utils/pagination.js';

const VALID_STATUSES = Object.values(ORDER_STATUS);
const VALID_PRIORITIES = Object.values(ORDER_PRIORITY);

class OrderService {
  constructor(repository) {
    this.repository = repository;
  }

  normalizeEnum(value, allowed, label) {
    const normalized = String(value).toUpperCase();
    if (!allowed.includes(normalized)) {
      throw AppError.badRequest(`${label} inválido. Valores permitidos: ${allowed.join(', ')}.`);
    }
    return normalized;
  }

  async getOrders({ page, limit, status, priority } = {}) {
    const filter = {};
    if (status) filter.status = this.normalizeEnum(status, VALID_STATUSES, 'Estado');
    if (priority) filter.priority = this.normalizeEnum(priority, VALID_PRIORITIES, 'Prioridad');

    const pagination = normalizePagination({ page, limit });
    const { docs, total } = await this.repository.findAll({ filter, ...pagination });
    return buildPaginatedResult({ docs, total, ...pagination });
  }

  async getOrderById(id) {
    const order = await this.repository.findById(id);
    if (!order) throw AppError.notFound(`Pedido con id "${id}" no encontrado.`);
    return order;
  }
}

export default new OrderService(orderRepository);
