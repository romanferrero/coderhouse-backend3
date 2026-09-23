import mockService from '../services/mock.service.js';
import { HTTP_STATUS } from '../constants/index.js';

// GET: solo devuelven datos simulados. POST/DELETE: escriben en MongoDB.
class MockController {
  constructor(service) {
    this.service = service;
  }

  getUsers = async (req, res) => {
    const { qty, role } = req.query;
    const users = await this.service.getMockUsers({ qty, role });
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: users });
  };

  getCouriers = async (req, res) => {
    const couriers = await this.service.getMockCouriers({ qty: req.query.qty });
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: couriers });
  };

  getOrders = async (req, res) => {
    const result = await this.service.getMockOrders({ qty: req.query.qty });
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: result });
  };

  getDeliveries = async (req, res) => {
    const result = await this.service.getMockDeliveries({ qty: req.query.qty });
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: result });
  };

  seedDataset = async (req, res) => {
    const { users, couriers, orders } = req.query;
    const result = await this.service.seedDataset({ users, couriers, orders });
    res.status(HTTP_STATUS.CREATED).json({ status: 'success', payload: result });
  };

  seedUsers = async (req, res) => {
    const { qty, role } = req.query;
    const result = await this.service.seedUsers({ qty, role });
    res.status(HTTP_STATUS.CREATED).json({ status: 'success', payload: result });
  };

  seedCouriers = async (req, res) => {
    const result = await this.service.seedCouriers({ qty: req.query.qty });
    res.status(HTTP_STATUS.CREATED).json({ status: 'success', payload: result });
  };

  seedOrders = async (req, res) => {
    const result = await this.service.seedOrders({ qty: req.query.qty });
    res.status(HTTP_STATUS.CREATED).json({ status: 'success', payload: result });
  };

  clear = async (req, res) => {
    const result = await this.service.clearMockData();
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: result });
  };
}

export default new MockController(mockService);
