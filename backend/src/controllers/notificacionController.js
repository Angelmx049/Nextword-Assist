const db = require('../config/db');

const obtenerIdUsuario = (req) => req.usuario?.id_usuario;

const seleccionarDisponibles = `
  SELECT
    n.id_notificacion,
    n.id_tarea,
    n.tipo,
    t.titulo AS titulo_tarea,
    n.mensaje,
    n.fecha_programada,
    t.fecha_vencimiento,
    n.leida,
    n.fecha_lectura,
    n.fecha_creacion,
    CASE
      WHEN n.leida = 1 THEN 'Leida'
      ELSE 'Disponible'
    END AS estado
  FROM notificaciones n
  INNER JOIN checklist_tareas t ON t.id_tarea = n.id_tarea
  WHERE n.destinatario_id = ?
    AND n.estado <> 'Cancelada'
    AND n.fecha_programada <= NOW()
`;

const listarNotificaciones = async (req, res) => {
  try {
    const idUsuario = obtenerIdUsuario(req);
    const [notificaciones] = await db.query(
      `${seleccionarDisponibles}
       ORDER BY n.fecha_programada DESC, n.id_notificacion DESC`,
      [idUsuario]
    );
    const totalNoLeidas = notificaciones.reduce(
      (total, item) => total + (item.leida ? 0 : 1),
      0
    );
    return res.status(200).json({
      total_no_leidas: totalNoLeidas,
      notificaciones: notificaciones.map((item) => ({
        ...item,
        leida: Boolean(item.leida)
      }))
    });
  } catch (error) {
    console.error('Error al listar notificaciones:', error);
    return res.status(500).json({ mensaje: 'Error interno al obtener las notificaciones' });
  }
};

const obtenerResumen = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS total_no_leidas
       FROM notificaciones
       WHERE destinatario_id = ?
         AND estado = 'Programada'
         AND leida = 0
         AND fecha_programada <= NOW()`,
      [obtenerIdUsuario(req)]
    );
    return res.status(200).json({ total_no_leidas: Number(rows[0].total_no_leidas) });
  } catch (error) {
    console.error('Error al obtener resumen de notificaciones:', error);
    return res.status(500).json({ mensaje: 'Error interno al obtener el resumen de notificaciones' });
  }
};

const marcarLeida = async (req, res) => {
  try {
    const [resultado] = await db.query(
      `UPDATE notificaciones
       SET leida = 1,
           estado = 'Leida',
           fecha_lectura = COALESCE(fecha_lectura, NOW())
       WHERE id_notificacion = ?
         AND destinatario_id = ?
         AND estado <> 'Cancelada'
         AND fecha_programada <= NOW()`,
      [req.params.id, obtenerIdUsuario(req)]
    );
    if (resultado.affectedRows === 0) {
      const [rows] = await db.query(
        `SELECT id_notificacion, leida
         FROM notificaciones
         WHERE id_notificacion = ? AND destinatario_id = ?`,
        [req.params.id, obtenerIdUsuario(req)]
      );
      if (rows.length === 0) return res.status(404).json({ mensaje: 'Notificación no encontrada' });
      if (!rows[0].leida) return res.status(409).json({ mensaje: 'La notificación todavía no está disponible' });
    }
    return res.status(200).json({ mensaje: 'Notificación marcada como leída' });
  } catch (error) {
    console.error('Error al marcar notificación:', error);
    return res.status(500).json({ mensaje: 'Error interno al marcar la notificación' });
  }
};

const marcarTodasLeidas = async (req, res) => {
  try {
    const [resultado] = await db.query(
      `UPDATE notificaciones
       SET leida = 1, estado = 'Leida', fecha_lectura = COALESCE(fecha_lectura, NOW())
       WHERE destinatario_id = ?
         AND estado = 'Programada'
         AND leida = 0
         AND fecha_programada <= NOW()`,
      [obtenerIdUsuario(req)]
    );
    return res.status(200).json({
      mensaje: 'Notificaciones marcadas como leídas',
      total_actualizadas: resultado.affectedRows
    });
  } catch (error) {
    console.error('Error al marcar todas las notificaciones:', error);
    return res.status(500).json({ mensaje: 'Error interno al marcar las notificaciones' });
  }
};

module.exports = { listarNotificaciones, obtenerResumen, marcarLeida, marcarTodasLeidas };

