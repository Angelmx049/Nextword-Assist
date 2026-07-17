const { gembaRequestDto } = require('../dto/requestDtos');
const gembaService = require('../services/gembaService');

const obtenerIdUsuario = (req) => req.usuario?.id_usuario ?? req.usuario?.id ?? null;
const obtenerRolUsuario = (req) => req.usuario?.rol ?? null;

const enviarError = (res, error) => res.status(error.status).json({
  mensaje: error.mensaje,
  ...(error.errores ? { errores: error.errores } : {})
});

const obtenerCouriersActivos = async (req, res) => {
  try {
    const couriers = await gembaService.listarCouriersActivos();
    return res.status(200).json({ total: couriers.length, couriers });
  } catch (error) {
    console.error('Error al consultar couriers:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar los couriers.' });
  }
};

const crearEvaluacion = async (req, res) => {
  try {
    const resultado = await gembaService.crear(
      gembaRequestDto(req.body),
      obtenerIdUsuario(req)
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(201).json({
      mensaje: 'Evaluación GEMBA RIDE registrada correctamente.',
      id_gemba: resultado.id_gemba,
      courier: resultado.courier
    });
  } catch (error) {
    console.error('Error al crear evaluación GEMBA RIDE:', error);
    return res.status(500).json({ mensaje: 'Error interno al guardar la evaluación.' });
  }
};

const obtenerEvaluaciones = async (req, res) => {
  try {
    const resultado = await gembaService.listar(req.query);
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({
      total: resultado.registros.length,
      filtros: {
        id_courier: req.query.id_courier || null,
        fecha: req.query.fecha || null,
        manejo: req.query.manejo || null
      },
      registros: resultado.registros
    });
  } catch (error) {
    console.error('Error al consultar GEMBA RIDE:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar el historial.' });
  }
};

const obtenerEvaluacionPorId = async (req, res) => {
  try {
    const resultado = await gembaService.obtenerPorId(req.params.id);
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json(resultado.registro);
  } catch (error) {
    console.error('Error al consultar evaluación GEMBA RIDE:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar la evaluación.' });
  }
};

const actualizarEvaluacion = async (req, res) => {
  try {
    const resultado = await gembaService.actualizar(
      req.params.id,
      gembaRequestDto(req.body),
      obtenerIdUsuario(req),
      obtenerRolUsuario(req)
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({
      mensaje: 'Evaluación GEMBA RIDE actualizada correctamente.',
      id_gemba: resultado.id_gemba,
      courier: resultado.courier
    });
  } catch (error) {
    console.error('Error al actualizar evaluación GEMBA RIDE:', error);
    return res.status(500).json({ mensaje: 'Error interno al actualizar la evaluación.' });
  }
};

const eliminarEvaluacion = async (req, res) => {
  try {
    const resultado = await gembaService.eliminar(req.params.id);
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({ mensaje: 'Evaluación GEMBA RIDE eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar GEMBA RIDE:', error);
    return res.status(500).json({ mensaje: 'Error interno al eliminar la evaluación.' });
  }
};

const exportarExcel = async (req, res) => {
  try {
    const resultado = await gembaService.exportar(req.query);
    if (resultado.error) return enviarError(res, resultado.error);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resultado.nombreArchivo}"`
    );
    await resultado.workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Error al exportar GEMBA RIDE a Excel:', error);
    if (!res.headersSent) {
      return res.status(500).json({ mensaje: 'Error interno al generar el archivo Excel.' });
    }
    return res.end();
  }
};

module.exports = {
  obtenerCouriersActivos,
  crearEvaluacion,
  obtenerEvaluaciones,
  obtenerEvaluacionPorId,
  actualizarEvaluacion,
  eliminarEvaluacion,
  exportarExcel
};
