import orderService from '../services/order.service.js';
import { HTTP_STATUS } from '../constants/index.js';

class OrderController {
  constructor(service) {
    this.service = service;
  }

  getAll = async (req, res) => {
    const { page, limit, status, priority } = req.query;
    const result = await this.service.getOrders({ page, limit, status, priority });
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: result });
  };

  getById = async (req, res) => {
    const order = await this.service.getOrderById(req.params.oid);
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: order });
  };
}

export default new OrderController(orderService);
