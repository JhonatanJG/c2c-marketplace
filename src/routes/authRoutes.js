const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { requerirAuth } = require('../middlewares/authMiddleware');

router.post('/register', ctrl.register);   // HU-01
router.post('/login', ctrl.login);
router.get('/me', requerirAuth, ctrl.me);

module.exports = router;
