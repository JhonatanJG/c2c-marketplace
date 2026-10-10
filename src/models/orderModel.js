// PedidoRepository (simula la "BD Pedidos" PostgreSQL del diagrama C4, nivel 3 y 4).
const crypto = require('crypto');

const pedidos = new Map();

function crear(datos) {
  const pedido = {
    id: crypto.randomUUID(),
    ...datos,
    estado: 'creado',
    trackingId: null,
    creadoEn: new Date().toISOString()
  };
  pedidos.set(pedido.id, pedido);
  return pedido;
}

const buscarPorId = (id) => pedidos.get(id);

function guardar(pedido) {
  pedidos.set(pedido.id, pedido);
  return pedido;
}

// rol = 'comprador' -> mis compras | 'vendedor' -> mis ventas
function listarPorUsuario(usuarioId, rol) {
  const campo = rol === 'vendedor' ? 'vendedorId' : 'compradorId';
  return [...pedidos.values()].filter((p) => p[campo] === usuarioId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

module.exports = { crear, buscarPorId, guardar, listarPorUsuario };
