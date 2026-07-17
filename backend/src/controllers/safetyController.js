const { safetyFindingRequestDto } = require('../dto/requestDtos');
const safetyService = require('../services/safetyService');

const enviarError = (res, error) => res.status(error.status).json({ mensaje: error.mensaje });

const obtenerAreas = async (req, res) => {
  try {
    const areas = await safetyService.listarAreas();
    return res.status(200).json({ total: areas.length, areas });
  } catch (error) {
    console.error('Error al obtener áreas Safety:', error);
    return res.status(500).json({ mensaje: 'Error al obtener las áreas de Safety' });
  }
};

const obtenerHallazgosRecientes = async (req, res) => {
  try {
    const resultado = await safetyService.listarRecientes(req.params.id_area);
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({
      total: resultado.hallazgos.length,
      hallazgos: resultado.hallazgos
    });
  } catch (error) {
    console.error('Error al obtener hallazgos recientes Safety:', error);
    return res.status(500).json({ mensaje: 'Error al obtener los hallazgos recientes' });
  }
};

const crearHallazgo = async (req, res) => {
  try {
    const resultado = await safetyService.crear(
      safetyFindingRequestDto(req.body),
      req.file,
      req.usuario.id_usuario
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(201).json({
      mensaje: 'Hallazgo Safety registrado correctamente',
      hallazgo: resultado.hallazgo
    });
  } catch (error) {
    console.error('Error al crear hallazgo Safety:', error);
    return res.status(500).json({ mensaje: 'Error al registrar el hallazgo Safety' });
  }
};

const obtenerHistorial = async (req, res) => {
  try {
    const resultado = await safetyService.obtenerHistorial(req.params.id_area, req.query);
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({
      hallazgos: resultado.hallazgos,
      paginacion: resultado.paginacion
    });
  } catch (error) {
    console.error('Error al obtener historial Safety:', error);
    return res.status(500).json({ mensaje: 'Error al obtener el historial Safety' });
  }
};

const obtenerHallazgoPorId = async (req, res) => {
  try {
    const resultado = await safetyService.obtenerPorId(req.params.id_hallazgo);
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json(resultado.hallazgo);
  } catch (error) {
    console.error('Error al obtener hallazgo Safety:', error);
    return res.status(500).json({ mensaje: 'Error al obtener el hallazgo Safety' });
  }
};

const exportarHistorial = async (req, res) => {
  try {
    const resultado = await safetyService.exportar(req.params.id_area, req.query);
    if (resultado.error) return enviarError(res, resultado.error);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${resultado.nombreArchivo}"`);
    await resultado.workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Error al exportar historial Safety:', error);
    if (!res.headersSent) {
      return res.status(500).json({ mensaje: 'Error interno al generar el archivo Excel' });
    }
    return res.end();
  }
};

module.exports = {
  obtenerAreas,
  obtenerHallazgosRecientes,
  crearHallazgo,
  obtenerHistorial,
  obtenerHallazgoPorId,
  exportarHistorial
};
