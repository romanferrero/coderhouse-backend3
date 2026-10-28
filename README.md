# ShipNow API

API REST de ShipNow para la gestión de **productos**, **usuarios** (clientes y repartidores), **pedidos** y **entregas**, con arquitectura por capas (**Router → Controller → Service → Repository → Model**), configuración de entorno centralizada, un **módulo de mocking** para generar y cargar datos de prueba, una **capa centralizada de manejo de errores**, **logging con Winston** y **documentación interactiva con Swagger**.

> Pre-entregas Módulo 1 (arquitectura por capas), Módulo 2 (mocking y carga de datos), Módulo 3 (manejo profesional de errores), Módulo 4 (logging y monitoreo básico) y Módulo 5 (documentación de API con Swagger) — Backend III (Coderhouse).

- [Cómo correrlo localmente](#cómo-correrlo-localmente)
- [Documentación de la API (Swagger)](#documentación-de-la-api-swagger)
- [Manejo de errores](#manejo-de-errores)
- [Logging](#logging)
- [Módulo de mocking — `/api/mocks`](#módulo-de-mocking--apimocks)
- [Endpoints](#endpoints)
- [Constantes](#constantes)

## Stack

- Node.js ≥ 20 (ES Modules)
- Express 5
- MongoDB + Mongoose
- dotenv
- bcryptjs (hash de contraseñas)
- @faker-js/faker (datos simulados, locale español)
- winston + winston-daily-rotate-file (logging con rotación de archivos)
- swagger-jsdoc + swagger-ui-express (documentación OpenAPI 3 interactiva)

## Cómo correrlo localmente

1. **Clonar e instalar dependencias**

   ```bash
   git clone https://github.com/romanferrero/coderhouse-backend3.git
   cd coderhouse-backend3
   npm install
   ```

2. **Configurar variables de entorno**: copiar `.env.example` a `.env` y completar los valores.

   ```bash
   cp .env.example .env
   ```

   | Variable      | Descripción                                   | Ejemplo                                |
   | ------------- | --------------------------------------------- | -------------------------------------- |
   | `PORT`        | Puerto del servidor HTTP (1–65535)            | `8080`                                 |
   | `MONGODB_URI` | URI de conexión a MongoDB                     | `mongodb://localhost:27017/shipnow`    |
   | `NODE_ENV`    | Entorno: `development`, `production` o `test` | `development`                          |

3. **Levantar el servidor**

   ```bash
   npm run dev    # con recarga automática (node --watch)
   npm start      # modo normal
   ```

   Verificar con `GET http://localhost:8080/api/health`.

4. **Abrir la documentación**: [http://localhost:8080/api/docs](http://localhost:8080/api/docs) (ver [Documentación de la API](#documentación-de-la-api-swagger)).

### Si falta una variable

La app **no arranca** si falta o es inválida alguna variable crítica, y lo registra como `fatal` (consola y `logs/error.log`). Por ejemplo, con `MONGODB_URI` vacía:

```
2026-10-14 18:25:30 [fatal]   No se pudo iniciar la aplicación: [config] Faltan variables de entorno obligatorias: MONGODB_URI. Revisá tu archivo .env (podés tomar .env.example como referencia).
```

## Estructura del proyecto

```
src/
├── config/
│   ├── env.config.js      # carga dotenv, valida y exporta la config congelada
│   └── index.js           # re-export de la config
├── constants/
│   └── index.js           # roles, estados, prioridades, HTTP_STATUS, MOCKS (Object.freeze)
├── controllers/           # req/res: leen parámetros, llaman al Service y eligen el status de éxito
├── services/              # lógica y reglas de negocio (incluye mock.service.js)
├── repositories/          # único lugar que usa Mongoose (consultas, filtros, proyecciones)
├── models/                # solo esquemas de Mongoose (user, product, order, delivery)
├── mocks/                 # generadores de datos simulados (funciones puras con Faker)
├── routes/                # path → método del Controller, nada más
├── errors/                # diccionario de errores, AppError y errores personalizados del dominio
├── middlewares/           # errorHandler (único lugar que arma respuestas de error) y requestLogger
├── logger/                # configuración única de Winston (niveles, formato, transports, rotación)
├── docs/                  # documentación OpenAPI: configuración de Swagger, paths y components en YAML
├── db/                    # conexión a MongoDB
├── utils/                 # paginación, helpers
├── app.js                 # instancia de Express (monta /api/docs y /api)
└── server.js              # punto de entrada: conecta la DB y levanta el servidor
logs/                      # archivos de log generados (ignorados por Git, salvo .gitkeep)
```

### Flujo de una request

```
HTTP → Router → Controller → Service → Repository → Model (Mongoose) → MongoDB
                    │            │
                    │            └─ throw new UserNotFoundError(id)
                    └─ no lo atrapa: Express lo deriva → errorHandler → respuesta JSON
```

- Los **Controllers** nunca importan Mongoose: solo conocen al Service.
- Los **Services** detectan los casos inválidos y lanzan un error personalizado del dominio; el middleware `errorHandler` es el único que lo convierte en respuesta (ver [Manejo de errores](#manejo-de-errores)).
- Los Services rechazan con `400` los campos obligatorios vacíos o con solo espacios, tanto al crear como al actualizar (PUT).
- Los campos de texto tienen que llegar como string: un array u objeto (`{"email": ["ana@mail.com"]}`, `{"code": {"$ne": null}}`) responde `400 INVALID_FIELD_TYPE` antes de validar el formato o de consultar MongoDB.
- `process.env` solo se lee en `src/config/env.config.js`.

## Documentación de la API (Swagger)

La API se documenta con **OpenAPI 3** y se puede consultar y probar desde el navegador con Swagger UI.

| Ruta                                   | Qué devuelve |
| -------------------------------------- | ------------ |
| **`GET /api/docs`**                    | Swagger UI: documentación interactiva, con "Try it out" para ejecutar cada endpoint |
| `GET /api/docs.json`                   | La especificación OpenAPI en JSON (para importarla en Postman, Insomnia, etc.) |

Con el servidor levantado (`npm run dev`, ver [Cómo correrlo localmente](#cómo-correrlo-localmente)), abrir **[http://localhost:8080/api/docs](http://localhost:8080/api/docs)**. Si en `.env` se usa otro `PORT`, la ruta es la misma con ese puerto: el servidor que figura en la documentación se arma con el puerto configurado.

### Qué está documentado

La información general (nombre, versión tomada del `package.json`, descripción, propósito y servidor local) está al principio de la página. Los endpoints están agrupados por **tags**:

| Tag          | Endpoints | Notas |
| ------------ | --------- | ----- |
| `Users`      | `GET/POST /api/users`, `GET/PUT/DELETE /api/users/{uid}`, `PATCH /api/users/{uid}/role` | Alta, edición, cambio de rol y baja |
| `Orders`     | `GET /api/orders`, `GET /api/orders/{oid}` | Solo lectura, filtros por estado y prioridad |
| `Deliveries` | `GET /api/deliveries`, `GET /api/deliveries/{did}` | Solo lectura, filtro por estado |
| `Mocks`      | `GET /api/mocks/{users,couriers,orders,deliveries}`, `POST /api/mocks/seed`, `POST /api/mocks/seed/{users,couriers,orders}`, `DELETE /api/mocks/seed` | Separa lo que solo genera datos (GET) de lo que escribe en MongoDB (POST/DELETE) |
| `Logger`     | `GET /api/loggerTest` | Aclarado como herramienta de validación, no funcionalidad de negocio |
| `Products`   | `GET/POST /api/products`, `GET/PUT/DELETE /api/products/{pid}` | Catálogo |
| `Health`     | `GET /api/health` | Estado del servidor |

Cada endpoint indica método, ruta, descripción, parámetros de ruta y de query, body esperado (si lleva), la respuesta exitosa con su schema y **todas las respuestas de error que puede devolver**, con un ejemplo por cada `code` posible (por ejemplo, el `400` de `POST /api/users` muestra `MISSING_REQUIRED_FIELDS`, `INVALID_FIELD_TYPE`, los tres `VALIDATION_ERROR` e `INVALID_JSON`).

**Schemas reutilizables** (`components/schemas`): `User`, `Order`, `OrderItem`, `Delivery`, `Product`, `SuccessResponse`, `ErrorResponse` (con el enum `ErrorCode` del diccionario), `PaginatedResult`, los bodies de entrada (`UserCreate`, `UserUpdate`, `UserRoleChange`, `ProductCreate`, `ProductUpdate`), los datos simulados (`MockUser`, `MockOrder`, `MockDelivery`…) y los resultados de la carga de mocks y del logger. Además hay **parámetros**, **respuestas de error** (`UserNotFound`, `MockSeedForbidden`, `InternalServerError`…) y **ejemplos de error** reutilizables.

Los errores documentados son los del [diccionario de errores](#diccionario-de-errores), con el mismo `code`, status, `message` y `details` que devuelve la API: datos inválidos (`400`), recurso no encontrado (`404`), conflictos (`409`), cantidad inválida en mocks (`MOCK_INVALID_QUANTITY`, `MOCK_NEGATIVE_QUANTITY`, `MOCK_QUANTITY_OUT_OF_RANGE`), estado inválido en pedidos y entregas (`INVALID_STATUS`), carga deshabilitada en producción (`403`) y error interno (`500`). La API **no tiene autenticación**, así que no hay respuestas `401`.

### Cómo está organizado

La configuración de Swagger está separada de las rutas: los routers no tienen comentarios ni código de Swagger.

```
src/docs/
├── swagger.js               # configuración: info general, servidor, tags y armado de la spec con swagger-jsdoc
├── components/
│   ├── schemas.yaml         # entidades, bodies de entrada, SuccessResponse, ErrorResponse, PaginatedResult
│   ├── parameters.yaml      # uid, oid, did, pid, page, limit, qty, role
│   ├── responses.yaml       # respuestas de error reutilizables (404, 403, 413, 500, cantidades inválidas…)
│   └── examples.yaml        # un ejemplo por cada error, con el mismo code, message y details de la API
└── paths/                   # un archivo por módulo
    ├── users.yaml   orders.yaml   deliveries.yaml   mocks.yaml
    └── logger.yaml  products.yaml health.yaml
```

`app.js` solo monta el resultado:

```js
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
```

`swagger.js` usa `failOnErrors: true`, así que un YAML mal escrito frena el arranque con un error que indica el archivo y la línea, en lugar de publicar una documentación incompleta.

### Aclaraciones para probar los endpoints desde Swagger

- **Orden sugerido**: primero `POST /api/mocks/seed` (tag `Mocks`) para tener datos; después `GET /api/orders` o `GET /api/deliveries` y copiar un `_id` para probar los endpoints `/{oid}` y `/{did}`. Al terminar, `DELETE /api/mocks/seed` borra solo los datos de prueba.
- Los endpoints de carga de mocks **no reciben body**: las cantidades van como parámetros de query (`qty`, o `users`, `couriers` y `orders` en `/seed`), cada una entre 1 y 100.
- La escritura de mocks (`POST`/`DELETE /api/mocks/seed…`) responde `403 MOCK_SEED_FORBIDDEN` con `NODE_ENV=production`. Para probarla, levantar el servidor con `NODE_ENV=development`.
- Swagger UI valida en el navegador que los parámetros numéricos sean enteros, así que no deja enviar `qty=abc` o `qty=2.5`. Para ver `MOCK_INVALID_QUANTITY` se puede usar `curl` (ver [Cómo probar los casos inválidos](#cómo-probar-los-casos-inválidos)); los negativos (`-5`) y fuera de rango (`0`, `1000`) sí se pueden probar desde Swagger.
- Los filtros de estado, prioridad y rol son texto libre (aceptan minúsculas), así que también se pueden probar valores inválidos como `status=volando`.
- Un id con formato inválido (por ejemplo `123`) responde `404`, igual que uno inexistente.
- `DELETE /api/users/{uid}` y `DELETE /api/products/{pid}` responden `204` sin body.
- Fuera de producción, los errores con causa técnica (`500`, `INVALID_JSON`) agregan `details.cause`; en producción `details` no la incluye.

## Manejo de errores

Ninguna ruta ni controller arma respuestas de error: todo error termina en el middleware global `errorHandler`, que es el único punto de la API que responde ante una falla.

### Estructura de la respuesta de error

Todos los errores, de cualquier módulo, responden con la misma forma:

```json
{
  "status": "error",
  "code": "USER_NOT_FOUND",
  "message": "Usuario con id \"123\" no encontrado.",
  "details": { "id": "123" }
}
```

| Campo     | Descripción |
| --------- | ----------- |
| `status`  | Siempre `"error"` (las respuestas correctas usan `"success"` y `payload`). |
| `code`    | Identificador estable del error, tomado del diccionario. Es lo que debería leer el cliente para decidir qué hacer. |
| `message` | Explicación legible del problema. |
| `details` | Datos extra del caso (campos faltantes, valores permitidos, parámetro recibido, etc.) o `null`. Siempre está presente. |

El status HTTP de la respuesta también sale del diccionario.

### Las tres piezas

```
src/errors/
├── errorDictionary.js   # diccionario: code + status HTTP + mensaje por defecto de cada error
├── AppError.js          # clase base; se construye a partir de una entrada del diccionario
├── customErrors.js      # errores del dominio: UserNotFoundError, InvalidStatusError, NegativeMockQuantityError…
└── index.js
src/middlewares/errorHandler.js   # middleware global
```

Cómo se reparte el trabajo entre capas:

1. **Service**: detecta el caso inválido y lanza el error del dominio. No sabe nada de `res`.

   ```js
   if (!user) throw new UserNotFoundError(id);
   ```

2. **Controller**: no tiene `try/catch` ni respuestas de error. Los métodos son `async` y Express 5 deriva automáticamente cualquier promesa rechazada al middleware de errores (equivale a `next(error)`).
3. **`errorHandler`**: convierte el error en la respuesta final. Si el error no es propio, lo traduce a uno del diccionario:

   | Lo que llega                                   | Se responde como             |
   | ---------------------------------------------- | ---------------------------- |
   | Error personalizado (`AppError`)               | su propio `code` y status    |
   | `ValidationError` / `CastError` de Mongoose    | `VALIDATION_ERROR` (400)     |
   | Clave duplicada de MongoDB (`E11000`)          | `DUPLICATE_KEY` (409)        |
   | Body con JSON mal formado                      | `INVALID_JSON` (400)         |
   | Ruta inexistente (`notFoundHandler` la deriva) | `ROUTE_NOT_FOUND` (404)      |
   | Cualquier otra cosa                            | `INTERNAL_SERVER_ERROR` (500) |

Cada error que pasa por el middleware queda registrado con el logger: los `4xx` como `warning` y los `5xx` como `error`, con el stack de la causa original (ver [Logging](#logging)). La causa técnica (por ejemplo, el mensaje del driver de MongoDB) se agrega en `details.cause` solo fuera de producción; con `NODE_ENV=production` nunca se expone.

### Diccionario de errores

| `code`                           | HTTP | Cuándo ocurre |
| -------------------------------- | ---- | ------------- |
| `VALIDATION_ERROR`               | 400  | Un campo tiene formato o valor inválido (email, precio, stock, edad…) |
| `MISSING_REQUIRED_FIELDS`        | 400  | Faltan campos obligatorios al crear |
| `BLANK_REQUIRED_FIELDS`          | 400  | Se intenta dejar vacío un campo obligatorio al actualizar |
| `INVALID_FIELD_TYPE`             | 400  | Un campo de texto (`email`, `password`, `code`, `title`…) llega como array, objeto o número |
| `NO_FIELDS_TO_UPDATE`            | 400  | Un `PUT` sin ningún campo editable |
| `INVALID_ROLE`                   | 400  | Rol fuera de `USER_ROLES` |
| `INVALID_STATUS`                 | 400  | Estado inválido de producto, pedido o entrega |
| `INVALID_PRIORITY`               | 400  | Prioridad de pedido inválida |
| `USER_NOT_FOUND`                 | 404  | Usuario inexistente |
| `PRODUCT_NOT_FOUND`              | 404  | Producto inexistente |
| `ORDER_NOT_FOUND`                | 404  | Pedido inexistente |
| `DELIVERY_NOT_FOUND`             | 404  | Entrega inexistente |
| `USER_EMAIL_ALREADY_REGISTERED`  | 409  | Email ya registrado |
| `PRODUCT_CODE_ALREADY_EXISTS`    | 409  | Código de producto repetido |
| `LAST_ADMIN_REQUIRED`            | 409  | Se intenta degradar o eliminar al último `ADMIN` |
| `MOCK_INVALID_QUANTITY`          | 400  | La cantidad de mocks no es un entero (`abc`, `2.5`, parámetro repetido) |
| `MOCK_NEGATIVE_QUANTITY`         | 400  | La cantidad de mocks es negativa |
| `MOCK_QUANTITY_OUT_OF_RANGE`     | 400  | La cantidad de mocks es `0` o supera `MOCKS.MAX_QTY` (100) |
| `MOCK_SEED_FORBIDDEN`            | 403  | Se intenta cargar o limpiar datos de prueba en producción |
| `MOCK_SEED_REQUIREMENTS_NOT_MET` | 409  | Se piden pedidos sin clientes y repartidores de prueba cargados |
| `MOCK_GENERATION_FAILED`         | 500  | Falla al generar los datos simulados |
| `MOCK_SEED_FAILED`               | 500  | Falla de MongoDB durante la carga de datos de prueba |
| `MOCK_CLEAR_FAILED`              | 500  | Falla de MongoDB al limpiar los datos de prueba |
| `ROUTE_NOT_FOUND`                | 404  | Ruta inexistente |
| `INVALID_JSON`                   | 400  | El body no es un JSON válido |
| `PAYLOAD_TOO_LARGE`              | 413  | El body supera el tamaño permitido |
| `BAD_REQUEST`                    | 400  | Otra solicitud mal formada (ej. parámetro de URL mal codificado) |
| `DUPLICATE_KEY`                  | 409  | Clave única repetida detectada por MongoDB |
| `INTERNAL_SERVER_ERROR`          | 500  | Error no previsto |

### Cómo probar los casos inválidos

Con el servidor levantado (`npm run dev`), cada comando devuelve el `code` indicado:

```bash
# Recursos inexistentes y rutas
curl "http://localhost:8080/api/users/123"                          # 404 USER_NOT_FOUND
curl "http://localhost:8080/api/orders/64b7f0000000000000000000"    # 404 ORDER_NOT_FOUND
curl "http://localhost:8080/api/no-existe"                          # 404 ROUTE_NOT_FOUND

# Filtros inválidos
curl "http://localhost:8080/api/orders?status=volando"              # 400 INVALID_STATUS
curl "http://localhost:8080/api/orders?priority=ya"                 # 400 INVALID_PRIORITY
curl "http://localhost:8080/api/users?role=jefe"                    # 400 INVALID_ROLE

# Datos inválidos en el body
curl -X POST http://localhost:8080/api/users -H "Content-Type: application/json" \
  -d '{"first_name":"Ana"}'                                         # 400 MISSING_REQUIRED_FIELDS
curl -X POST http://localhost:8080/api/users -H "Content-Type: application/json" \
  -d '{"first_name":"Ana","last_name":"Paz","email":"mal","password":"123456"}'   # 400 VALIDATION_ERROR
curl -X POST http://localhost:8080/api/users -H "Content-Type: application/json" \
  -d '{"first_name":'                                               # 400 INVALID_JSON
curl -X POST http://localhost:8080/api/users -H "Content-Type: application/json"   -d '{"first_name":"Ana","last_name":"Paz","email":["ana@mail.com"],"password":"123456"}'   # 400 INVALID_FIELD_TYPE
curl -X POST http://localhost:8080/api/products -H "Content-Type: application/json"   -d '{"title":"Caja","code":{"$ne":null},"price":10,"category":"embalaje"}'      # 400 INVALID_FIELD_TYPE
curl -X POST http://localhost:8080/api/products -H "Content-Type: application/json" \
  -d '{"title":"Caja","code":"BOX","price":-1,"category":"embalaje"}'             # 400 VALIDATION_ERROR
```

Para `409 USER_EMAIL_ALREADY_REGISTERED`, registrar dos veces el mismo usuario.

**Módulo de mocks** (cantidad inválida, valores negativos y límites):

```bash
curl "http://localhost:8080/api/mocks/users?qty=abc"                # 400 MOCK_INVALID_QUANTITY
curl "http://localhost:8080/api/mocks/users?qty=2.5"                # 400 MOCK_INVALID_QUANTITY
curl "http://localhost:8080/api/mocks/users?qty=-5"                 # 400 MOCK_NEGATIVE_QUANTITY
curl "http://localhost:8080/api/mocks/orders?qty=0"                 # 400 MOCK_QUANTITY_OUT_OF_RANGE
curl "http://localhost:8080/api/mocks/deliveries?qty=1000"          # 400 MOCK_QUANTITY_OUT_OF_RANGE
curl "http://localhost:8080/api/mocks/users?qty=2&role=jefe"        # 400 INVALID_ROLE
curl -X POST "http://localhost:8080/api/mocks/seed?users=-1"        # 400 MOCK_NEGATIVE_QUANTITY
curl -X POST "http://localhost:8080/api/mocks/seed?orders=999"      # 400 MOCK_QUANTITY_OUT_OF_RANGE
curl -X POST "http://localhost:8080/api/mocks/seed/orders?qty=5"    # 409 MOCK_SEED_REQUIREMENTS_NOT_MET (sin usuarios de prueba cargados)
```

Ejemplo de respuesta:

```json
{
  "status": "error",
  "code": "MOCK_NEGATIVE_QUANTITY",
  "message": "\"qty\" no puede ser negativo. Debe ser un entero entre 1 y 100.",
  "details": { "param": "qty", "received": "-5", "min": 1, "max": 100 }
}
```

**Falla durante la carga en MongoDB.** Con el servidor ya levantado, detener MongoDB y pedir una carga:

```bash
curl -X POST "http://localhost:8080/api/mocks/seed"                 # 500 MOCK_SEED_FAILED (tarda unos segundos)
```

```json
{
  "status": "error",
  "code": "MOCK_SEED_FAILED",
  "message": "No se pudieron cargar los datos de prueba en la colección \"users\".",
  "details": { "collection": "users", "rolledBack": false, "cause": "connect ECONNREFUSED 127.0.0.1:27017" }
}
```

El service envuelve cada paso de la carga: si MongoDB falla, no deja pasar el error crudo de Mongoose sino que responde `MOCK_SEED_FAILED` indicando la colección. Además, si la carga falla a mitad de camino (por ejemplo, se insertaron usuarios y pedidos pero fallan las entregas), borra por id lo que esa misma carga había insertado para no dejar datos a medias; `details.rolledBack` indica si pudo hacerlo (es `false` cuando la base está caída). Para que la respuesta no demore, la conexión usa `serverSelectionTimeoutMS` de 5 s.

Con `NODE_ENV=production`, cualquier `POST`/`DELETE` de `/api/mocks/seed` responde `403 MOCK_SEED_FORBIDDEN`.

## Logging

ShipNow usa **[Winston](https://github.com/winstonjs/winston)** como logger centralizado, con **winston-daily-rotate-file** para la rotación. No quedan `console.log` en el código: todo pasa por el logger.

### Configuración centralizada

La configuración vive en un solo módulo, `src/logger/logger.js` (niveles, colores, formato, transports y rotación). El resto del proyecto solo lo importa:

```js
import logger from '../logger/index.js';

logger.info(`Producto creado: ${product._id}`);
logger.warning('Se perdió la conexión con MongoDB');
```

Formato de cada línea (igual en consola y en archivos; en desarrollo la consola va con colores):

```
2026-10-14 18:25:10 [info]    Conexión a MongoDB establecida (localhost:27017/shipnow)
2026-10-14 18:25:10 [info]    Servidor ShipNow escuchando en el puerto 8080 (development)
2026-10-14 18:25:11 [warning] GET /api/orders/64b7f0000000000000000000 → 404 ORDER_NOT_FOUND: Pedido con id "64b7f0000000000000000000" no encontrado. {"details":{"id":"64b7f0000000000000000000"}}
2026-10-14 18:25:59 [error]   GET /api/orders → 500 INTERNAL_SERVER_ERROR: Error interno del servidor.
TypeError: Cannot read properties of undefined (reading "x")
    at ...
```

Los datos extra del log (por ejemplo, los `details` del error) se agregan en JSON al final de la línea, y en los errores `5xx` el stack va en las líneas siguientes.

### Niveles

| Nivel     | Prioridad | Para qué se usa en ShipNow |
| --------- | --------- | -------------------------- |
| `fatal`   | 0         | La app no puede arrancar: configuración inválida o falla en la conexión inicial a MongoDB |
| `error`   | 1         | Errores inesperados del servidor (`5xx`), falla al deshacer una carga de mocks, errores de la conexión a MongoDB |
| `warning` | 2         | Errores esperados o de negocio (`4xx`): datos inválidos, cantidad inválida en mocks, pedido no encontrado, ruta inexistente; MongoDB desconectado; carga de mocks deshecha |
| `info`    | 3         | Eventos normales importantes: servidor iniciado, conexión a MongoDB, usuario registrado o eliminado, cambio de rol, producto creado o dado de baja, carga y limpieza de datos de prueba (pedidos creados) |
| `http`    | 4         | Una línea por request: método, ruta, status y duración (`requestLogger`) |
| `debug`   | 5         | Información de desarrollo: generación de datos simulados en `GET /api/mocks/*` |

Cada transport registra su nivel **y todos los más graves**. Por ejemplo, un transport en `info` registra `info`, `warning`, `error` y `fatal`.

### Comportamiento según el entorno

El nivel mínimo sale de `NODE_ENV` (la misma variable de entorno del Módulo 1):

| `NODE_ENV`    | Nivel mínimo | Qué se ve |
| ------------- | ------------ | --------- |
| `development` | `debug`      | Todo, con colores en consola |
| `production`  | `info`       | `info`, `warning`, `error` y `fatal`, sin colores |
| `test`        | `warning`    | Solo advertencias y errores, para no ensuciar la salida de los tests |

Además, en producción la respuesta de error nunca incluye `details.cause`: el detalle técnico queda solo en los logs.

### Archivos y rotación

| Archivo                   | Qué guarda | Rotación |
| ------------------------- | ---------- | -------- |
| `logs/error.log`          | Solo `error` y `fatal` | Por tamaño: al llegar a 5 MB pasa a `error1.log`, `error2.log`… y se conservan 5 archivos (el más reciente siempre es `error.log`) |
| `logs/app-AAAA-MM-DD.log` | Todos los logs desde el nivel mínimo del entorno | Por fecha: un archivo por día (o cada 20 MB); los anteriores se comprimen (`.gz`) y se borran a los **14 días** |
| `logs/.app-audit.json`    | Registro interno de winston-daily-rotate-file para saber qué archivos borrar | — |

La carpeta `logs/` se resuelve desde la raíz del proyecto (no depende del directorio desde el que se ejecute `node`) y se crea sola si no existe.

### Qué se ignora en Git

```gitignore
*.log
logs/*
!logs/.gitkeep
```

La carpeta `logs/` queda en el repositorio solo con un `.gitkeep` vacío. Los archivos que genera la app (`error.log`, `app-*.log`, los `.gz` rotados y el audit) no se suben.

### Endpoint de prueba — `GET /api/loggerTest`

Es una herramienta interna para validar la configuración, no una funcionalidad del negocio. Genera un log de cada nivel (`debug`, `http`, `info`, `warning`, `error`, `fatal`) con el prefijo `[loggerTest]` y responde qué niveles se registraron según el entorno:

```bash
curl "http://localhost:8080/api/loggerTest"
```

```json
{
  "status": "success",
  "payload": {
    "nivelMinimo": "debug",
    "registrados": ["debug", "http", "info", "warning", "error", "fatal"],
    "omitidos": [],
    "enErrorLog": ["error", "fatal"]
  }
}
```

**Cómo validar que funciona:**

1. **Consola**: con `NODE_ENV=development` aparecen las 6 líneas, cada nivel con su color:

   ```
   2026-10-14 18:25:11 [debug]   [loggerTest] Detalle de depuración: filtro de pedidos { status: "PENDING", page: 1 }
   2026-10-14 18:25:11 [http]    [loggerTest] GET /api/orders/A-102 200 - 8.4 ms
   2026-10-14 18:25:11 [info]    [loggerTest] Pedido #A-102 creado correctamente
   2026-10-14 18:25:11 [warning] [loggerTest] Pedido #A-102 sin repartidor asignado
   2026-10-14 18:25:11 [error]   [loggerTest] Falló la creación del pedido: ValidationError (campo "destino" requerido)
   2026-10-14 18:25:11 [fatal]   [loggerTest] Se perdió la conexión con MongoDB y no se pudo restablecer
   2026-10-14 18:25:11 [http]    GET /api/loggerTest 200 - 8.2 ms
   ```

2. **`logs/error.log`**: solo tiene las líneas `[error]` y `[fatal]`, nunca `info` ni `debug`.
3. **`logs/app-AAAA-MM-DD.log`** (fecha del día): tiene todas las líneas que salieron por consola.
4. **Producción**: con `NODE_ENV=production`, el endpoint responde `"nivelMinimo": "info"` y `"omitidos": ["debug", "http"]`, y esas dos líneas no aparecen ni en consola ni en archivos.

Otros eventos para ver en los logs:

```bash
curl "http://localhost:8080/api/mocks/users?qty=abc"           # warning: MOCK_INVALID_QUANTITY con el valor recibido
curl "http://localhost:8080/api/no-existe"                     # warning: ROUTE_NOT_FOUND
curl -X POST "http://localhost:8080/api/mocks/seed?orders=5"   # info: carga completa (pedidos creados)
```

Para ver un `fatal` real, arrancar con MongoDB apagado o con una variable de entorno inválida (ver [Si falta una variable](#si-falta-una-variable)):

```
2026-10-14 18:25:54 [fatal]   No se pudo iniciar la aplicación: Error al conectar con MongoDB: connect ECONNREFUSED 127.0.0.1:27017
```

Si el arranque falla después de conectar a MongoDB (por ejemplo, con el puerto ocupado), `server.js` registra el `fatal`, cierra la conexión con `disconnectDB` y el proceso termina con código 1 en lugar de quedar colgado:

```
2026-10-23 15:49:33 [info]    Conexión a MongoDB establecida (localhost:27017/shipnow)
2026-10-23 15:49:33 [fatal]   No se pudo iniciar la aplicación: listen EADDRINUSE: address already in use :::8080
2026-10-23 15:49:33 [info]    Conexión a MongoDB cerrada
```

### Cómo se reparte por capas

```
logger/logger.js                 → configuración única (niveles, formato, transports, rotación)
middlewares/requestLogger.js     → nivel http: una línea por request
middlewares/errorHandler.js      → warning para 4xx, error (con stack) para 5xx; la respuesta al cliente no cambia
server.js / db/connection.js     → arranque, conexión a MongoDB y sus cambios de estado; fatal si no puede iniciar
services/*.service.js            → eventos del negocio (info) y de los mocks (debug / info)
controllers/logger.controller.js → endpoint de prueba
```

El logger complementa al manejo de errores, no lo reemplaza: el `errorHandler` sigue siendo el único que arma la respuesta, y además deja registro de cada error.

## Módulo de mocking — `/api/mocks`

Genera **usuarios (clientes), repartidores, pedidos y entregas** con [Faker](https://fakerjs.dev/) respetando los modelos reales y las constantes del dominio. Hay dos tipos de endpoints:

- **`GET`** → solo **devuelven** datos simulados. No escriben nada en la base.
- **`POST` / `DELETE`** → **insertan** (o limpian) datos de prueba en MongoDB.

### Endpoints que solo devuelven datos (no guardan)

| Método | Ruta                    | Query                                  | Devuelve |
| ------ | ----------------------- | -------------------------------------- | -------- |
| GET    | `/api/mocks/users`      | `qty` (1–100, def. 10), `role` opcional | Array de usuarios. Sin `role`, el rol sale al azar entre `USER` y `COURIER` |
| GET    | `/api/mocks/couriers`   | `qty`                                  | Array de usuarios con rol `COURIER` |
| GET    | `/api/mocks/orders`     | `qty`                                  | `{ customers, orders }`: los pedidos referencian a esos clientes |
| GET    | `/api/mocks/deliveries` | `qty`                                  | `{ customers, couriers, orders, deliveries }`: set completo y relacionado |

Ejemplo:

```bash
curl "http://localhost:8080/api/mocks/users?qty=2"
```

```json
{
  "status": "success",
  "payload": [
    {
      "_id": "3d205b75baae97da7cd9fa18",
      "first_name": "Mario",
      "last_name": "Miramontes Jaimes",
      "email": "mario.miramontesjaimes.9ab0a@shipnow.test",
      "age": 53,
      "role": "USER"
    },
    {
      "_id": "c08d33103c1fc58a2f7950fe",
      "first_name": "Alejandra",
      "last_name": "Galarza Báez",
      "email": "alejandra.galarzabaez.4hi9o@shipnow.test",
      "age": 27,
      "role": "COURIER"
    }
  ]
}
```

### Endpoints que insertan en MongoDB

| Método | Ruta                       | Query                                                      | Respuesta (`payload`) |
| ------ | -------------------------- | ---------------------------------------------------------- | --------------------- |
| POST   | `/api/mocks/seed`          | `users` (def. 10), `couriers` (def. 3), `orders` (def. 20) | `{ insertados: { users, couriers, orders, deliveries } }` |
| POST   | `/api/mocks/seed/users`    | `qty`, `role` opcional                                     | `{ insertados: 10, coleccion: "users" }` |
| POST   | `/api/mocks/seed/couriers` | `qty`                                                      | `{ insertados: 3, coleccion: "users", rol: "COURIER" }` |
| POST   | `/api/mocks/seed/orders`   | `qty`                                                      | `{ insertados: 5, coleccion: "orders", entregas: 5 }` |
| DELETE | `/api/mocks/seed`          | —                                                          | `{ eliminados: { users, orders, deliveries } }` |

### Cómo usar la carga de datos de prueba

**Opción 1: todo de una vez** (recomendada). Crea clientes, repartidores, pedidos de esos clientes y una entrega por pedido:

```bash
curl -X POST "http://localhost:8080/api/mocks/seed?users=10&couriers=3&orders=20"
# { "status": "success", "payload": { "insertados": { "users": 10, "couriers": 3, "orders": 20, "deliveries": 20 } } }
```

**Opción 2: paso a paso.** Los pedidos se generan para los clientes y repartidores de prueba que ya estén en la base, así que hay que cargarlos primero:

```bash
curl -X POST "http://localhost:8080/api/mocks/seed/users?qty=10"
curl -X POST "http://localhost:8080/api/mocks/seed/couriers?qty=3"
curl -X POST "http://localhost:8080/api/mocks/seed/orders?qty=5"
```

Si se piden pedidos sin haber cargado usuarios de prueba, responde `409 MOCK_SEED_REQUIREMENTS_NOT_MET` con un mensaje que indica qué cargar.

**Verificar lo insertado** con los endpoints normales de la API:

```bash
curl "http://localhost:8080/api/users?role=COURIER"
curl "http://localhost:8080/api/orders?status=DELIVERED"      # trae el cliente populado
curl "http://localhost:8080/api/deliveries?status=IN_TRANSIT" # trae pedido y repartidor populados
```

**Limpiar** los datos de prueba (no toca datos reales):

```bash
curl -X DELETE "http://localhost:8080/api/mocks/seed"
```

Los usuarios que se cargan en la base tienen la contraseña `coder123`, guardada hasheada con bcrypt. El hash se genera solo en la carga (`POST /api/mocks/seed…`): los `GET` de mocks devuelven los usuarios sin contraseña.

### Carga controlada

- `qty` (y `users`, `couriers`, `orders`) debe ser un entero entre 1 y `MOCKS.MAX_QTY` (100); si no, responde `400` con un código distinto según el motivo: `MOCK_INVALID_QUANTITY` (no es un entero), `MOCK_NEGATIVE_QUANTITY` (negativo) o `MOCK_QUANTITY_OUT_OF_RANGE` (0 o más del máximo). `role` se valida contra `USER_ROLES` (`INVALID_ROLE`).
- Los endpoints de escritura responden **`403 MOCK_SEED_FORBIDDEN` si `NODE_ENV=production`**.
- Si MongoDB falla durante la carga, responde `500 MOCK_SEED_FAILED` y deshace lo que esa carga haya llegado a insertar. Ver [cómo probar los casos inválidos](#cómo-probar-los-casos-inválidos).
- Todos los usuarios de prueba usan el dominio `@shipnow.test` (`MOCKS.EMAIL_DOMAIN`). `POST /seed/orders` solo usa usuarios de prueba, y `DELETE /seed` borra solo esos usuarios, sus pedidos y sus entregas.
- Los emails llevan un sufijo aleatorio para no chocar con el índice único.
- La inserción usa `insertMany`, que corre las validaciones de los esquemas de Mongoose (enums, `required`, etc.).

### Reglas de consistencia de los datos generados

| Entidad    | Reglas |
| ---------- | ------ |
| Usuario    | Misma forma que `UserModel` (`first_name`, `last_name`, `email`, `age`, `role`). El `password` (hash de `coder123`) se agrega solo al insertarlos con los seed. El rol siempre sale de `USER_ROLES`. |
| Repartidor | Es un usuario con rol `USER_ROLES.COURIER`. |
| Pedido     | `customer` referencia a un usuario `USER`. `status` sale de `ORDER_STATUS` y `priority` de `ORDER_PRIORITY`. El `total` se calcula a partir de los ítems. `createdAt` cae en los últimos 30 días. |
| Entrega    | Una por pedido (`order` es único). El `status` **no es aleatorio**: se deriva del estado del pedido con `DELIVERY_STATUS_BY_ORDER_STATUS`. Lleva `courier` solo si el estado está en `DELIVERY_STATUSES_WITH_COURIER` (el esquema también lo exige). Las fechas nunca son anteriores a la creación del pedido: la entrega se crea junto con él (`createdAt` igual), `estimatedAt` se calcula desde esa fecha según la prioridad y `deliveredAt` (solo si fue entregada) cae entre la creación del pedido y hoy. |

| Estado del pedido | Estado de la entrega | Repartidor |
| ----------------- | -------------------- | ---------- |
| `PENDING`         | `WAITING_COURIER`    | no         |
| `ASSIGNED`        | `ASSIGNED`           | sí         |
| `IN_TRANSIT`      | `IN_TRANSIT`         | sí         |
| `DELIVERED`       | `DELIVERED`          | sí         |
| `CANCELLED`       | `CANCELLED`          | no         |

### Cómo se reparte por capas

```
mocks.router.js     → solo path → método del controller
mock.controller.js  → lee query params, llama al service, elige 200/201
mock.service.js     → valida qty/rol, bloquea producción, arma las relaciones, decide qué insertar
                      y lanza los errores del dominio (cantidad inválida, falla de generación o de carga)
mocks/*.mock.js     → generadores puros con Faker (no conocen Express ni Mongoose)
*.repository.js     → insertMany / deleteMany / búsqueda de ids
*.model.js          → esquemas que validan lo que se inserta
```

## Endpoints

Todas las respuestas tienen la forma `{ status: 'success', payload }` o `{ status: 'error', code, message, details }` (ver [Manejo de errores](#manejo-de-errores)).

### Productos — `/api/products`

| Método | Ruta    | Descripción                                                                        |
| ------ | ------- | ---------------------------------------------------------------------------------- |
| GET    | `/`     | Lista productos. Query: `page`, `limit`, `category`, `status` (`AVAILABLE` por defecto u `OUT_OF_STOCK`) |
| GET    | `/:pid` | Obtiene un producto                                                                |
| POST   | `/`     | Crea un producto (`title`, `code`, `price`, `category` obligatorios; `description`, `stock` opcionales) |
| PUT    | `/:pid` | Actualiza campos de un producto                                                    |
| DELETE | `/:pid` | Baja lógica (pasa a `DISCONTINUED`)                                                |

### Usuarios — `/api/users`

| Método | Ruta         | Descripción                                                                   |
| ------ | ------------ | ----------------------------------------------------------------------------- |
| GET    | `/`          | Lista usuarios. Query: `page`, `limit`, `role`                                |
| GET    | `/:uid`      | Obtiene un usuario                                                            |
| POST   | `/`          | Registra un usuario (`first_name`, `last_name`, `email`, `password`; `age` opcional) |
| PUT    | `/:uid`      | Actualiza datos del usuario                                                   |
| PATCH  | `/:uid/role` | Cambia el rol (`{ "role": "ADMIN" }`, `"USER"` o `"COURIER"`)                 |
| DELETE | `/:uid`      | Elimina un usuario                                                            |

Roles válidos: `ADMIN`, `USER` (cliente) y `COURIER` (repartidor).

### Pedidos — `/api/orders` (solo lectura)

| Método | Ruta    | Descripción                                                                         |
| ------ | ------- | ----------------------------------------------------------------------------------- |
| GET    | `/`     | Lista pedidos con el cliente populado. Query: `page`, `limit`, `status`, `priority` |
| GET    | `/:oid` | Obtiene un pedido                                                                   |

### Entregas — `/api/deliveries` (solo lectura)

| Método | Ruta    | Descripción                                                                        |
| ------ | ------- | ---------------------------------------------------------------------------------- |
| GET    | `/`     | Lista entregas con pedido y repartidor populados. Query: `page`, `limit`, `status` |
| GET    | `/:did` | Obtiene una entrega                                                                |

### Herramientas internas

| Método | Ruta              | Descripción |
| ------ | ----------------- | ----------- |
| GET    | `/api/health`     | Verifica que el servidor responde |
| GET    | `/api/loggerTest` | Genera un log de cada nivel (ver [Endpoint de prueba](#endpoint-de-prueba--get-apiloggertest)) |
| GET    | `/api/docs`       | Documentación interactiva con Swagger UI (ver [Documentación de la API](#documentación-de-la-api-swagger)) |
| GET    | `/api/docs.json`  | Especificación OpenAPI en JSON |

Ejemplo:

```bash
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{"title":"Caja chica","code":"BOX-S","price":1500,"stock":10,"category":"embalaje"}'
```

## ¿Por qué separar así Service y Repository?

La regla que seguí: **el Repository sabe _cómo_ se guardan y buscan los datos; el Service decide _qué_ se hace con ellos.**

**Repository** (acceso a datos, sin decisiones de negocio):

- Es el único que importa Mongoose. Si mañana cambia la base, solo se tocan `repositories/` y `models/`.
- Encapsula detalles de persistencia que no deberían filtrarse hacia arriba, así que no es un simple "pasamanos" de `model.find()`:
  - **Filtro por defecto**: `ProductRepository` nunca devuelve productos `DISCONTINUED` (la baja lógica es un detalle de almacenamiento).
  - **Proyecciones**: `UserRepository` excluye siempre el hash de la contraseña, salvo que se pida explícitamente (`findByEmail(email, { includePassword: true })`, pensado para el futuro login).
  - **Paginación y conteo** en paralelo, `lean()` para devolver objetos planos.
  - Un id con formato inválido devuelve `null` en lugar de romper con un `CastError` de Mongoose.

**Service** (reglas del negocio, sin saber nada de MongoDB):

- **El estado del producto se deriva del stock**: con stock > 0 es `AVAILABLE`, si no, `OUT_OF_STOCK`. El cliente no puede forzar el estado.
- **El catálogo por defecto solo muestra productos con stock**; se puede pedir `OUT_OF_STOCK` explícitamente.
- **Unicidad** de `code` de producto y `email` de usuario (responde 409).
- **Todo usuario nuevo es `USER`**: el rol solo se cambia por `PATCH /:uid/role`, validado contra `USER_ROLES`.
- **Nunca se puede quedar el sistema sin administradores**: no se puede degradar ni eliminar al último `ADMIN`.
- **Hash de contraseñas** con bcrypt antes de persistir.
- Validación de datos de entrada y *whitelist* de campos editables.

Con esta división, los Services reciben su Repository por constructor, así que se pueden testear con un repositorio falso sin levantar MongoDB.

## Constantes

`src/constants/index.js` concentra los valores del dominio en objetos congelados con `Object.freeze`, para no usar strings sueltos:

```js
USER_ROLES      = { ADMIN, USER, COURIER }
PRODUCT_STATUS  = { AVAILABLE, OUT_OF_STOCK, DISCONTINUED }
ORDER_STATUS    = { PENDING, ASSIGNED, IN_TRANSIT, DELIVERED, CANCELLED }
ORDER_PRIORITY  = { LOW, NORMAL, HIGH, URGENT }
DELIVERY_STATUS = { WAITING_COURIER, ASSIGNED, IN_TRANSIT, DELIVERED, CANCELLED }
DELIVERY_STATUS_BY_ORDER_STATUS  // estado de la entrega según el del pedido
DELIVERY_STATUSES_WITH_COURIER   // estados que exigen repartidor
HTTP_STATUS     = { OK, CREATED, NO_CONTENT, BAD_REQUEST, FORBIDDEN, NOT_FOUND, CONFLICT, PAYLOAD_TOO_LARGE, INTERNAL_SERVER_ERROR }
PAGINATION      = { DEFAULT_LIMIT, MAX_LIMIT }
MOCKS           = { DEFAULT_QTY, MAX_QTY, EMAIL_DOMAIN, PASSWORD, RANDOM_ROLES, DATASET }
```

Los modelos usan `Object.values(...)` de estas constantes para definir los `enum`, así el esquema y la lógica nunca se desincronizan. Los generadores de mocks también toman de acá roles, estados y prioridades: no hay strings de dominio escritos a mano.
