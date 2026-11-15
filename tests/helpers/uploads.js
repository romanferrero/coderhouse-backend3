import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_ROOT } from '../../src/utils/files.js';
import { MAX_FILE_SIZE_BYTES } from '../../src/config/multer.config.js';

// Con NODE_ENV=test los archivos se suben a uploads/test/. La suite lo vacía antes de cada test
// de carga y al terminar, así no queda ningún archivo subido durante las pruebas.
export const clearUploads = async () => {
  if (path.basename(UPLOADS_ROOT) !== 'test') {
    throw new Error(`La carpeta de uploads "${UPLOADS_ROOT}" no es la de testing: no se borra.`);
  }
  await fs.rm(UPLOADS_ROOT, { recursive: true, force: true });
};

// Archivos que hay guardados en una subcarpeta de uploads (users, deliveries).
export const listUploads = (folder) => fs.readdir(path.join(UPLOADS_ROOT, folder)).catch(() => []);

// Ruta absoluta a partir de la ruta que devuelve la API (uploads/test/users/123.pdf).
export const absoluteUploadPath = (storedPath) => path.join(UPLOADS_ROOT, '..', '..', storedPath);

// Archivos de prueba armados en memoria: no hace falta tener fixtures en el repositorio.
// Multer valida el mimetype y la extensión, no el contenido.
export const pdfFile = (filename = 'dni.pdf') => ({
  content: Buffer.from(`%PDF-1.4\n% Documento de prueba de ShipNow: ${filename}\n%%EOF\n`),
  options: { filename, contentType: 'application/pdf' },
});

export const jpgFile = (filename = 'entrega.jpg') => ({
  content: Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(`Foto de prueba: ${filename}`), 0xff, 0xd9]),
  options: { filename, contentType: 'image/jpeg' },
});

export const gifFile = (filename = 'animacion.gif') => ({
  content: Buffer.from('GIF89a archivo de prueba'),
  options: { filename, contentType: 'image/gif' },
});

// Un byte más que el máximo permitido.
export const oversizedPdfFile = () => ({
  content: Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, 'a'),
  options: { filename: 'escaneo-gigante.pdf', contentType: 'application/pdf' },
});

// Supertest no junta en un Buffer las respuestas binarias (PDF, imágenes): este parser lo hace,
// así se puede comparar el archivo descargado con el subido.
export const binaryParser = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};
