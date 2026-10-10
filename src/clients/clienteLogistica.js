// ClienteLogistica (C4 nivel 3): simula la transportadora externa y su tracking.
const crypto = require('crypto');

const TRANSPORTADORAS = ['Servientrega', 'Coordinadora', 'Interrapidísimo'];

async function solicitarEnvio(pedido) {
  const entrega = new Date();
  entrega.setDate(entrega.getDate() + 3);
  return {
    trackingId: `C2C-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
    transportadora: TRANSPORTADORAS[crypto.randomInt(TRANSPORTADORAS.length)],
    entregaEstimada: entrega.toISOString().slice(0, 10),
    destino: pedido.direccionEntrega.ciudad
  };
}

module.exports = { solicitarEnvio };
