const express = require('express');
const controller = require('../controllers/notificacionController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(verificarToken);
router.use(verificarRol('ADMINISTRADOR', 'SUPERVISOR'));

router.get('/resumen', controller.obtenerResumen);
router.patch('/leer-todas', controller.marcarTodasLeidas);
router.patch('/:id/leida', controller.marcarLeida);
router.get('/', controller.listarNotificaciones);

module.exports = router;

