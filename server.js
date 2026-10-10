// Punto de entrada: actúa como PROXY INVERSO / API Gateway del diagrama C4.
// Todas las peticiones llegan aquí (vercel.json lo configura como único destino) y se
// enrutan al "microservicio" correspondiente según el prefijo de la URL:
//   /api/auth/*     -> Microservicio de Autenticación (HU-01)
//   /api/products/* -> Microservicio de Catálogo       (HU-02, HU-03)
//   /api/orders/*   -> Microservicio de Pedidos        (HU-04)
// El resto de rutas sirve el frontend estático (index.html + /public).
const path = require('path');
const express = require('express');

const authRoutes = require('./src/routes/authRoutes');
const productsRoutes = require('./src/routes/productsRoutes');
const ordersRoutes = require('./src/routes/ordersRoutes');
const { logger, apiNoEncontrada, errorHandler } = require('./src/middlewares/errorHandler');
require('./src/data/seed').cargar();

const app = express();
app.disable('x-powered-by');
app.use(logger);
app.use(express.json({ limit: '3mb' })); // Vercel acepta cuerpos de hasta 4.5 MB

// ---- Enrutamiento hacia los microservicios ----
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.get('/api/health', (req, res) => res.json({ estado: 'ok', servicio: 'c2c-marketplace', hora: new Date().toISOString() }));
app.use('/api', apiNoEncontrada);

// ---- Frontend estático ----
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use((req, res) => res.status(404).send('Recurso no encontrado'));

app.use(errorHandler);

// En Vercel se exporta la app (función serverless); en local se levanta el servidor.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`C2C Market en http://localhost:${PORT}`));
}

module.exports = app;
