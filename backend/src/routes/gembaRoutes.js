const express = require("express");

const router = express.Router();

const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const {
  obtenerCouriersActivos,
  crearEvaluacion,
  obtenerEvaluaciones,
  obtenerEvaluacionPorId,
  actualizarEvaluacion,
  eliminarEvaluacion,
  exportarExcel,
} = require(
  "../controllers/gembaController"
);

/**
 * Todo GEMBA RIDE requiere autenticación JWT.
 */
router.use(verificarToken);

/**
 * GET /api/gemba/couriers
 *
 * Devuelve los couriers activos.
 */
router.get(
  "/couriers",
  obtenerCouriersActivos
);

/**
 * GET /api/gemba/exportar/excel
 *
 * Solo ADMINISTRADOR.
 *
 * Debe ir antes de /:id.
 */
router.get(
  "/exportar/excel",
  verificarRol("ADMINISTRADOR"),
  exportarExcel
);

/**
 * GET /api/gemba
 *
 * Historial general con filtros.
 */
router.get(
  "/",
  obtenerEvaluaciones
);

/**
 * POST /api/gemba
 *
 * Crear evaluación.
 */
router.post(
  "/",
  crearEvaluacion
);

/**
 * GET /api/gemba/:id
 *
 * Ver evaluación individual.
 */
router.get(
  "/:id",
  obtenerEvaluacionPorId
);

/**
 * PUT /api/gemba/:id
 *
 * Editar evaluación.
 */
router.put(
  "/:id",
  actualizarEvaluacion
);

/**
 * DELETE /api/gemba/:id
 *
 * Solo ADMINISTRADOR.
 */
router.delete(
  "/:id",
  verificarRol("ADMINISTRADOR"),
  eliminarEvaluacion
);

module.exports = router;