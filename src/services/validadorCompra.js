// ValidadorCompra (C4 nivel 3 y 4): reglas de negocio de HU-04.
const HttpError = require('../utils/httpError');

function validarExistencia(producto) {
  if (!producto) throw new HttpError(404, 'El producto no existe.');
}

function validarDisponibilidad(producto) {
  validarExistencia(producto);
  if (producto.estado !== 'disponible') throw new HttpError(409, 'Este producto ya no está disponible.');
}

function validarComprador(producto, compradorId) {
  validarExistencia(producto);
  if (producto.vendedorId === compradorId) throw new HttpError(403, 'No puedes comprar tu propio producto.');
}

module.exports = { validarExistencia, validarDisponibilidad, validarComprador };
