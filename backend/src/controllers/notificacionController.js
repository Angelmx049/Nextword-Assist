const notificacionService = require('../services/notificacionService');

const obtenerIdUsuario = (req) => req.usuario?.id_usuario;

const listarNotificaciones = async (req, res) => {
  try {
    const resultado = await notificacionService.listar(obtenerIdUsuario(req));
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('Error al listar notificaciones:', error);
    return res.status(500).json({ mensaje: 'Error interno al obtener las notificaciones' });
  }
};

const obtenerResumen = async (req, res) => {
  try {
    const resultado = await notificacionService.obtenerResumen(
      obtenerIdUsuario(req)
    );
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('Error al obtener resumen de notificaciones:', error);
    return res.status(500).json({ mensaje: 'Error interno al obtener el resumen de notificaciones' });
  }
};

const marcarLeida = async (req, res) => {
  try {
    const resultado = await notificacionService.marcarLeida(
      req.params.id,
      obtenerIdUsuario(req)
    );
    if (resultado.error) {
      return res
        .status(resultado.error.status)
        .json({ mensaje: resultado.error.mensaje });
    }
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('Error al marcar notificación:', error);
    return res.status(500).json({ mensaje: 'Error interno al marcar la notificación' });
  }
};

const marcarTodasLeidas = async (req, res) => {
  try {
    const resultado = await notificacionService.marcarTodasLeidas(
      obtenerIdUsuario(req)
    );
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('Error al marcar todas las notificaciones:', error);
    return res.status(500).json({ mensaje: 'Error interno al marcar las notificaciones' });
  }
};

module.exports = {
  listarNotificaciones,
  obtenerResumen,
  marcarLeida,
  marcarTodasLeidas
};
