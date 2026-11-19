import deliveryRepository from '../repositories/delivery.repository.js';
import documentService from './document.service.js';
import logger from '../logger/index.js';
import { DELIVERY_STATUS, DELIVERY_PROOF_TYPES, DEFAULT_DELIVERY_PROOF_TYPE } from '../constants/index.js';
import { InvalidStatusError, DeliveryNotFoundError } from '../errors/index.js';
import { normalizePagination, buildPaginatedResult } from '../utils/pagination.js';

const VALID_STATUSES = Object.values(DELIVERY_STATUS);
const VALID_PROOF_TYPES = Object.values(DELIVERY_PROOF_TYPES);

class DeliveryService {
  constructor({ repository, documents }) {
    this.repository = repository;
    this.documents = documents;
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

  // ---------- Comprobantes ----------

  // Igual que los documentos de usuario, pero el tipo es opcional (DELIVERY_PHOTO por defecto).
  // Si algo falla, el archivo se borra.
  async addProof(id, { file, documentType }) {
    try {
      const type = this.documents.parseDocumentType(documentType, VALID_PROOF_TYPES, {
        defaultType: DEFAULT_DELIVERY_PROOF_TYPE,
      });
      const existing = await this.getDeliveryById(id);
      this.documents.ensureCapacity(existing.proofs, { entity: 'delivery', id });

      const metadata = this.documents.buildMetadata(file, type);
      const delivery = await this.documents.persist(() => this.repository.addProof(id, metadata));
      if (!delivery) throw new DeliveryNotFoundError(id);

      logger.info(`Comprobante ${type} asociado a la entrega ${id}: ${this.documents.describe(metadata)}`);
      return delivery;
    } catch (error) {
      await this.documents.discard(file);
      throw error;
    }
  }

  async getProofs(id) {
    const delivery = await this.getDeliveryById(id);
    return delivery.proofs ?? [];
  }

  async getProofFile(id, proofId) {
    const delivery = await this.getDeliveryById(id);
    return this.documents.getFile(delivery.proofs, proofId);
  }
}

export default new DeliveryService({ repository: deliveryRepository, documents: documentService });
