const { CATEGORIAS, METODOS_PAGO, MAX_IMAGENES } = require('../config/config');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO_RE = /^\+?[0-9\s-]{7,15}$/;

const esTexto = (v) => typeof v === 'string';
const limpio = (v) => (esTexto(v) ? v.trim() : '');

function esEmailValido(email) {
  return EMAIL_RE.test(limpio(email));
}

// Regla del backend: mínimo 8 caracteres, al menos una letra y un número.
function esPasswordValida(password) {
  return esTexto(password) && password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

// Algoritmo de Luhn para validar números de tarjeta (solo formato, nunca se almacena).
function luhn(numero) {
  const digitos = String(numero).replace(/\s|-/g, '');
  if (!/^\d{13,19}$/.test(digitos)) return false;
  let suma = 0;
  let alternar = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let n = Number(digitos[i]);
    if (alternar) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    suma += n;
    alternar = !alternar;
  }
  return suma % 10 === 0;
}

// ---- HU-01 ----
function validarRegistro(body = {}) {
  const errores = [];
  const nombre = limpio(body.nombre);
  if (nombre.length < 2 || nombre.length > 60) errores.push({ campo: 'nombre', mensaje: 'El nombre es obligatorio (2 a 60 caracteres).' });
  if (!esEmailValido(body.email)) errores.push({ campo: 'email', mensaje: 'Ingresa un correo electrónico válido.' });
  if (!esPasswordValida(body.password)) errores.push({ campo: 'password', mensaje: 'La contraseña debe tener mínimo 8 caracteres, con letras y números.' });
  if (!TELEFONO_RE.test(limpio(body.telefono))) errores.push({ campo: 'telefono', mensaje: 'Ingresa un teléfono válido (7 a 15 dígitos).' });
  return errores;
}

// ---- HU-02 ----
function validarProducto(body = {}) {
  const errores = [];
  const titulo = limpio(body.titulo);
  const descripcion = limpio(body.descripcion);
  const precio = Number(body.precio);

  if (titulo.length < 3 || titulo.length > 80) errores.push({ campo: 'titulo', mensaje: 'El título es obligatorio (3 a 80 caracteres).' });
  if (descripcion.length < 10 || descripcion.length > 1000) errores.push({ campo: 'descripcion', mensaje: 'La descripción es obligatoria (10 a 1000 caracteres).' });
  if (!Number.isFinite(precio) || precio <= 0 || precio > 1_000_000_000) errores.push({ campo: 'precio', mensaje: 'El precio debe ser un número mayor que 0.' });
  if (!CATEGORIAS.some((c) => c.id === body.categoria)) errores.push({ campo: 'categoria', mensaje: 'Selecciona una categoría válida.' });
  if (!Array.isArray(body.imagenes) || body.imagenes.length < 1 || body.imagenes.length > MAX_IMAGENES) {
    errores.push({ campo: 'imagenes', mensaje: `Sube entre 1 y ${MAX_IMAGENES} imágenes.` });
  }
  return errores;
}

// ---- HU-03 ----
function parsearConsulta(query = {}, { limiteDefecto, limiteMaximo }) {
  const errores = [];
  const numero = (v) => (v === undefined || v === '' ? undefined : Number(v));

  const minPrice = numero(query.minPrice);
  const maxPrice = numero(query.maxPrice);
  if (minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) errores.push({ campo: 'minPrice', mensaje: 'minPrice debe ser un número positivo.' });
  if (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) errores.push({ campo: 'maxPrice', mensaje: 'maxPrice debe ser un número positivo.' });
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) errores.push({ campo: 'minPrice', mensaje: 'El precio mínimo no puede superar al máximo.' });

  const category = limpio(query.category) || undefined;
  if (category && !CATEGORIAS.some((c) => c.id === category)) errores.push({ campo: 'category', mensaje: 'Categoría desconocida.' });

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(limiteMaximo, Math.max(1, parseInt(query.limit, 10) || limiteDefecto));
  const sort = ['recientes', 'precio_asc', 'precio_desc'].includes(query.sort) ? query.sort : 'recientes';
  const status = ['disponible', 'vendido', 'todos'].includes(query.status) ? query.status : 'disponible';

  return { errores, filtros: { search: limpio(query.search), category, minPrice, maxPrice, page, limit, sort, status } };
}

// ---- HU-04 ----
function validarPedido(body = {}) {
  const errores = [];
  if (!esTexto(body.productId) || !body.productId.trim()) errores.push({ campo: 'productId', mensaje: 'Indica el producto a comprar.' });

  const d = body.direccionEntrega || {};
  if (limpio(d.receptor).length < 3) errores.push({ campo: 'receptor', mensaje: 'Indica quién recibe el pedido.' });
  if (limpio(d.direccion).length < 5) errores.push({ campo: 'direccion', mensaje: 'Ingresa una dirección de entrega válida.' });
  if (limpio(d.ciudad).length < 2) errores.push({ campo: 'ciudad', mensaje: 'Ingresa la ciudad de entrega.' });
  if (!TELEFONO_RE.test(limpio(d.telefono))) errores.push({ campo: 'telefonoEntrega', mensaje: 'Ingresa un teléfono de contacto válido.' });

  if (!METODOS_PAGO.includes(body.metodoPago)) {
    errores.push({ campo: 'metodoPago', mensaje: `Método de pago no soportado (${METODOS_PAGO.join(', ')}).` });
  } else if (body.metodoPago === 'tarjeta') {
    const t = body.tarjeta || {};
    if (!luhn(t.numero)) errores.push({ campo: 'numeroTarjeta', mensaje: 'Número de tarjeta inválido.' });
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(limpio(t.vencimiento))) {
      errores.push({ campo: 'vencimiento', mensaje: 'Vencimiento inválido (formato MM/AA).' });
    } else {
      const [mm, aa] = t.vencimiento.split('/').map(Number);
      const vence = new Date(2000 + aa, mm, 0, 23, 59, 59); // último día del mes
      if (vence < new Date()) errores.push({ campo: 'vencimiento', mensaje: 'La tarjeta está vencida.' });
    }
    if (!/^\d{3,4}$/.test(limpio(t.cvv))) errores.push({ campo: 'cvv', mensaje: 'CVV inválido.' });
  }
  return errores;
}

module.exports = { esEmailValido, esPasswordValida, luhn, validarRegistro, validarProducto, parsearConsulta, validarPedido, limpio };
