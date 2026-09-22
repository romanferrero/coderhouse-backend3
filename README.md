# ShipNow API

API REST de ShipNow para la gestión de **productos** y **usuarios**, refactorizada a una arquitectura por capas (**Router → Controller → Service → Repository → Model**) con configuración de entorno centralizada y validada al arranque.

> Pre-entrega Módulo 1 — Backend III (Coderhouse).

## Stack

- Node.js ≥ 20 (ES Modules)
- Express 5
- MongoDB + Mongoose
- dotenv
- bcryptjs (hash de contraseñas)

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
│   └── index.js           # USER_ROLES, PRODUCT_STATUS, HTTP_STATUS, PAGINATION (Object.freeze)
├── controllers/           # req/res: leen parámetros, llaman al Service y eligen el status code
├── services/              # lógica y reglas de negocio
├── repositories/          # único lugar que usa Mongoose (consultas, filtros, proyecciones)
├── models/                # solo esquemas de Mongoose
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
| PATCH  | `/:uid/role` | Cambia el rol (`{ "role": "ADMIN" }` o `"USER"`)                              |
| DELETE | `/:uid`      | Elimina un usuario                                                            |

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
USER_ROLES     = { ADMIN, USER }
PRODUCT_STATUS = { AVAILABLE, OUT_OF_STOCK, DISCONTINUED }
HTTP_STATUS    = { OK, CREATED, NO_CONTENT, BAD_REQUEST, NOT_FOUND, CONFLICT, INTERNAL_SERVER_ERROR }
PAGINATION     = { DEFAULT_LIMIT, MAX_LIMIT }
```

Los modelos usan `Object.values(...)` de estas constantes para definir los `enum`, así el esquema y la lógica nunca se desincronizan.
