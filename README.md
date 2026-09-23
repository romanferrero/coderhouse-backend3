# ShipNow API

API REST de ShipNow para la gestión de **productos**, **usuarios** (clientes y repartidores), **pedidos** y **entregas**, con arquitectura por capas (**Router → Controller → Service → Repository → Model**), configuración de entorno centralizada y un **módulo de mocking** para generar y cargar datos de prueba.

> Pre-entregas Módulo 1 (arquitectura por capas) y Módulo 2 (mocking y carga de datos) — Backend III (Coderhouse).

- [Cómo correrlo localmente](#cómo-correrlo-localmente)
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

### Si falta una variable

La app **no arranca** si falta o es inválida alguna variable crítica. Por ejemplo, con `MONGODB_URI` vacía:

```
Error: [config] Faltan variables de entorno obligatorias: MONGODB_URI. Revisá tu archivo .env (podés tomar .env.example como referencia).
```

## Estructura del proyecto

```
src/
├── config/
│   ├── env.config.js      # carga dotenv, valida y exporta la config congelada
│   └── index.js           # re-export de la config
├── constants/
│   └── index.js           # roles, estados, prioridades, HTTP_STATUS, MOCKS (Object.freeze)
├── controllers/           # req/res: leen parámetros, llaman al Service y eligen el status code
├── services/              # lógica y reglas de negocio (incluye mock.service.js)
├── repositories/          # único lugar que usa Mongoose (consultas, filtros, proyecciones)
├── models/                # solo esquemas de Mongoose (user, product, order, delivery)
├── mocks/                 # generadores de datos simulados (funciones puras con Faker)
├── routes/                # path → método del Controller, nada más
├── middlewares/           # 404 y manejo centralizado de errores
├── db/                    # conexión a MongoDB
├── utils/                 # AppError, paginación, helpers
├── app.js                 # instancia de Express
└── server.js              # punto de entrada: conecta la DB y levanta el servidor
```

### Flujo de una request

```
HTTP → Router → Controller → Service → Repository → Model (Mongoose) → MongoDB
                    ↑            │
                    └─ AppError ─┘ → errorHandler → respuesta JSON
```

- Los **Controllers** nunca importan Mongoose: solo conocen al Service.
- Los **Services** lanzan `AppError` con el status adecuado (400, 404, 409); el middleware `errorHandler` lo traduce a la respuesta.
- `process.env` solo se lee en `src/config/env.config.js`.

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
      "password": "$2b$10$XveIH873FWn2sSJr/GF70up//qpIot3m4DngGHM/Rqf3qG5BBmkje",
      "role": "USER"
    },
    {
      "_id": "c08d33103c1fc58a2f7950fe",
      "first_name": "Alejandra",
      "last_name": "Galarza Báez",
      "email": "alejandra.galarzabaez.4hi9o@shipnow.test",
      "age": 27,
      "password": "$2b$10$T5djR3ukyS44bJaeo6umEeW6zuXqQqHIe9qtHI72vg4JzldG5O4.e",
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

Si se piden pedidos sin haber cargado usuarios de prueba, responde `409` con un mensaje que indica qué cargar.

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

Todos los usuarios generados tienen la contraseña `coder123`, guardada hasheada con bcrypt.

### Carga controlada

- `qty` (y `users`, `couriers`, `orders`) debe ser un entero entre 1 y `MOCKS.MAX_QTY` (100); si no, responde `400`. `role` se valida contra `USER_ROLES`.
- Los endpoints de escritura responden **`403` si `NODE_ENV=production`**.
- Todos los usuarios de prueba usan el dominio `@shipnow.test` (`MOCKS.EMAIL_DOMAIN`). `POST /seed/orders` solo usa usuarios de prueba, y `DELETE /seed` borra solo esos usuarios, sus pedidos y sus entregas.
- Los emails llevan un sufijo aleatorio para no chocar con el índice único.
- La inserción usa `insertMany`, que corre las validaciones de los esquemas de Mongoose (enums, `required`, etc.).

### Reglas de consistencia de los datos generados

| Entidad    | Reglas |
| ---------- | ------ |
| Usuario    | Misma forma que `UserModel` (`first_name`, `last_name`, `email`, `age`, `password`, `role`). El rol siempre sale de `USER_ROLES`. |
| Repartidor | Es un usuario con rol `USER_ROLES.COURIER`. |
| Pedido     | `customer` referencia a un usuario `USER`. `status` sale de `ORDER_STATUS` y `priority` de `ORDER_PRIORITY`. El `total` se calcula a partir de los ítems. |
| Entrega    | Una por pedido (`order` es único). El `status` **no es aleatorio**: se deriva del estado del pedido con `DELIVERY_STATUS_BY_ORDER_STATUS`. Lleva `courier` solo si el estado está en `DELIVERY_STATUSES_WITH_COURIER` (el esquema también lo exige). `deliveredAt` solo si fue entregada, y `estimatedAt` depende de la prioridad. |

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
mocks/*.mock.js     → generadores puros con Faker (no conocen Express ni Mongoose)
*.repository.js     → insertMany / deleteMany / búsqueda de ids
*.model.js          → esquemas que validan lo que se inserta
```

## Endpoints

Todas las respuestas tienen la forma `{ status: 'success', payload }` o `{ status: 'error', message }`.

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
HTTP_STATUS     = { OK, CREATED, NO_CONTENT, BAD_REQUEST, FORBIDDEN, NOT_FOUND, CONFLICT, INTERNAL_SERVER_ERROR }
PAGINATION      = { DEFAULT_LIMIT, MAX_LIMIT }
MOCKS           = { DEFAULT_QTY, MAX_QTY, EMAIL_DOMAIN, PASSWORD, RANDOM_ROLES, DATASET }
```

Los modelos usan `Object.values(...)` de estas constantes para definir los `enum`, así el esquema y la lógica nunca se desincronizan. Los generadores de mocks también toman de acá roles, estados y prioridades: no hay strings de dominio escritos a mano.
