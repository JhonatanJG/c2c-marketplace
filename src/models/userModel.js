// Repositorio de usuarios (simula la "BD Usuarios" PostgreSQL del diagrama C4).
const crypto = require('crypto');

const usuarios = new Map();      // id -> usuario
const porEmail = new Map();      // email (minúsculas) -> id  (índice único)

function crear({ id, nombre, email, passwordHash, telefono }) {
  const usuario = {
    id: id || crypto.randomUUID(),
    nombre: nombre.trim(),
    email: email.trim().toLowerCase(),
    passwordHash,
    telefono: telefono.trim(),
    creadoEn: new Date().toISOString()
  };
  usuarios.set(usuario.id, usuario);
  porEmail.set(usuario.email, usuario.id);
  return usuario;
}

const buscarPorEmail = (email) => usuarios.get(porEmail.get(String(email).trim().toLowerCase()));
const buscarPorId = (id) => usuarios.get(id);

// Nunca se expone el hash de la contraseña hacia afuera.
const aPublico = ({ passwordHash, ...resto }) => resto;

module.exports = { crear, buscarPorEmail, buscarPorId, aPublico };
