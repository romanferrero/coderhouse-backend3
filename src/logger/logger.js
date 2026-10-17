import path from 'node:path';
import { fileURLToPath } from 'node:url';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { rawNodeEnv } from '../config/env.config.js';

// Configuración única del logger de ShipNow. El resto del proyecto solo importa
// `logger` y llama a logger.info(), logger.warning(), etc.

// Cuanto menor el número, más grave. Un transport con nivel X registra X y todos los más graves.
export const LOG_LEVELS = Object.freeze({
  fatal: 0,
  error: 1,
  warning: 2,
  info: 3,
  http: 4,
  debug: 5,
});

const LOG_COLORS = Object.freeze({
  fatal: 'bold magenta',
  error: 'red',
  warning: 'yellow',
  info: 'green',
  http: 'cyan',
  debug: 'blue',
});

// Nivel mínimo según NODE_ENV: en desarrollo se ve todo; en producción, desde info.
const LEVEL_BY_ENV = Object.freeze({
  development: 'debug',
  test: 'warning',
  production: 'info',
});

const ENVIRONMENT = rawNodeEnv in LEVEL_BY_ENV ? rawNodeEnv : 'development';
const LOGS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../logs');

const ROTATION = Object.freeze({
  // logs/error.log: al llegar a 5 MB pasa a error1.log, error2.log… y se conservan 5 archivos.
  ERROR_MAX_SIZE_BYTES: 5 * 1024 * 1024,
  ERROR_MAX_FILES: 5,
  // logs/app-AAAA-MM-DD.log: un archivo por día (o cada 20 MB), comprimido y borrado a los 14 días.
  APP_MAX_SIZE: '20m',
  APP_MAX_DAYS: '14d',
});

winston.addColors(LOG_COLORS);
const colorizer = winston.format.colorize();

// "[warning]" es el nivel más largo: así los mensajes quedan alineados.
const LEVEL_WIDTH = Math.max(...Object.keys(LOG_LEVELS).map((level) => level.length)) + 2;

// 2026-08-01 10:12:03 [info]    Mensaje {"datos":"extra"}
// y, si el log trae un error, su stack en las líneas siguientes.
const lineFormat = ({ colors }) =>
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const tag = `[${level}]`.padEnd(LEVEL_WIDTH);
    const extra = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const trace = stack ? `\n${stack}` : '';
    return `${timestamp} ${colors ? colorizer.colorize(level, tag) : tag} ${message}${extra}${trace}`;
  });

const baseFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
);

const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: LEVEL_BY_ENV[ENVIRONMENT],
  format: baseFormat,
  transports: [
    // Colores solo en desarrollo: en producción la consola suele ir a un archivo o a un servicio.
    new winston.transports.Console({
      format: lineFormat({ colors: ENVIRONMENT === 'development' }),
    }),
    // Solo error y fatal, para consultar las fallas después de que ocurrieron.
    new winston.transports.File({
      level: 'error',
      dirname: LOGS_DIR,
      filename: 'error.log',
      maxsize: ROTATION.ERROR_MAX_SIZE_BYTES,
      maxFiles: ROTATION.ERROR_MAX_FILES,
      tailable: true,
      format: lineFormat({ colors: false }),
    }),
    // Historial completo (desde el nivel del entorno) rotado por fecha.
    new DailyRotateFile({
      dirname: LOGS_DIR,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: ROTATION.APP_MAX_SIZE,
      maxFiles: ROTATION.APP_MAX_DAYS,
      zippedArchive: true,
      auditFile: path.join(LOGS_DIR, '.app-audit.json'),
      format: lineFormat({ colors: false }),
    }),
  ],
});

export default logger;
