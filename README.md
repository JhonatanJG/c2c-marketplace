# C2C Market (modelo simulado)

Implementación en código del **Taller 1 – Sistema Complejo**: marketplace C2C donde cada cliente registrado
puede **vender y comprar** productos. Sigue la arquitectura C4 del Punto 1 (aplicación web multicapa con proxy
inverso) y la misma estructura del proyecto `uninotas-api`: backend y frontend en un solo repositorio,
desplegados juntos en Vercel.

## Cómo se simula cada pieza del diagrama C4

| Pieza del diagrama C4                         | Cómo se simula aquí                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Proxy inverso (Nginx)                         | `vercel.json` (rutas + cabeceras de seguridad) y `server.js` (gateway)      |
| Microservicio de Autenticación                | `authRoutes` → `authController` (bcrypt + JWT)                              |
| Microservicio de Catálogo                     | `productsRoutes` → `productsController`                                     |
| Microservicio de Pedidos                      | `ordersRoutes` → `ordersController`                                         |
| BD Usuarios / BD Productos / BD Pedidos       | Repositorios en memoria: `userModel`, `productModel`, `orderModel`          |
| Pasarela de pago (Stripe / MercadoPago)       | `src/clients/clientePagos.js`                                               |
| Almacenamiento de imágenes (S3 / Cloudinary)  | `src/services/imageStorageService.js` (devuelve URLs `/api/products/images/:id`) |
| Servicio de logística                         | `src/clients/clienteLogistica.js`                                           |
| Servicio de correo                            | `src/clients/clienteNotificaciones.js`                                      |
| Aplicación Web (HTML/CSS/JS)                  | `index.html` + `public/css` + `public/js` (SPA con rutas por hash)          |

## Arquitectura multicapa

```
Presentación      routes/ + controllers/        (endpoints REST)
Lógica de negocio services/ + clients/          (ValidadorCompra, pagos, logística…)
Acceso a datos    models/                       (repositorios; en memoria)
```

## Endpoints

| Método | Ruta                    | Acceso    | Historia | Descripción                                   |
| ------ | ----------------------- | --------- | -------- | --------------------------------------------- |
| POST   | `/api/auth/register`    | público   | HU-01    | Registro: valida, correo único, bcrypt, JWT   |
| POST   | `/api/auth/login`       | público   | HU-01    | Inicio de sesión (devuelve JWT)               |
| GET    | `/api/auth/me`          | JWT       | HU-01    | Usuario de la sesión                          |
| POST   | `/api/products`         | JWT       | HU-02    | Publicar producto con imágenes                |
| GET    | `/api/products`         | público   | HU-03    | Buscar/filtrar: `search, category, minPrice, maxPrice, page, limit` (+ `sort`) |
| GET    | `/api/products/:id`     | público   | HU-03    | Detalle de un producto                        |
| GET    | `/api/products/mine`    | JWT       | HU-02    | Mis publicaciones                             |
| GET    | `/api/products/categories` | público | HU-02/03 | Catálogo de categorías                        |
| GET    | `/api/products/images/:id` | público | HU-02    | Sirve una imagen almacenada                   |
| POST   | `/api/orders`           | JWT       | HU-04    | Comprar (pago + estado "Vendido")             |
| GET    | `/api/orders`           | JWT       | HU-04    | Mis compras (`?rol=vendedor` → mis ventas)    |
| GET    | `/api/orders/:id`       | JWT       | HU-04    | Detalle/recibo (solo comprador o vendedor)    |
| GET    | `/api/health`           | público   | —        | Estado del servicio                           |

## Probar en local

```bash
npm install
npm start          # abre http://localhost:3000
npm test           # prueba de humo de las 4 historias de usuario
```

Cuentas de prueba: `ana@demo.com` y `luis@demo.com` · contraseña `Demo1234`.
Tarjetas de la pasarela simulada: `4242 4242 4242 4242` (aprobada) · `4000 0000 0000 0002` (rechazada).

## Desplegar en Vercel

1. Sube esta carpeta a un repositorio nuevo en GitHub (por ejemplo `c2c-marketplace`).
2. En Vercel: **Add New Project** → importa el repositorio → **Deploy** (`vercel.json` ya define el build y el proxy inverso).
3. Recomendado: en *Settings → Environment Variables* agrega `JWT_SECRET` con un valor largo y aleatorio.

## Nota sobre el "modelo simulado"

Las bases de datos viven **en memoria**: al reiniciarse la función serverless (inactividad o nuevo despliegue)
se vuelve a cargar solo el conjunto de datos de ejemplo (`src/data/seed.js`). Para persistencia real basta con
reemplazar los archivos de `src/models/` por llamadas a PostgreSQL/MongoDB (la arquitectura del Punto 1 ya los
contempla) y `imageStorageService.js` por el SDK de Cloudinary/S3; rutas y controladores no cambian.
