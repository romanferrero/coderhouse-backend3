# Imagen de la API de ShipNow.
#   docker build -t shipnow-api .
#   docker run -d --name shipnow-api -p 8080:8080 --env-file .env.production shipnow-api

# Node 22 LTS sobre Alpine: imagen base oficial y liviana (package.json pide Node >= 20).
FROM node:22-alpine

# Producción por defecto. PORT es el puerto interno del contenedor; desde afuera se elige con -p.
# MONGODB_URI no tiene valor por defecto: sin ella la app no arranca (falla con un mensaje claro).
ENV NODE_ENV=production \
    PORT=8080 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

# Primero solo los manifiestos: mientras no cambien las dependencias, Docker reutiliza esta capa
# y no reinstala nada al cambiar el código. npm ci instala exactamente lo del package-lock.json,
# sin las devDependencies (Mocha, Chai, Supertest), y se limpia la caché de npm.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# El código de la app. Solo src/: tests, logs, uploads, .env y demás quedan afuera (ver .dockerignore).
COPY src ./src

# Carpetas donde la app escribe en tiempo de ejecución, del usuario sin privilegios que la ejecuta.
# Para conservarlas al recrear el contenedor se montan como volúmenes (-v).
RUN mkdir -p logs uploads && chown node:node logs uploads

# La imagen oficial de Node trae el usuario "node": la app no corre como root.
USER node

EXPOSE 8080

# Docker marca el contenedor como unhealthy si /api/health no responde 200
# (por ejemplo, si la API perdió la conexión con MongoDB).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Mismo script que en local (npm start → node src/server.js).
CMD ["npm", "start"]
