import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config/index.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Carpeta raíz de los archivos subidos. Los tests usan uploads/test/, que se vacía al terminar
// la suite: nunca se mezclan con los archivos de desarrollo.
export const UPLOADS_ROOT = path.join(PROJECT_ROOT, 'uploads', config.nodeEnv === 'test' ? 'test' : '');

// En la base se guarda la ruta relativa a la raíz del proyecto y con "/" (uploads/users/123.pdf):
// no depende de dónde esté instalado el proyecto ni del sistema operativo.
export const toStoredPath = (absolutePath) => path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join('/');

// Ruta absoluta de un archivo a partir de la ruta guardada. Devuelve null si queda fuera de uploads/.
export const resolveStoredPath = (storedPath) => {
  const absolutePath = path.resolve(PROJECT_ROOT, storedPath);
  const relative = path.relative(UPLOADS_ROOT, absolutePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? absolutePath : null;
};

export const fileExists = (absolutePath) =>
  fs.access(absolutePath).then(
    () => true,
    () => false
  );

// Borra un archivo; si ya no existe, no hace nada.
export const removeFile = (absolutePath) => fs.rm(absolutePath, { force: true });
