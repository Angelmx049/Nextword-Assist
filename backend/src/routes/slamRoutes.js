const express = require('express');

const router = express.Router();

const {
  crearSlam,
  obtenerSlams,
  obtenerContadorSlam,
  exportarExcel,
  obtenerSlamPorId,
  actualizarSlam,
  eliminarSlam
} = require('../controllers/slamController');

const { verificarToken } = require('../middlewares/authMiddleware');
const uploadSlam = require('../middlewares/uploadsSlamMiddleware');

router.use(verificarToken);

router.get('/', obtenerSlams);
router.get('/contador', obtenerContadorSlam);
router.get('/exportar/excel', exportarExcel);
router.get('/:id', obtenerSlamPorId);
router.post('/', uploadSlam.single('foto'), crearSlam);
router.put('/:id', uploadSlam.single('foto'), actualizarSlam);
router.delete('/:id', eliminarSlam);

module.exports = router;
