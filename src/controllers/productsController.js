// Microservicio de Catálogo — HU-02 (publicar) y HU-03 (buscar/filtrar).
const productModel = require('../models/productModel');
const storage = require('../services/imageStorageService');
const { validarProducto, parsearConsulta } = require('../utils/validators');
const { CATEGORIAS, PAGINACION } = require('../config/config');
const HttpError = require('../utils/httpError');

// En listados solo se envía la imagen principal para mantener la respuesta liviana.
const aTarjeta = (p) => ({ ...p, imagenes: p.imagenes.slice(0, 1) });

// POST /api/products  (protegido por JWT)
function crear(req, res) {
  const errores = validarProducto(req.body);
  if (errores.length) throw new HttpError(400, 'Datos del producto inválidos.', errores);

  // Procesamiento y almacenamiento de imágenes -> se obtienen sus URLs
  const urls = req.body.imagenes.map((img) => storage.subirDataUrl(img));

  // Guardado vinculado al id del usuario vendedor (tomado del token, nunca del body)
  const producto = productModel.crear({
    titulo: req.body.titulo,
    descripcion: req.body.descripcion,
    precio: req.body.precio,
    categoria: req.body.categoria,
    imagenes: urls,
    vendedorId: req.usuario.id,
    vendedorNombre: req.usuario.nombre
  });
  res.status(201).json({ producto });
}

// GET /api/products?search=&category=&minPrice=&maxPrice=&page=&limit=
function listar(req, res) {
  const { errores, filtros } = parsearConsulta(req.query, {
    limiteDefecto: PAGINACION.LIMITE_DEFECTO,
    limiteMaximo: PAGINACION.LIMITE_MAXIMO
  });
  if (errores.length) throw new HttpError(400, 'Parámetros de búsqueda inválidos.', errores);

  const { data, pagination } = productModel.buscar(filtros);
  res.json({ data: data.map(aTarjeta), pagination, filtros });
}

// GET /api/products/mine  (protegido): publicaciones del vendedor
function misProductos(req, res) {
  res.json({ data: productModel.listarPorVendedor(req.usuario.id).map(aTarjeta) });
}

// GET /api/products/:id
function obtener(req, res) {
  const producto = productModel.buscarPorId(req.params.id);
  if (!producto) throw new HttpError(404, 'El producto no existe.');
  res.json({ producto });
}

// GET /api/products/categories
const categorias = (req, res) => res.json({ data: CATEGORIAS });

// GET /api/products/images/:id  -> sirve la imagen almacenada
function imagen(req, res) {
  const img = storage.obtener(req.params.id);
  if (!img) throw new HttpError(404, 'Imagen no encontrada.');
  res.set({
    'Content-Type': img.mime,
    'Cache-Control': 'public, max-age=86400, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
  });
  res.send(img.buffer);
}

module.exports = { crear, listar, misProductos, obtener, categorias, imagen };
