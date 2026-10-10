// ClienteNotificaciones (C4 nivel 3): simula el servicio externo de correo.
// Guarda los últimos mensajes en una "bandeja de salida" y los imprime en consola.
const bandeja = [];

function enviar(para, asunto, cuerpo) {
  const mensaje = { para, asunto, cuerpo, enviadoEn: new Date().toISOString() };
  bandeja.unshift(mensaje);
  if (bandeja.length > 50) bandeja.pop();
  console.log(`[correo simulado] a ${para}: ${asunto}`);
  return Promise.resolve(mensaje);
}

const notificarRegistro = (usuario) =>
  enviar(usuario.email, 'Bienvenido a C2C Market', `Hola ${usuario.nombre}, tu cuenta fue creada con éxito.`);

const notificarCompra = (pedido, comprador, vendedor) =>
  Promise.all([
    enviar(comprador.email, 'Tu compra fue confirmada', `Compraste "${pedido.productoTitulo}". Seguimiento: ${pedido.trackingId ?? 'pendiente'}.`),
    vendedor ? enviar(vendedor.email, '¡Vendiste un producto!', `Tu producto "${pedido.productoTitulo}" fue comprado. Prepara el envío.`) : null
  ]);

module.exports = { notificarRegistro, notificarCompra };
