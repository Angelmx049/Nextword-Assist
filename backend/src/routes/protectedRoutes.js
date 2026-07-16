const express = require('express');
const router = express.Router();

const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/perfil', verificarToken, (req, res) => {
  res.json({
    mensaje: 'Acceso autorizado',
    usuario: req.usuario
  });
});

router.get('/admin', verificarToken, verificarRol('ADMINISTRADOR'), (req, res) => {
  res.json({
    mensaje: 'Ruta exclusiva para Administrador',
    usuario: req.usuario
  });
});

router.get('/supervisor', verificarToken, verificarRol('ADMINISTRADOR', 'SUPERVISOR'), (req, res) => {
  res.json({
    mensaje: 'Ruta permitida para Administrador y Supervisor',
    usuario: req.usuario
  });
});

module.exports = router;