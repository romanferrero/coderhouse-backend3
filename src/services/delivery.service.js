import deliveryRepository from '../repositories/delivery.repository.js';
import { DELIVERY_STATUS } from '../constants/index.js';
import { InvalidStatusError, DeliveryNotFoundError } from '../errors/index.js';
import { normalizePagination, buildPaginatedResult } from '../utils/pagination.js';

const VALID_STATUSES = Object.values(DELIVERY_STATUS);

class DeliveryService {
  constructor(repository) {
    this.repository = repository;
  }

  async getDeliveries({ page, limit, status } = {}) {
    const filter = {};
    if (status) {
      const normalizedStatus = String(status).toUpperCase();
      if (!VALID_STATUSES.includes(normalizedStatus)) {
        throw new InvalidStatusError(status, VALID_STATUSES);
      }
      filter.status = normalizedStatus;
    }

    const pagination = normalizePagination({ page, limit });
    const { docs, total } = await this.repository.findAll({ filter, ...pagination });
    return buildPaginatedResult({ docs, total, ...pagination });
  }

  async getDeliveryById(id) {
    const delivery = await this.repository.findById(id);
    if (!delivery) throw new DeliveryNotFoundError(id);
    return delivery;
  }
}

export default new DeliveryService(deliveryRepository);
