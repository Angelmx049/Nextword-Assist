const express = require('express');
const router = express.Router();

const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const protectedController = require('../controllers/protectedController');

router.get('/perfil', verificarToken, protectedController.obtenerPerfil);

router.get(
  '/admin',
  verificarToken,
  verificarRol('ADMINISTRADOR'),
  protectedController.obtenerAdministrador
);

router.get(
  '/supervisor',
  verificarToken,
  verificarRol('ADMINISTRADOR', 'SUPERVISOR'),
  protectedController.obtenerSupervisor
);

module.exports = router;
