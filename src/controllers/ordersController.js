// Microservicio de Pedidos — HU-04 (compra). Orquesta los componentes del C4 nivel 3:
// ValidadorCompra, ClienteCatalogo, ClientePagos, ClienteLogistica, ClienteNotificaciones y PedidoRepository.
const pedidoRepo = require('../models/orderModel');
const userModel = require('../models/userModel');
const validador = require('../services/validadorCompra');
const clienteCatalogo = require('../clients/clienteCatalogo');
const clientePagos = require('../clients/clientePagos');
const clienteLogistica = require('../clients/clienteLogistica');
const clienteNotif = require('../clients/clienteNotificaciones');
const { validarPedido, limpio } = require('../utils/validators');
const HttpError = require('../utils/httpError');

// POST /api/orders  (protegido)
async function crearPedido(req, res) {
  const errores = validarPedido(req.body);
  if (errores.length) throw new HttpError(400, 'Datos de la compra inválidos.', errores);

  const { productId, direccionEntrega, metodoPago, tarjeta } = req.body;
  const comprador = req.usuario;

  // 1) Reglas de negocio: producto existente, comprador != vendedor, producto disponible
  const producto = await clienteCatalogo.obtenerProducto(productId);
  validador.validarExistencia(producto);
  validador.validarComprador(producto, comprador.id);
  validador.validarDisponibilidad(producto);

  // 2) Reservar el producto de forma atómica (disponible -> reservado) para evitar compras duplicadas
  const reservado = await clienteCatalogo.actualizarEstado(producto.id, 'reservado', 'disponible');
  if (!reservado) throw new HttpError(409, 'Otro comprador acaba de adquirir este producto.');

  // 3) Cobro a través de la pasarela de pago
  let pago;
  try {
    pago = await clientePagos.procesarPago({ monto: producto.precio, metodo: metodoPago, tarjeta });
  } catch (err) {
    await clienteCatalogo.actualizarEstado(producto.id, 'disponible'); // libera la reserva
    throw err;
  }
  if (!pago.aprobado) {
    await clienteCatalogo.actualizarEstado(producto.id, 'disponible'); // libera la reserva
    throw new HttpError(402, `Pago rechazado: ${pago.mensaje}`);
  }

  // 4) Persistir el pedido y marcar el producto como "Vendido"
  const pedido = pedidoRepo.crear({
    productoId: producto.id,
    productoTitulo: producto.titulo,
    productoImagen: producto.imagenes[0],
    compradorId: comprador.id,
    compradorNombre: comprador.nombre,
    vendedorId: producto.vendedorId,
    vendedorNombre: producto.vendedorNombre,
    direccionEntrega: {
      receptor: limpio(direccionEntrega.receptor),
      direccion: limpio(direccionEntrega.direccion),
      ciudad: limpio(direccionEntrega.ciudad),
      telefono: limpio(direccionEntrega.telefono)
    },
    metodoPago,
    monto: producto.precio,
    transaccionId: pago.transaccionId,
    ultimos4: pago.ultimos4
  });
  pedido.estado = 'pagado';
  await clienteCatalogo.actualizarEstado(producto.id, 'vendido');

  // 5) Envío (si falla, el pedido queda pagado y el tracking pendiente)
  try {
    const envio = await clienteLogistica.solicitarEnvio(pedido);
    Object.assign(pedido, { trackingId: envio.trackingId, transportadora: envio.transportadora, entregaEstimada: envio.entregaEstimada, estado: 'en_envio' });
  } catch (err) {
    console.error('Logística no disponible:', err.message);
  }
  pedidoRepo.guardar(pedido);

  // 6) Notificaciones por correo (no bloquean la compra)
  clienteNotif.notificarCompra(pedido, { email: comprador.email }, userModel.buscarPorId(producto.vendedorId)).catch(() => {});

  res.status(201).json({ pedido: pedido });
}

// GET /api/orders/:id  (solo comprador o vendedor del pedido)
function obtenerPedido(req, res) {
  const pedido = pedidoRepo.buscarPorId(req.params.id);
  if (!pedido) throw new HttpError(404, 'El pedido no existe.');
  if (![pedido.compradorId, pedido.vendedorId].includes(req.usuario.id)) throw new HttpError(403, 'No tienes acceso a este pedido.');
  res.json({ pedido });
}

// GET /api/orders?rol=comprador|vendedor
function listarPedidos(req, res) {
  const rol = req.query.rol === 'vendedor' ? 'vendedor' : 'comprador';
  res.json({ data: pedidoRepo.listarPorUsuario(req.usuario.id, rol), rol });
}

module.exports = { crearPedido, obtenerPedido, listarPedidos };
