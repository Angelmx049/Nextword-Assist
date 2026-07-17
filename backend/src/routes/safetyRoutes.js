const express = require('express');
const router = express.Router();

const safetyController = require(
  '../controllers/safetyController'
);
const {
  verificarToken,
  verificarRol
} = require('../middlewares/authMiddleware');
const {
  validarFirmaImagen
} = require(
  '../middlewares/uploadsSafetyMiddleware'
);
const limitarCreacionHallazgos = require(
  '../middlewares/safetyRateLimitMiddleware'
);
const cargarFotografia = require(
  '../middlewares/safetyUploadMiddleware'
);

router.use(verificarToken);
router.use(
  verificarRol('ADMINISTRADOR', 'SUPERVISOR')
);

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
