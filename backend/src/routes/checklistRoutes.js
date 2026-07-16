const express = require('express');

const router = express.Router();

const checklistController = require(
  '../controllers/checklistController'
);

const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');


// =====================================================
// TODAS LAS RUTAS REQUIEREN JWT
// =====================================================

router.use(verificarToken);


// =====================================================
// RUTAS ESPECÍFICAS
// DEBEN IR ANTES DE /:id
// =====================================================


// Listar administradores disponibles
// SOLO SUPERVISOR

router.get(
  '/administradores',
  verificarRol('SUPERVISOR'),
  checklistController.obtenerAdministradores
);


// Consultar alertas listas para mostrarse
// AMBOS ROLES

router.get(
  '/alertas/pendientes',
  verificarRol(
    'ADMINISTRADOR',
    'SUPERVISOR'
  ),
  checklistController.obtenerAlertasPendientes
);


// Exportar Excel
// AMBOS ROLES
// ADMINISTRADOR exporta solo sus tareas

router.get(
  '/exportar/excel',
  verificarRol(
    'ADMINISTRADOR',
    'SUPERVISOR'
  ),
  checklistController.exportarExcel
);


// =====================================================
// LISTAR TAREAS
// =====================================================

router.get(
  '/',
  verificarRol(
    'ADMINISTRADOR',
    'SUPERVISOR'
  ),
  checklistController.obtenerTareas
);


// =====================================================
// CREAR TAREA
// SOLO SUPERVISOR
// =====================================================

router.post(
  '/',
  verificarRol('SUPERVISOR'),
  checklistController.crearTarea
);


// =====================================================
// HISTORIAL
// =====================================================

router.get(
  '/:id/historial',
  verificarRol(
    'ADMINISTRADOR',
    'SUPERVISOR'
  ),
  checklistController.obtenerHistorialTarea
);


// =====================================================
// ENTREGAS
// =====================================================

router.get(
  '/:id/entregas',
  verificarRol(
    'ADMINISTRADOR',
    'SUPERVISOR'
  ),
  checklistController.obtenerEntregasTarea
);


// =====================================================
// INICIAR TAREA
// SOLO ADMINISTRADOR
// =====================================================

router.patch(
  '/:id/iniciar',
  verificarRol('ADMINISTRADOR'),
  checklistController.iniciarTarea
);


// =====================================================
// ENTREGAR O REENTREGAR
// SOLO ADMINISTRADOR
// =====================================================

router.post(
  '/:id/entregar',
  verificarRol('ADMINISTRADOR'),
  checklistController.entregarTarea
);


// =====================================================
// CANCELAR ENTREGA
// SOLO ADMINISTRADOR
// =====================================================

router.patch(
  '/:id/cancelar-entrega',
  verificarRol('ADMINISTRADOR'),
  checklistController.cancelarEntrega
);


// =====================================================
// ACEPTAR ENTREGA
// SOLO SUPERVISOR
// =====================================================

router.patch(
  '/:id/aceptar',
  verificarRol('SUPERVISOR'),
  checklistController.aceptarEntrega
);


// =====================================================
// RECHAZAR ENTREGA
// SOLO SUPERVISOR
// =====================================================

router.patch(
  '/:id/rechazar',
  verificarRol('SUPERVISOR'),
  checklistController.rechazarEntrega
);


// =====================================================
// CANCELAR TAREA
// SOLO SUPERVISOR
// BAJA LÓGICA
// =====================================================

router.patch(
  '/:id/cancelar',
  verificarRol('SUPERVISOR'),
  checklistController.cancelarTarea
);


// =====================================================
// EDITAR TAREA
// SOLO SUPERVISOR
// =====================================================

router.put(
  '/:id',
  verificarRol('SUPERVISOR'),
  checklistController.editarTarea
);


// =====================================================
// CONSULTAR UNA TAREA
// DEBE IR DESPUÉS DE RUTAS ESPECÍFICAS
// =====================================================

router.get(
  '/:id',
  verificarRol(
    'ADMINISTRADOR',
    'SUPERVISOR'
  ),
  checklistController.obtenerTareaPorId
);


module.exports = router;