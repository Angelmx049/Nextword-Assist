const notificacionModel = require('../models/notificacionModel');

const listar = async (idUsuario) => {
  const notificaciones = await notificacionModel.listarDisponibles(idUsuario);
  const totalNoLeidas = notificaciones.reduce(
    (total, item) => total + (item.leida ? 0 : 1),
    0
  );
  return {
    total_no_leidas: totalNoLeidas,
    notificaciones: notificaciones.map((item) => ({
      ...item,
      leida: Boolean(item.leida)
    }))
  };
};

const obtenerResumen = async (idUsuario) => ({
  total_no_leidas: await notificacionModel.contarNoLeidas(idUsuario)
});

const marcarLeida = async (idNotificacion, idUsuario) => {
  const actualizadas = await notificacionModel.marcarLeida(
    idNotificacion,
    idUsuario
  );
  if (actualizadas === 0) {
    const notificacion = await notificacionModel.buscarPropia(
      idNotificacion,
      idUsuario
    );
    if (!notificacion) {
      return { error: { status: 404, mensaje: 'Notificación no encontrada' } };
    }
    if (!notificacion.leida) {
      return {
        error: {
          status: 409,
          mensaje: 'La notificación todavía no está disponible'
        }
      };
    }
  }
  return { mensaje: 'Notificación marcada como leída' };
};

const marcarTodasLeidas = async (idUsuario) => ({
  mensaje: 'Notificaciones marcadas como leídas',
  total_actualizadas: await notificacionModel.marcarTodasLeidas(idUsuario)
});

module.exports = { listar, obtenerResumen, marcarLeida, marcarTodasLeidas };
