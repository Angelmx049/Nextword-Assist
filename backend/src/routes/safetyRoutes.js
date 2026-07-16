const express = require('express');
const multer = require('multer');

const router = express.Router();

const safetyController = require(
  '../controllers/safetyController'
);
const {
  verificarToken,
  verificarRol
} = require('../middlewares/authMiddleware');
const {
  uploadSafety,
  validarFirmaImagen
} = require(
  '../middlewares/uploadsSafetyMiddleware'
);
const limitarCreacionHallazgos = require(
  '../middlewares/safetyRateLimitMiddleware'
);

router.use(verificarToken);
router.use(
  verificarRol('ADMINISTRADOR', 'SUPERVISOR')
);

const cargarFotografia = (req, res, next) => {
  uploadSafety.single('foto')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      const mensaje = error.code === 'LIMIT_FILE_SIZE'
        ? 'La fotografía no puede superar 5 MB'
        : 'No se pudo procesar la fotografía';

      return res.status(400).json({ mensaje });
    }

    return res.status(400).json({
      mensaje: error.message
    });
  });
};

router.get('/areas', safetyController.obtenerAreas);
router.get(
  '/areas/:id_area/recientes',
  safetyController.obtenerHallazgosRecientes
);
router.get(
  '/areas/:id_area/hallazgos/exportar/excel',
  safetyController.exportarHistorial
);
router.get(
  '/areas/:id_area/hallazgos',
  safetyController.obtenerHistorial
);
router.get(
  '/hallazgos/:id_hallazgo',
  safetyController.obtenerHallazgoPorId
);
router.post(
  '/hallazgos',
  limitarCreacionHallazgos,
  cargarFotografia,
  validarFirmaImagen,
  safetyController.crearHallazgo
);

module.exports = router;
