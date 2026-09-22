import productService from '../services/product.service.js';
import { HTTP_STATUS } from '../constants/index.js';

// Única puerta de entrada HTTP: traduce req -> Service -> res.
// Express 5 propaga automáticamente al errorHandler los errores de handlers async.
class ProductController {
  constructor(service) {
    this.service = service;
  }

  getAll = async (req, res) => {
    const { page, limit, category, status } = req.query;
    const result = await this.service.getProducts({ page, limit, category, status });
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: result });
  };

  getById = async (req, res) => {
    const product = await this.service.getProductById(req.params.pid);
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: product });
  };

  create = async (req, res) => {
    const product = await this.service.createProduct(req.body);
    res.status(HTTP_STATUS.CREATED).json({ status: 'success', payload: product });
  };

  update = async (req, res) => {
    const product = await this.service.updateProduct(req.params.pid, req.body);
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: product });
  };

  delete = async (req, res) => {
    await this.service.deleteProduct(req.params.pid);
    res.status(HTTP_STATUS.NO_CONTENT).end();
  };
}

export default new ProductController(productService);
