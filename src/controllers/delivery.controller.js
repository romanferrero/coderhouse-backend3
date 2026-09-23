import deliveryService from '../services/delivery.service.js';
import { HTTP_STATUS } from '../constants/index.js';

class DeliveryController {
  constructor(service) {
    this.service = service;
  }

  getAll = async (req, res) => {
    const { page, limit, status } = req.query;
    const result = await this.service.getDeliveries({ page, limit, status });
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: result });
  };

  getById = async (req, res) => {
    const delivery = await this.service.getDeliveryById(req.params.did);
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: delivery });
  };
}

export default new DeliveryController(deliveryService);
