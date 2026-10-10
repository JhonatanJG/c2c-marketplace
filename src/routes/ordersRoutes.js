const router = require('express').Router();
const ctrl = require('../controllers/ordersController');
const { requerirAuth } = require('../middlewares/authMiddleware');

// Todo el microservicio de pedidos exige sesión.
router.use(requerirAuth);

router.post('/', ctrl.crearPedido);      // HU-04
router.get('/', ctrl.listarPedidos);
router.get('/:id', ctrl.obtenerPedido);

module.exports = router;
