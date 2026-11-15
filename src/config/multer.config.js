import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import logger from '../logger/index.js';
import { UPLOADS_ROOT } from '../utils/files.js';
import {
  AppError,
  ERROR_DICTIONARY as ERRORS,
  FileRequiredError,
  FileTooLargeError,
  FileUploadFailedError,
  InvalidFileTypeError,
  UnexpectedFileFieldError,
} from '../errors/index.js';

// Configuración única de la carga de archivos. Los routers solo usan los middlewares que se
// exportan al final (uploadUserDocument, uploadDeliveryProof); acá se define todo lo demás:
// dónde se guardan, cómo se nombran, qué tipos y tamaño se aceptan y cómo se informan los errores.

// ---------- Dónde se guardan ----------

// Una subcarpeta de uploads/ por tipo de carga. Multer decide la carpeta cuando empieza a llegar
// el archivo, y en ese momento puede no haber llegado todavía el campo documentType: por eso la
// carpeta depende del endpoint y el tipo de documento queda en los metadatos.
export const UPLOAD_TARGETS = Object.freeze({
  USER_DOCUMENT: Object.freeze({ field: 'document', folder: 'users' }),
  DELIVERY_PROOF: Object.freeze({ field: 'proof', folder: 'deliveries' }),
});

// ---------- Tipos y tamaño ----------

// mimetype → extensiones aceptadas. Se exige que coincidan los dos: un .exe enviado como
// application/pdf, o un PDF renombrado a .png, se rechaza.
export const ALLOWED_FILE_TYPES = Object.freeze({
  'application/pdf': Object.freeze(['.pdf']),
  'image/jpeg': Object.freeze(['.jpg', '.jpeg']),
  'image/png': Object.freeze(['.png']),
});
const ALLOWED_EXTENSIONS = Object.values(ALLOWED_FILE_TYPES).flat();

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const LIMITS = Object.freeze({
  fileSize: MAX_FILE_SIZE_BYTES,
  files: 1, // un archivo por carga
  fields: 5, // los campos de texto que acompañan al archivo (documentType)
  fieldSize: 1024, // 1 KB por campo de texto
});

// ---------- Almacenamiento y nombres ----------

// El nombre se genera en el servidor (fecha + UUID + extensión validada): nunca se usa el nombre
// que manda el cliente, así no hay choques entre archivos ni rutas armadas con datos externos.
// El nombre original se guarda en los metadatos.
const createStorage = (folder) =>
  multer.diskStorage({
    // La carpeta se crea si no existe (también si se borró con la app corriendo).
    destination: (req, file, cb) => {
      const destination = path.join(UPLOADS_ROOT, folder);
      fs.mkdir(destination, { recursive: true }).then(() => cb(null, destination), cb);
    },
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  });

// Se ejecuta antes de escribir nada en disco: si el tipo no está permitido, el archivo no se guarda.
const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_FILE_TYPES[file.mimetype]?.includes(extension)) return cb(null, true);

  logger.warning(
    `Intento de carga con un tipo no permitido en ${req.method} ${req.originalUrl}: ` +
      `"${file.originalname}" (${file.mimetype})`
  );
  cb(new InvalidFileTypeError({ fileName: file.originalname, mimeType: file.mimetype, allowed: ALLOWED_EXTENSIONS }));
};

// ---------- Errores de carga ----------

// Traduce lo que devuelve Multer a errores del diccionario, para que el errorHandler responda con
// el formato de siempre. Si la carga falla, Multer ya borró el archivo que había empezado a escribir.
const toUploadError = (error, { field }) => {
  if (error instanceof AppError) return error;

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return new FileTooLargeError({ field, maxSizeBytes: MAX_FILE_SIZE_BYTES });
      case 'LIMIT_UNEXPECTED_FILE':
      case 'LIMIT_FILE_COUNT':
        return new UnexpectedFileFieldError({ expected: field, received: error.field ?? field });
      default:
        // Demasiados campos, un campo de texto demasiado largo, etc.
        return new AppError(ERRORS.BAD_REQUEST, {
          message: `La solicitud multipart no es válida: ${error.message}.`,
          details: { reason: error.code },
        });
    }
  }

  // Errores del sistema de archivos (sin espacio, sin permisos…): el archivo no se pudo guardar.
  if (error?.syscall) return new FileUploadFailedError(error);

  // Cualquier otro: el body multipart llegó mal formado o cortado.
  return new AppError(ERRORS.BAD_REQUEST, { cause: error });
};

// ---------- Middlewares para los routers ----------

// Acepta un único archivo en el campo del destino. Después de Multer, req.file tiene los datos del
// archivo guardado y req.body los campos de texto. Si no llegó ningún archivo (o la request no es
// multipart/form-data) responde FILE_REQUIRED antes de llegar al controller.
const createUploader = (target) => {
  const upload = multer({ storage: createStorage(target.folder), fileFilter, limits: LIMITS }).single(target.field);

  return (req, res, next) => {
    upload(req, res, (error) => {
      if (error) return next(toUploadError(error, target));
      if (!req.file) return next(new FileRequiredError(target.field));
      next();
    });
  };
};

export const uploadUserDocument = createUploader(UPLOAD_TARGETS.USER_DOCUMENT);
export const uploadDeliveryProof = createUploader(UPLOAD_TARGETS.DELIVERY_PROOF);
