// ClientePagos (C4 nivel 3): simula la pasarela externa (Stripe / MercadoPago).
// Tarjetas de prueba: 4242 4242 4242 4242 -> aprobada | 4000 0000 0000 0002 -> rechazada.
// Importante: el número completo de la tarjeta NUNCA se guarda; solo los últimos 4 dígitos.
const crypto = require('crypto');

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function procesarPago({ monto, metodo, tarjeta }) {
  await esperar(250); // latencia simulada de la pasarela

  let ultimos4 = null;
  if (metodo === 'tarjeta') {
    const digitos = String(tarjeta.numero).replace(/\D/g, '');
    ultimos4 = digitos.slice(-4);
    if (digitos.endsWith('0002')) {
      return { aprobado: false, mensaje: 'La tarjeta fue rechazada por el banco emisor.' };
    }
  }
  return {
    aprobado: true,
    transaccionId: `pay_${crypto.randomBytes(8).toString('hex')}`,
    monto,
    metodo,
    ultimos4
  };
}

module.exports = { procesarPago };
