// Manejo uniforme de errores y rutas inexistentes.
function logger(req, res, next) {
  const inicio = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio} ms)`));
  next();
}

function apiNoEncontrada(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La petición es demasiado grande (reduce el tamaño de las imágenes).' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Error interno del servidor.' : err.message,
    ...(err.detalles ? { detalles: err.detalles } : {})
  });
}

module.exports = { logger, apiNoEncontrada, errorHandler };
