const { slamRequestDto } = require('../dto/requestDtos');
const slamService = require('../services/slamService');

const enviarError = (res, error) => res.status(error.status).json({ mensaje: error.mensaje });

const crearSlam = async (req, res) => {
  try {
    const resultado = await slamService.crear(
      slamRequestDto(req.body),
      req.file,
      req.usuario.id_usuario
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(201).json({
      mensaje: 'Práctica SLAM registrada correctamente',
      practica: resultado.practica
    });
  } catch (error) {
    console.error('Error al crear práctica SLAM:', error);
    return res.status(500).json({ mensaje: 'Error al registrar la práctica SLAM' });
  }
};

const obtenerSlams = async (req, res) => {
  try {
    const practicas = await slamService.listar();
    return res.status(200).json({ total: practicas.length, practicas });
  } catch (error) {
    console.error('Error al obtener historial SLAM:', error);
    return res.status(500).json({ mensaje: 'Error al obtener el historial SLAM' });
  }
};

const obtenerContadorSlam = async (req, res) => {
  try {
    return res.status(200).json({ total: await slamService.contar() });
  } catch (error) {
    console.error('Error al obtener contador SLAM:', error);
    return res.status(500).json({ mensaje: 'Error al obtener el contador de prácticas' });
  }
};

const obtenerSlamPorId = async (req, res) => {
  try {
    const practica = await slamService.obtenerPorId(req.params.id);
    if (!practica) {
      return res.status(404).json({ mensaje: 'Práctica SLAM no encontrada' });
    }
    return res.status(200).json(practica);
  } catch (error) {
    console.error('Error al obtener práctica SLAM:', error);
    return res.status(500).json({ mensaje: 'Error al obtener la práctica SLAM' });
  }
};

const actualizarSlam = async (req, res) => {
  try {
    const resultado = await slamService.actualizar(
      req.params.id,
      slamRequestDto(req.body),
      req.file
    );
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({ mensaje: 'Práctica SLAM actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar práctica SLAM:', error);
    return res.status(500).json({ mensaje: 'Error al actualizar la práctica SLAM' });
  }
};

const eliminarSlam = async (req, res) => {
  try {
    const resultado = await slamService.eliminar(req.params.id);
    if (resultado.error) return enviarError(res, resultado.error);
    return res.status(200).json({ mensaje: 'Práctica SLAM eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar práctica SLAM:', error);
    return res.status(500).json({ mensaje: 'Error al eliminar la práctica SLAM' });
  }
};

const exportarExcel = async (req, res) => {
  try {
    const workbook = await slamService.exportar();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=slam.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar SLAM:', error);
    if (!res.headersSent) {
      return res.status(500).json({ mensaje: 'Error interno al exportar el archivo Excel' });
    }
  }
};

module.exports = {
  crearSlam,
  obtenerSlams,
  obtenerContadorSlam,
  exportarExcel,
  obtenerSlamPorId,
  actualizarSlam,
  eliminarSlam
};
