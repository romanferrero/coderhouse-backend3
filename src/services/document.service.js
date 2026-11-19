import logger from '../logger/index.js';
import { MAX_DOCUMENTS_PER_ENTITY } from '../constants/index.js';
import {
  DocumentFileMissingError,
  DocumentLimitReachedError,
  DocumentNotFoundError,
  FileUploadFailedError,
  InvalidDocumentTypeError,
} from '../errors/index.js';
import { fileExists, removeFile, resolveStoredPath, toStoredPath } from '../utils/files.js';

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Lógica común a los archivos asociados a una entidad: documentos de usuario y comprobantes de
// entrega. Lo usan UserService y DeliveryService; Multer ya validó el tipo y el tamaño del archivo.
class DocumentService {
  // Valida el tipo de documento (acepta minúsculas). Si no se envía y hay un tipo por defecto, se
  // usa ese; si no lo hay, es obligatorio.
  parseDocumentType(value, allowed, { defaultType } = {}) {
    if (defaultType && (value === undefined || value === '')) return defaultType;
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : null;
    if (!allowed.includes(normalized)) throw new InvalidDocumentTypeError(value, allowed);
    return normalized;
  }

  // Cada entidad acepta como máximo MAX_DOCUMENTS_PER_ENTITY archivos. Se controla después de que Multer
  // guardó el archivo (antes no se conoce la entidad): si se rechaza, el service lo borra.
  ensureCapacity(documents = [], { entity, id }) {
    if (documents.length >= MAX_DOCUMENTS_PER_ENTITY) {
      throw new DocumentLimitReachedError({ entity, id, max: MAX_DOCUMENTS_PER_ENTITY });
    }
  }

  // Lo que se guarda en MongoDB. El archivo queda en disco: en la base van solo sus metadatos.
  buildMetadata(file, documentType) {
    return {
      documentType,
      originalName: file.originalname,
      fileName: file.filename,
      path: toStoredPath(file.path),
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date(),
    };
  }

  describe({ originalName, path, mimeType, size }) {
    return `"${originalName}" → ${path} (${mimeType}, ${formatSize(size)})`;
  }

  // Registra los metadatos con la función del repository. Si MongoDB falla, el archivo no quedó
  // asociado a nada: se informa como FILE_UPLOAD_FAILED.
  async persist(save) {
    try {
      return await save();
    } catch (error) {
      throw new FileUploadFailedError(error);
    }
  }

  // Borra un archivo que llegó a guardarse pero cuya carga no se completó (tipo de documento
  // inválido, entidad inexistente, falla de MongoDB): no queda ningún archivo sin su entidad.
  async discard(file) {
    try {
      await removeFile(file.path);
      logger.debug(`Archivo descartado porque la carga no se completó: ${file.filename}`);
    } catch (error) {
      logger.error(`No se pudo borrar el archivo descartado ${file.path}: ${error.message}`, { stack: error.stack });
    }
  }

  // Borra del disco los archivos de una entidad que se eliminó (un usuario, o los datos de prueba
  // con sus entregas). Una falla se registra pero no frena la baja, que ya se hizo en MongoDB.
  async removeFiles(documents = []) {
    const results = await Promise.allSettled(
      documents.map((doc) => {
        const absolutePath = resolveStoredPath(doc.path);
        return absolutePath ? removeFile(absolutePath) : Promise.resolve();
      })
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`No se pudo borrar el archivo ${documents[index].path}: ${result.reason.message}`);
      }
    });
    if (documents.length > 0) logger.info(`Archivos borrados junto con su entidad: ${documents.length}`);
  }

  // Busca el documento entre los de la entidad y devuelve la ruta del archivo para descargarlo.
  async getFile(documents = [], documentId) {
    const document = documents.find((doc) => String(doc._id) === documentId);
    if (!document) throw new DocumentNotFoundError(documentId);

    const absolutePath = resolveStoredPath(document.path);
    if (!absolutePath || !(await fileExists(absolutePath))) {
      logger.error(`El documento ${documentId} está en la base pero falta su archivo: ${document.path}`);
      throw new DocumentFileMissingError(documentId);
    }
    return { absolutePath, fileName: document.originalName };
  }
}

export default new DocumentService();
