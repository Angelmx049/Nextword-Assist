const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const {
  verificarToken,
  verificarRol
} = require('../middlewares/authMiddleware');

const carpetaSafety = path.join(
  __dirname,
  '..',
  'uploads',
  'safety'
);

router.use(verificarToken);
router.use(
  verificarRol('ADMINISTRADOR', 'SUPERVISOR')
);

router.get('/:nombre_archivo', (req, res) => {
  const nombreArchivo = req.params.nombre_archivo;

  if (
    nombreArchivo !== path.basename(nombreArchivo) ||
    !/^safety-\d+-\d+\.(jpg|png|webp)$/.test(nombreArchivo)
  ) {
    return res.status(400).json({
      mensaje: 'Nombre de evidencia inválido'
    });
  }

  const rutaArchivo = path.join(carpetaSafety, nombreArchivo);

  if (!fs.existsSync(rutaArchivo)) {
    return res.status(404).json({
      mensaje: 'Evidencia Safety no encontrada'
    });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return res.sendFile(rutaArchivo);
});

module.exports = router;
