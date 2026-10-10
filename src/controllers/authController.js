// Microservicio de Autenticación — HU-01 (registro) + login.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const notificaciones = require('../clients/clienteNotificaciones');
const { validarRegistro, esEmailValido } = require('../utils/validators');
const { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_ROUNDS } = require('../config/config');
const HttpError = require('../utils/httpError');

const firmarToken = (u) => jwt.sign({ nombre: u.nombre, email: u.email }, JWT_SECRET, { subject: u.id, expiresIn: JWT_EXPIRES_IN });

// Hash de relleno para que el login tarde lo mismo exista o no el correo (evita enumerar usuarios).
const HASH_RELLENO = bcrypt.hashSync('relleno-no-valido', BCRYPT_ROUNDS);

// POST /api/auth/register
async function register(req, res) {
  const errores = validarRegistro(req.body);
  if (errores.length) throw new HttpError(400, 'Datos de registro inválidos.', errores);

  const { nombre, email, password, telefono } = req.body;

  // Unicidad del correo
  if (userModel.buscarPorEmail(email)) {
    throw new HttpError(409, 'Ya existe una cuenta registrada con este correo.', [{ campo: 'email', mensaje: 'Este correo ya está registrado.' }]);
  }

  // Encriptación segura (bcrypt) antes de almacenar
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const usuario = userModel.crear({ nombre, email, passwordHash, telefono });

  // Notificación "best effort": si falla el correo, el registro igual es exitoso.
  notificaciones.notificarRegistro(usuario).catch(() => {});

  // Token JWT tras el registro exitoso
  res.status(201).json({ usuario: userModel.aPublico(usuario), token: firmarToken(usuario) });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body || {};
  if (!esEmailValido(email) || typeof password !== 'string' || !password) {
    throw new HttpError(400, 'Ingresa tu correo y contraseña.');
  }
  const usuario = userModel.buscarPorEmail(email);
  const ok = await bcrypt.compare(password, usuario ? usuario.passwordHash : HASH_RELLENO);
  if (!usuario || !ok) throw new HttpError(401, 'Correo o contraseña incorrectos.');

  res.json({ usuario: userModel.aPublico(usuario), token: firmarToken(usuario) });
}

// GET /api/auth/me  (protegido)
function me(req, res) {
  // Si otra copia de la función serverless atiende la petición, puede no tener al usuario en memoria.
  // El token está firmado, así que se responde con sus datos y la sesión no se pierde.
  const usuario = userModel.buscarPorId(req.usuario.id) || { ...req.usuario, telefono: '' };
  res.json({ usuario: userModel.aPublico(usuario) });
}

module.exports = { register, login, me };
