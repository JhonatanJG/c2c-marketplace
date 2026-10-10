const router = require('express').Router();
const ctrl = require('../controllers/productsController');
const { requerirAuth } = require('../middlewares/authMiddleware');

// Las rutas fijas van ANTES de "/:id" para que no se interpreten como un id.
router.get('/categories', ctrl.categorias);
router.get('/images/:id', ctrl.imagen);
router.get('/mine', requerirAuth, ctrl.misProductos);

router.get('/', ctrl.listar);                    // HU-03 (público)
router.post('/', requerirAuth, ctrl.crear);      // HU-02 (protegido)
router.get('/:id', ctrl.obtener);

module.exports = router;
