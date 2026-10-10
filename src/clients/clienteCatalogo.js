// ClienteCatalogo (C4 nivel 3): el microservicio de Pedidos consulta al de Catálogo.
// En la arquitectura real sería HTTP (GET /api/products/:id). Al ser un despliegue
// serverless único (modelo simulado), se invoca el repositorio en el mismo proceso.
const productModel = require('../models/productModel');

const obtenerProducto = async (id) => productModel.buscarPorId(id);
const actualizarEstado = async (id, estado, esperado) => productModel.actualizarEstado(id, estado, esperado);

module.exports = { obtenerProducto, actualizarEstado };
