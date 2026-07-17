const db = require('../config/db');

const crearAlertasVencimiento = async (
  connection,
  { idTarea, destinatarioId, titulo, fechaVencimiento, version }
) => {
  const [umbrales] = await connection.query(
    `SELECT minutos
     FROM (
       SELECT 30 AS minutos
       UNION ALL SELECT 20
       UNION ALL SELECT 10
     ) AS limites
     WHERE DATE_SUB(?, INTERVAL minutos MINUTE) > NOW()`,
    [fechaVencimiento]
  );

  for (const { minutos } of umbrales) {
    const tipo = `VENCIMIENTO_${minutos}`;
    await connection.query(
      `INSERT INTO notificaciones (
         id_tarea, destinatario_id, tipo, minutos_antes, mensaje,
         fecha_programada, estado, leida, evento_origen,
         version_vencimiento, clave_idempotencia
       ) VALUES (?, ?, ?, ?, ?, DATE_SUB(?, INTERVAL ? MINUTE),
                 'Programada', 0, 'Vencimiento', ?, ?)
       ON DUPLICATE KEY UPDATE clave_idempotencia = clave_idempotencia`,
      [
        idTarea,
        destinatarioId,
        tipo,
        minutos,
        `La tarea “${titulo}” vence en ${minutos} minutos.`,
        fechaVencimiento,
        minutos,
        version,
        `vencimiento:${idTarea}:${destinatarioId}:${version}:${minutos}`
      ]
    );
  }
};

const obtenerSiguienteVersionVencimiento = async (connection, idTarea) => {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(version_vencimiento), 0) + 1 AS version
     FROM notificaciones
     WHERE id_tarea = ? AND evento_origen = 'Vencimiento'`,
    [idTarea]
  );
  return Number(rows[0].version);
};

const cancelarAlertasVencimiento = async (connection, idTarea) => {
  await connection.query(
    `UPDATE notificaciones
     SET estado = 'Cancelada'
     WHERE id_tarea = ?
       AND evento_origen = 'Vencimiento'
       AND estado = 'Programada'
       AND leida = 0`,
    [idTarea]
  );
};

const crearNotificacionEntrega = async (
  connection,
  { idTarea, idEntrega, destinatarioId, titulo, esReentrega }
) => {
  const tipo = esReentrega ? 'TAREA_REENTREGADA' : 'TAREA_ENTREGADA';
  const evento = esReentrega ? 'Reentrega' : 'Entrega';
  const verbo = esReentrega ? 'fue reenviada' : 'fue entregada';
  await connection.query(
    `INSERT INTO notificaciones (
       id_tarea, destinatario_id, tipo, mensaje, fecha_programada,
       estado, leida, evento_origen, id_entrega, clave_idempotencia
     ) VALUES (?, ?, ?, ?, NOW(), 'Programada', 0, ?, ?, ?)
     ON DUPLICATE KEY UPDATE clave_idempotencia = clave_idempotencia`,
    [
      idTarea,
      destinatarioId,
      tipo,
      `La tarea “${titulo}” ${verbo} y está pendiente de revisión.`,
      evento,
      idEntrega,
      `entrega:${idEntrega}:${destinatarioId}:${tipo}`
    ]
  );
};

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

const listarDisponibles = async (idUsuario) => {
  const [notificaciones] = await db.query(
    `${seleccionarDisponibles}
     ORDER BY n.fecha_programada DESC, n.id_notificacion DESC`,
    [idUsuario]
  );
  return notificaciones;
};

const contarNoLeidas = async (idUsuario) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total_no_leidas
     FROM notificaciones
     WHERE destinatario_id = ?
       AND estado = 'Programada'
       AND leida = 0
       AND fecha_programada <= NOW()`,
    [idUsuario]
  );
  return Number(rows[0].total_no_leidas);
};

const marcarLeida = async (idNotificacion, idUsuario) => {
  const [resultado] = await db.query(
    `UPDATE notificaciones
     SET leida = 1,
         estado = 'Leida',
         fecha_lectura = COALESCE(fecha_lectura, NOW())
     WHERE id_notificacion = ?
       AND destinatario_id = ?
       AND estado <> 'Cancelada'
       AND fecha_programada <= NOW()`,
    [idNotificacion, idUsuario]
  );
  return resultado.affectedRows;
};

const buscarPropia = async (idNotificacion, idUsuario) => {
  const [rows] = await db.query(
    `SELECT id_notificacion, leida
     FROM notificaciones
     WHERE id_notificacion = ? AND destinatario_id = ?`,
    [idNotificacion, idUsuario]
  );
  return rows[0] || null;
};

const marcarTodasLeidas = async (idUsuario) => {
  const [resultado] = await db.query(
    `UPDATE notificaciones
     SET leida = 1, estado = 'Leida', fecha_lectura = COALESCE(fecha_lectura, NOW())
     WHERE destinatario_id = ?
       AND estado = 'Programada'
       AND leida = 0
       AND fecha_programada <= NOW()`,
    [idUsuario]
  );
  return resultado.affectedRows;
};

module.exports = {
  listarDisponibles,
  contarNoLeidas,
  marcarLeida,
  buscarPropia,
  marcarTodasLeidas,
  crearAlertasVencimiento,
  obtenerSiguienteVersionVencimiento,
  cancelarAlertasVencimiento,
  crearNotificacionEntrega
};
