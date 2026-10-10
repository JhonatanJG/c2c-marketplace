// Middleware de autenticación: protege endpoints verificando el token JWT (Bearer).
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/config');
const HttpError = require('../utils/httpError');

function requerirAuth(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const [tipo, token] = cabecera.split(' ');
  if (tipo !== 'Bearer' || !token) throw new HttpError(401, 'Debes iniciar sesión para realizar esta acción.');

  try {
    const { sub, nombre, email } = jwt.verify(token, JWT_SECRET);
    req.usuario = { id: sub, nombre, email };
    next();
  } catch {
    throw new HttpError(401, 'Tu sesión expiró o el token no es válido. Inicia sesión de nuevo.');
  }
}

module.exports = { requerirAuth };
