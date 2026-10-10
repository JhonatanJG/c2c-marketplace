// Repositorio de productos (simula la "BD Productos" MongoDB del diagrama C4).
// Incluye índices en memoria para que la búsqueda no recorra todo el catálogo:
//   - índice por categoría     (equivale a un índice simple en MongoDB)
//   - índice invertido de texto (equivale a un índice de texto / $text en MongoDB)
// El rango de precios se filtra sobre el conjunto candidato ya reducido por los índices.
const crypto = require('crypto');

const productos = new Map();           // id -> producto
const idxCategoria = new Map();        // categoria -> Set(id)
const idxTexto = new Map();            // token -> Set(id)

// Normaliza: minúsculas, sin tildes, solo letras/números.
function tokenizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

function agregarAIndice(mapa, clave, id) {
  if (!mapa.has(clave)) mapa.set(clave, new Set());
  mapa.get(clave).add(id);
}

function indexar(p) {
  agregarAIndice(idxCategoria, p.categoria, p.id);
  new Set(tokenizar(`${p.titulo} ${p.descripcion}`)).forEach((t) => agregarAIndice(idxTexto, t, p.id));
}

function crear({ titulo, descripcion, precio, categoria, imagenes, vendedorId, vendedorNombre }) {
  const producto = {
    id: crypto.randomUUID(),
    titulo: titulo.trim(),
    descripcion: descripcion.trim(),
    precio: Number(precio),
    categoria,
    imagenes,                 // arreglo de URLs devueltas por el servicio de almacenamiento
    vendedorId,               // vínculo con el usuario vendedor (HU-02)
    vendedorNombre,
    estado: 'disponible',     // disponible | reservado | vendido
    creadoEn: new Date().toISOString()
  };
  productos.set(producto.id, producto);
  indexar(producto);
  return producto;
}

const buscarPorId = (id) => productos.get(id);

// Cambio de estado con "compare-and-set": si se indica `esperado` y el estado actual
// es distinto, no cambia nada. Evita que dos compradores adquieran el mismo producto.
function actualizarEstado(id, nuevoEstado, esperado) {
  const p = productos.get(id);
  if (!p) return false;
  if (esperado && p.estado !== esperado) return false;
  p.estado = nuevoEstado;
  return true;
}

const listarPorVendedor = (vendedorId) =>
  [...productos.values()].filter((p) => p.vendedorId === vendedorId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

// Búsqueda por palabras clave (todas deben coincidir, con coincidencia por prefijo).
function candidatosPorTexto(search) {
  const tokens = tokenizar(search);
  let resultado = null;
  for (const token of tokens) {
    const ids = new Set();
    for (const [clave, set] of idxTexto) {
      if (clave.startsWith(token)) set.forEach((id) => ids.add(id));
    }
    resultado = resultado ? new Set([...resultado].filter((id) => ids.has(id))) : ids;
    if (resultado.size === 0) break;
  }
  return resultado;
}

function buscar({ search, category, minPrice, maxPrice, page, limit, sort, status }) {
  // 1) Reducir candidatos con índices
  let ids = null;
  if (category) ids = new Set(idxCategoria.get(category) || []);
  if (search) {
    const porTexto = candidatosPorTexto(search);
    ids = ids ? new Set([...ids].filter((id) => porTexto.has(id))) : porTexto;
  }
  let lista = ids ? [...ids].map((id) => productos.get(id)) : [...productos.values()];

  // 2) Filtros de rango y estado
  lista = lista.filter((p) =>
    (status === 'todos' || p.estado === status) &&
    (minPrice === undefined || p.precio >= minPrice) &&
    (maxPrice === undefined || p.precio <= maxPrice));

  // 3) Orden
  const orden = {
    recientes: (a, b) => b.creadoEn.localeCompare(a.creadoEn),
    precio_asc: (a, b) => a.precio - b.precio,
    precio_desc: (a, b) => b.precio - a.precio
  }[sort];
  lista.sort(orden);

  // 4) Paginación
  const total = lista.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const inicio = (page - 1) * limit;
  return { data: lista.slice(inicio, inicio + limit), pagination: { page, limit, total, totalPages } };
}

module.exports = { crear, buscarPorId, actualizarEstado, listarPorVendedor, buscar };
