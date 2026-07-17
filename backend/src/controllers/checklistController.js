const { checklistTaskRequestDto } = require('../dto/requestDtos');
const checklistService = require('../services/checklistService');

const obtenerIdUsuarioToken = (req) => req.usuario?.id_usuario;
const obtenerRolToken = (req) => req.usuario?.rol;
const enviarError = (res, error) => res.status(error.status).json({ mensaje: error.mensaje });

const crearTarea = async (req, res) => {
  try {
    const resultado = await checklistService.crearTarea(
      checklistTaskRequestDto(req.body),
      obtenerIdUsuarioToken(req)
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(201).json({
      mensaje: 'Tarea creada correctamente',
      id_tarea: resultado.id_tarea
    });
  } catch (error) {
    console.error('Error al crear tarea:', error);
    return res.status(500).json({ mensaje: 'Error interno al crear la tarea' });
  }
};

const obtenerTareas = async (req, res) => {
  try {
    const resultado = await checklistService.listarTareas(
      req.query,
      obtenerRolToken(req),
      obtenerIdUsuarioToken(req)
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({
      total: resultado.tareas.length,
      tareas: resultado.tareas
    });
  } catch (error) {
    console.error('Error al obtener tareas:', error);
    return res.status(500).json({ mensaje: 'Error interno al obtener las tareas' });
  }
};

const obtenerTareaPorId = async (req, res) => {
  try {
    const resultado = await checklistService.obtenerTareaPorId(
      req.params.id,
      obtenerRolToken(req),
      obtenerIdUsuarioToken(req)
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({ tarea: resultado.tarea });
  } catch (error) {
    console.error('Error al obtener tarea:', error);
    return res.status(500).json({ mensaje: 'Error interno al obtener la tarea' });
  }
};

const editarTarea = async (req, res) => {
  try {
    const resultado = await checklistService.editarTarea(
      req.params.id,
      checklistTaskRequestDto(req.body),
      obtenerIdUsuarioToken(req)
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({ mensaje: 'Tarea actualizada correctamente' });
  } catch (error) {
    console.error('Error al editar tarea:', error);
    return res.status(500).json({ mensaje: 'Error interno al editar la tarea' });
  }
};

const iniciarTarea = async (req, res) => {
  try {
    const resultado = await checklistService.iniciarTarea(
      req.params.id,
      obtenerIdUsuarioToken(req)
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({ mensaje: 'Tarea iniciada correctamente' });
  } catch (error) {
    console.error('Error al iniciar tarea:', error);
    return res.status(500).json({ mensaje: 'Error interno al iniciar la tarea' });
  }
};

const entregarTarea = async (req, res) => {
  try {
    const resultado = await checklistService.entregarTarea(
      req.params.id,
      obtenerIdUsuarioToken(req),
      req.body.comentario_entrega
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(201).json({
      mensaje: 'Tarea entregada correctamente',
      numero_intento: resultado.numero_intento
    });
  } catch (error) {
    console.error('Error al entregar tarea:', error);
    return res.status(500).json({ mensaje: 'Error interno al entregar la tarea' });
  }
};

const cancelarEntrega = async (req, res) => {
  try {
    const resultado = await checklistService.cancelarEntrega(
      req.params.id,
      obtenerIdUsuarioToken(req)
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({
      mensaje: 'Entrega cancelada. La tarea volvió a En proceso'
    });
  } catch (error) {
    console.error('Error al cancelar entrega:', error);
    return res.status(500).json({ mensaje: 'Error interno al cancelar la entrega' });
  }
};

const aceptarEntrega = async (req, res) => {
  try {
    const resultado = await checklistService.aceptarEntrega(
      req.params.id,
      obtenerIdUsuarioToken(req),
      req.body.comentario_revision
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({
      mensaje: 'Entrega aceptada. La tarea fue completada'
    });
  } catch (error) {
    console.error('Error al aceptar entrega:', error);
    return res.status(500).json({ mensaje: 'Error interno al aceptar la entrega' });
  }
};

const rechazarEntrega = async (req, res) => {
  try {
    const resultado = await checklistService.rechazarEntrega(
      req.params.id,
      obtenerIdUsuarioToken(req),
      req.body.comentario_revision
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({ mensaje: 'Entrega rechazada correctamente' });
  } catch (error) {
    console.error('Error al rechazar entrega:', error);
    return res.status(500).json({ mensaje: 'Error interno al rechazar la entrega' });
  }
};

const cancelarTarea = async (req, res) => {
  try {
    const resultado = await checklistService.cancelarTarea(
      req.params.id,
      obtenerIdUsuarioToken(req),
      req.body.comentario
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({ mensaje: 'Tarea cancelada correctamente' });
  } catch (error) {
    console.error('Error al cancelar tarea:', error);
    return res.status(500).json({ mensaje: 'Error interno al cancelar la tarea' });
  }
};

const obtenerHistorialTarea = async (req, res) => {
  try {
    const resultado = await checklistService.obtenerHistorial(
      req.params.id,
      obtenerRolToken(req),
      obtenerIdUsuarioToken(req)
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({
      total: resultado.historial.length,
      historial: resultado.historial
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return res.status(500).json({ mensaje: 'Error interno al obtener el historial' });
  }
};

const obtenerEntregasTarea = async (req, res) => {
  try {
    const resultado = await checklistService.obtenerEntregas(
      req.params.id,
      obtenerRolToken(req),
      obtenerIdUsuarioToken(req)
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({
      total: resultado.entregas.length,
      entregas: resultado.entregas
    });
  } catch (error) {
    console.error('Error al obtener entregas:', error);
    return res.status(500).json({ mensaje: 'Error interno al obtener las entregas' });
  }
};

const obtenerAlertasPendientes = async (req, res) => {
  try {
    const alertas = await checklistService.obtenerAlertasPendientes(
      obtenerIdUsuarioToken(req)
    );
    return res.status(200).json({ total: alertas.length, alertas });
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    return res.status(500).json({ mensaje: 'Error interno al obtener las alertas' });
  }
};

const obtenerAdministradores = async (req, res) => {
  try {
    const administradores = await checklistService.obtenerAdministradores();
    return res.status(200).json({ total: administradores.length, administradores });
  } catch (error) {
    console.error('Error al obtener administradores:', error);
    return res.status(500).json({ mensaje: 'Error interno al obtener administradores' });
  }
};

const exportarExcel = async (req, res) => {
  try {
    const resultado = await checklistService.exportarExcel(
      req.query,
      obtenerRolToken(req),
      obtenerIdUsuarioToken(req)
    );
    if (resultado.error) return enviarError(res, resultado.error);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=checklist.xlsx');
    await resultado.workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar checklist:', error);
    if (!res.headersSent) {
      return res.status(500).json({ mensaje: 'Error interno al exportar el archivo Excel' });
    }
  }
};

module.exports = {
  crearTarea,
  obtenerTareas,
  obtenerTareaPorId,
  editarTarea,
  iniciarTarea,
  entregarTarea,
  cancelarEntrega,
  aceptarEntrega,
  rechazarEntrega,
  cancelarTarea,
  obtenerHistorialTarea,
  obtenerEntregasTarea,
  obtenerAlertasPendientes,
  obtenerAdministradores,
  exportarExcel
};
