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

module.exports = {
  crearAlertasVencimiento,
  obtenerSiguienteVersionVencimiento,
  cancelarAlertasVencimiento,
  crearNotificacionEntrega
};

