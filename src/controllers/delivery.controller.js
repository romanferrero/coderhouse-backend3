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

  uploadProof = async (req, res) => {
    const delivery = await this.service.addProof(req.params.did, {
      file: req.file,
      documentType: req.body?.documentType,
    });
    res.status(HTTP_STATUS.CREATED).json({ status: 'success', payload: delivery });
  };

  getProofs = async (req, res) => {
    const proofs = await this.service.getProofs(req.params.did);
    res.status(HTTP_STATUS.OK).json({ status: 'success', payload: proofs });
  };

  // Descarga el archivo con su nombre original (Content-Disposition: attachment).
  downloadProof = async (req, res) => {
    const { absolutePath, fileName } = await this.service.getProofFile(req.params.did, req.params.proofId);
    res.download(absolutePath, fileName);
  };
}

export default new DeliveryController(deliveryService);
