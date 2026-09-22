import userService from '../services/user.service.js';
import { HTTP_STATUS } from '../constants/index.js';

class UserController {
  constructor(service) {
    this.service = service;
  }

  getAll = async (req, res) => {
    const { page, limit, role } = req.query;
    const result = await this.service.getUsers({ page, limit, role });
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: result });
  };

  getById = async (req, res) => {
    const user = await this.service.getUserById(req.params.uid);
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: user });
  };

  create = async (req, res) => {
    const user = await this.service.createUser(req.body);
    res.status(HTTP_STATUS.CREATED).json({ status: 'success', payload: user });
  };

  update = async (req, res) => {
    const user = await this.service.updateUser(req.params.uid, req.body);
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: user });
  };

  changeRole = async (req, res) => {
    const user = await this.service.changeRole(req.params.uid, req.body?.role);
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: user });
  };

  delete = async (req, res) => {
    await this.service.deleteUser(req.params.uid);
    res.status(HTTP_STATUS.NO_CONTENT).end();
  };
}

export default new UserController(userService);
