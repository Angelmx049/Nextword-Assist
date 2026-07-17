const { mcRequestDto } = require('../dto/requestDtos');
const mcService = require('../services/mcService');

const obtenerIdUsuario = (req) => (
  req.usuario?.id_usuario ||
  req.usuario?.id ||
  req.user?.id_usuario ||
  req.user?.id ||
  null
);

const enviarErrorServicio = (res, error) => res.status(error.status).json({
  ok: false,
  mensaje: error.mensaje
});

const obtenerRegistrosMC = async (req, res) => {
  try {
    const registros = await mcService.listar(req.query.operador, req.query.fecha);
    return res.status(200).json({
      ok: true,
      total: registros.length,
      registros
    });
  } catch (error) {
    console.error('Error al obtener registros MC:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener los registros de MC'
    });
  }
};

const obtenerRegistroMCPorId = async (req, res) => {
  try {
    const registro = await mcService.obtenerPorId(req.params.id);
    if (!registro) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Registro MC no encontrado'
      });
    }
    return res.status(200).json({ ok: true, registro });
  } catch (error) {
    console.error('Error al obtener registro MC:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener el registro MC'
    });
  }
};

const crearRegistroMC = async (req, res) => {
  try {
    const resultado = await mcService.crear(
      mcRequestDto(req.body),
      obtenerIdUsuario(req)
    );
    if (resultado.error) return enviarErrorServicio(res, resultado.error);
    return res.status(201).json({
      ok: true,
      mensaje: 'Registro MC creado correctamente',
      registro: resultado.registro
    });
  } catch (error) {
    console.error('Error al crear registro MC:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al crear el registro MC'
    });
  }
};

const actualizarRegistroMC = async (req, res) => {
  try {
    const resultado = await mcService.actualizar(
      req.params.id,
      mcRequestDto(req.body)
    );
    if (resultado.error) return enviarErrorServicio(res, resultado.error);
    return res.status(200).json({
      ok: true,
      mensaje: 'Registro MC actualizado correctamente',
      registro: resultado.registro
    });
  } catch (error) {
    console.error('Error al actualizar registro MC:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al actualizar el registro MC'
    });
  }
};

const eliminarRegistroMC = async (req, res) => {
  try {
    const resultado = await mcService.eliminar(req.params.id);
    if (resultado.error) return enviarErrorServicio(res, resultado.error);
    return res.status(200).json({
      ok: true,
      mensaje: 'Registro MC eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar registro MC:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al eliminar el registro MC'
    });
  }
};

const exportarRegistrosMC = async (req, res) => {
  try {
    const resultado = await mcService.exportar(
      req.query.operador,
      req.query.fecha
    );
    if (resultado.error) return enviarErrorServicio(res, resultado.error);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resultado.nombreArchivo}"`
    );
    return res.send(resultado.buffer);
  } catch (error) {
    console.error('Error al exportar registros MC:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al exportar los registros MC'
    });
  }
};

module.exports = {
  obtenerRegistrosMC,
  obtenerRegistroMCPorId,
  crearRegistroMC,
  actualizarRegistroMC,
  eliminarRegistroMC,
  exportarRegistrosMC
};
