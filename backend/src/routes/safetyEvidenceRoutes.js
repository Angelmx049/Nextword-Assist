const express = require('express');

const router = express.Router();

const safetyEvidenceController = require(
  '../controllers/safetyEvidenceController'
);

const {
  verificarToken,
  verificarRol
} = require('../middlewares/authMiddleware');

router.use(verificarToken);
router.use(
  verificarRol('ADMINISTRADOR', 'SUPERVISOR')
);

router.get(
  '/:nombre_archivo',
  safetyEvidenceController.obtenerEvidencia
);

module.exports = router;
