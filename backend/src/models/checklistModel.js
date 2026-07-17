const db = require('../config/db');

const obtenerConexion = () => db.getConnection();
const iniciarTransaccion = (connection) => connection.beginTransaction();
const confirmarTransaccion = (connection) => connection.commit();
const revertirTransaccion = (connection) => connection.rollback();
const liberarConexion = (connection) => connection.release();

const cancelarAlertasDeTareasVencidas = (connection) => connection.query(`
  UPDATE notificaciones n
  INNER JOIN checklist_tareas t ON t.id_tarea = n.id_tarea
  SET n.estado = 'Cancelada'
  WHERE t.fecha_vencimiento < NOW()
    AND t.estado IN ('Pendiente', 'En proceso', 'Rechazada')
    AND n.evento_origen = 'Vencimiento'
    AND n.estado = 'Programada'
    AND n.leida = 0
`);

const marcarTareasVencidas = (connection) => connection.query(`
  UPDATE checklist_tareas
  SET estado = 'Vencida'
  WHERE fecha_vencimiento < NOW()
    AND estado IN ('Pendiente', 'En proceso', 'Rechazada')
`);

const actualizarTareasVencidas = async () => {
  const connection = await obtenerConexion();
  let transaccionIniciada = false;

  try {
    await iniciarTransaccion(connection);
    transaccionIniciada = true;
    await cancelarAlertasDeTareasVencidas(connection);
    await marcarTareasVencidas(connection);
    await confirmarTransaccion(connection);
    transaccionIniciada = false;
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await revertirTransaccion(connection);
      } catch (rollbackError) {
        console.error('Error al revertir la actualización de tareas vencidas:', rollbackError);
      }
      transaccionIniciada = false;
    }

    if (error.code !== 'ER_NO_SUCH_TABLE') throw error;

    console.error(
      'No se cancelaron alertas de vencimiento porque falta la tabla notificaciones. ' +
      'Ejecuta backend/sql/20260716_notificaciones.sql.',
      { code: error.code, errno: error.errno, sqlState: error.sqlState }
    );

    await iniciarTransaccion(connection);
    transaccionIniciada = true;
    try {
      await marcarTareasVencidas(connection);
      await confirmarTransaccion(connection);
      transaccionIniciada = false;
    } catch (checklistError) {
      await revertirTransaccion(connection);
      transaccionIniciada = false;
      throw checklistError;
    }
  } finally {
    if (transaccionIniciada) {
      try {
        await revertirTransaccion(connection);
      } catch (rollbackError) {
        console.error('Error al revertir la actualización de tareas vencidas:', rollbackError);
      }
    }
    liberarConexion(connection);
  }
};

const registrarHistorial = async (connection, datos) => {
  await connection.query(
    `
    INSERT INTO checklist_registros (
      id_tarea, tipo_evento, estado_anterior, estado_nuevo,
      comentario, actualizado_por
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      datos.idTarea,
      datos.tipoEvento,
      datos.estadoAnterior ?? null,
      datos.estadoNuevo ?? null,
      datos.comentario ?? null,
      datos.actualizadoPor
    ]
  );
};

const validarFechaFuturaYMinutos = async (connection, fecha) => {
  const [rows] = await connection.query(
    'SELECT ? > NOW() AS es_futura, TIMESTAMPDIFF(MINUTE, NOW(), ?) AS minutos',
    [fecha, fecha]
  );
  return rows[0];
};

const validarFechaFutura = async (connection, fecha) => {
  const [rows] = await connection.query('SELECT ? > NOW() AS es_futura', [fecha]);
  return rows[0].es_futura;
};

const calcularLimiteMinutos = async (connection, inicio, fin) => {
  const [rows] = await connection.query(
    'SELECT GREATEST(1, TIMESTAMPDIFF(MINUTE, ?, ?)) AS limite_minutos',
    [inicio, fin]
  );
  return Number(rows[0].limite_minutos);
};

const obtenerUsuarioConRol = async (connection, idUsuario) => {
  const [usuarios] = await connection.query(
    `
    SELECT u.id_usuario, r.nombre_rol
    FROM usuarios u
    INNER JOIN roles r ON u.id_rol = r.id_rol
    WHERE u.id_usuario = ?
    LIMIT 1
    `,
    [idUsuario]
  );
  return usuarios[0] || null;
};

const crearTarea = async (connection, datos) => {
  const [resultado] = await connection.query(
    `
    INSERT INTO checklist_tareas (
      titulo, descripcion, fecha_asignada, fecha_vencimiento,
      limite_minutos, estado, prioridad, creada_por, asignada_a
    )
    VALUES (?, ?, NOW(), ?, ?, 'Pendiente', ?, ?, ?)
    `,
    [
      datos.titulo,
      datos.descripcion,
      datos.fechaVencimiento,
      datos.limiteMinutos,
      datos.prioridad,
      datos.creadaPor,
      datos.asignadaA
    ]
  );
  return resultado.insertId;
};

const construirFiltros = ({ busqueda, estado, prioridad, responsable, fecha, rol, idUsuario }) => {
  const condiciones = [];
  const valores = [];
  if (rol === 'ADMINISTRADOR') {
    condiciones.push('t.asignada_a = ?');
    valores.push(idUsuario);
  }
  if (busqueda) {
    condiciones.push('(t.titulo LIKE ? OR t.descripcion LIKE ?)');
    valores.push(`%${busqueda}%`, `%${busqueda}%`);
  }
  if (estado) {
    condiciones.push('t.estado = ?');
    valores.push(estado);
  }
  if (prioridad) {
    condiciones.push('t.prioridad = ?');
    valores.push(prioridad);
  }
  if (responsable) {
    condiciones.push('t.asignada_a = ?');
    valores.push(responsable);
  }
  if (fecha) {
    condiciones.push('DATE(t.fecha_vencimiento) = ?');
    valores.push(fecha);
  }
  return {
    where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '',
    valores
  };
};

const listarTareas = async (filtros) => {
  const { where, valores } = construirFiltros(filtros);
  const [tareas] = await db.query(
    `
    SELECT
      t.id_tarea, t.titulo, t.descripcion, t.fecha_asignada,
      t.fecha_vencimiento, t.limite_minutos, t.estado, t.prioridad,
      t.creada_por, t.asignada_a, t.fecha_inicio, t.fecha_completada,
      t.fecha_creacion, t.fecha_actualizacion,
      creador.usuario AS creado_por_usuario,
      responsable.usuario AS responsable_usuario,
      TIMESTAMPDIFF(MINUTE, NOW(), t.fecha_vencimiento) AS minutos_restantes,
      CASE
        WHEN t.estado = 'Vencida' THEN 'Vencida'
        WHEN TIMESTAMPDIFF(MINUTE, NOW(), t.fecha_vencimiento) <= 10 THEN 'Rojo'
        WHEN TIMESTAMPDIFF(MINUTE, NOW(), t.fecha_vencimiento) <= 20 THEN 'Naranja'
        WHEN TIMESTAMPDIFF(MINUTE, NOW(), t.fecha_vencimiento) <= 30 THEN 'Amarillo'
        ELSE 'Normal'
      END AS nivel_alerta
    FROM checklist_tareas t
    INNER JOIN usuarios creador ON t.creada_por = creador.id_usuario
    INNER JOIN usuarios responsable ON t.asignada_a = responsable.id_usuario
    ${where}
    ORDER BY
      CASE t.estado
        WHEN 'Entregada' THEN 1 WHEN 'Rechazada' THEN 2
        WHEN 'En proceso' THEN 3 WHEN 'Pendiente' THEN 4
        WHEN 'Vencida' THEN 5 WHEN 'Completada' THEN 6
        WHEN 'Cancelada' THEN 7 ELSE 8
      END,
      t.fecha_vencimiento ASC
    `,
    valores
  );
  return tareas;
};

const obtenerTareaDetalle = async (id, rol, idUsuario) => {
  const valores = [id];
  const filtro = rol === 'ADMINISTRADOR' ? 'AND t.asignada_a = ?' : '';
  if (rol === 'ADMINISTRADOR') valores.push(idUsuario);
  const [tareas] = await db.query(
    `
    SELECT
      t.id_tarea, t.titulo, t.descripcion, t.fecha_asignada,
      t.fecha_vencimiento, t.limite_minutos, t.estado, t.prioridad,
      t.creada_por, t.asignada_a, t.fecha_inicio, t.fecha_completada,
      t.fecha_creacion, t.fecha_actualizacion,
      creador.usuario AS creado_por_usuario,
      responsable.usuario AS responsable_usuario,
      TIMESTAMPDIFF(MINUTE, NOW(), t.fecha_vencimiento) AS minutos_restantes,
      CASE
        WHEN t.estado = 'Vencida' THEN 'Vencida'
        WHEN TIMESTAMPDIFF(MINUTE, NOW(), t.fecha_vencimiento) <= 10 THEN 'Rojo'
        WHEN TIMESTAMPDIFF(MINUTE, NOW(), t.fecha_vencimiento) <= 20 THEN 'Naranja'
        WHEN TIMESTAMPDIFF(MINUTE, NOW(), t.fecha_vencimiento) <= 30 THEN 'Amarillo'
        ELSE 'Normal'
      END AS nivel_alerta
    FROM checklist_tareas t
    INNER JOIN usuarios creador ON t.creada_por = creador.id_usuario
    INNER JOIN usuarios responsable ON t.asignada_a = responsable.id_usuario
    WHERE t.id_tarea = ?
    ${filtro}
    LIMIT 1
    `,
    valores
  );
  return tareas[0] || null;
};

const obtenerTareaBloqueada = async (connection, id) => {
  const [tareas] = await connection.query(
    'SELECT * FROM checklist_tareas WHERE id_tarea = ? FOR UPDATE',
    [id]
  );
  return tareas[0] || null;
};

const obtenerTareaEditableBloqueada = async (connection, id) => {
  const [tareas] = await connection.query(
    `SELECT *, DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d %H:%i:%s') AS fecha_vencimiento_texto
     FROM checklist_tareas WHERE id_tarea = ? FOR UPDATE`,
    [id]
  );
  return tareas[0] || null;
};

const editarTarea = async (connection, id, datos) => {
  await connection.query(
    `
    UPDATE checklist_tareas
    SET titulo = ?, descripcion = ?, asignada_a = ?, fecha_vencimiento = ?,
        limite_minutos = ?, prioridad = ?
    WHERE id_tarea = ?
    `,
    [
      datos.titulo,
      datos.descripcion,
      datos.asignadaA,
      datos.fechaVencimiento,
      datos.limiteMinutos,
      datos.prioridad,
      id
    ]
  );
};

const marcarTareaVencida = (connection, id) => connection.query(
  "UPDATE checklist_tareas SET estado = 'Vencida' WHERE id_tarea = ?",
  [id]
);

const iniciarTarea = (connection, id) => connection.query(
  "UPDATE checklist_tareas SET estado = 'En proceso', fecha_inicio = NOW() WHERE id_tarea = ?",
  [id]
);

const obtenerUltimoIntento = async (connection, id) => {
  const [rows] = await connection.query(
    'SELECT COALESCE(MAX(numero_intento), 0) AS ultimo_intento FROM checklist_entregas WHERE id_tarea = ?',
    [id]
  );
  return rows[0].ultimo_intento;
};

const crearEntrega = async (connection, datos) => {
  const [resultado] = await connection.query(
    `INSERT INTO checklist_entregas
      (id_tarea, numero_intento, comentario_entrega, entregada_por, estado_revision)
     VALUES (?, ?, ?, ?, 'Pendiente')`,
    [datos.idTarea, datos.numeroIntento, datos.comentario, datos.entregadaPor]
  );
  return resultado.insertId;
};

const marcarTareaEntregada = (connection, id) => connection.query(
  "UPDATE checklist_tareas SET estado = 'Entregada' WHERE id_tarea = ?",
  [id]
);

const obtenerUltimaEntregaBloqueada = async (connection, id) => {
  const [entregas] = await connection.query(
    `SELECT * FROM checklist_entregas
     WHERE id_tarea = ?
     ORDER BY numero_intento DESC LIMIT 1 FOR UPDATE`,
    [id]
  );
  return entregas[0] || null;
};

const obtenerEntregaPendienteBloqueada = async (connection, id) => {
  const [entregas] = await connection.query(
    `SELECT * FROM checklist_entregas
     WHERE id_tarea = ?
       AND estado_revision = 'Pendiente'
     ORDER BY numero_intento DESC LIMIT 1 FOR UPDATE`,
    [id]
  );
  return entregas[0] || null;
};

const cancelarNotificacionEntrega = (connection, idEntrega) => connection.query(
  "UPDATE notificaciones SET estado = 'Cancelada' WHERE id_entrega = ? AND estado = 'Programada' AND leida = 0",
  [idEntrega]
);

const eliminarEntrega = (connection, idEntrega) => connection.query(
  'DELETE FROM checklist_entregas WHERE id_entrega = ?',
  [idEntrega]
);

const marcarTareaEnProceso = (connection, id) => connection.query(
  "UPDATE checklist_tareas SET estado = 'En proceso' WHERE id_tarea = ?",
  [id]
);

const aceptarEntrega = (connection, idEntrega, idUsuario, comentario) => connection.query(
  `UPDATE checklist_entregas
   SET estado_revision = 'Aceptada', revisada_por = ?,
       comentario_revision = ?, fecha_revision = NOW()
   WHERE id_entrega = ?`,
  [idUsuario, comentario, idEntrega]
);

const rechazarEntrega = (connection, idEntrega, idUsuario, comentario) => connection.query(
  `UPDATE checklist_entregas
   SET estado_revision = 'Rechazada', revisada_por = ?,
       comentario_revision = ?, fecha_revision = NOW()
   WHERE id_entrega = ?`,
  [idUsuario, comentario, idEntrega]
);

const completarTarea = (connection, id) => connection.query(
  "UPDATE checklist_tareas SET estado = 'Completada', fecha_completada = NOW() WHERE id_tarea = ?",
  [id]
);

const rechazarTarea = (connection, id) => connection.query(
  "UPDATE checklist_tareas SET estado = 'Rechazada' WHERE id_tarea = ?",
  [id]
);

const cancelarTarea = (connection, id) => connection.query(
  "UPDATE checklist_tareas SET estado = 'Cancelada' WHERE id_tarea = ?",
  [id]
);

const existeTareaPermitida = async (id, rol, idUsuario) => {
  const valores = [id];
  const filtro = rol === 'ADMINISTRADOR' ? 'AND t.asignada_a = ?' : '';
  if (rol === 'ADMINISTRADOR') valores.push(idUsuario);
  const [rows] = await db.query(
    `SELECT t.id_tarea FROM checklist_tareas t
     WHERE t.id_tarea = ? ${filtro} LIMIT 1`,
    valores
  );
  return rows.length > 0;
};

const obtenerHistorial = async (id) => {
  const [historial] = await db.query(
    `SELECT r.id_registro, r.id_tarea, r.tipo_evento, r.estado_anterior,
            r.estado_nuevo, r.comentario, r.actualizado_por,
            u.usuario AS actualizado_por_usuario, r.fecha_registro
     FROM checklist_registros r
     LEFT JOIN usuarios u ON r.actualizado_por = u.id_usuario
     WHERE r.id_tarea = ?
     ORDER BY r.fecha_registro ASC, r.id_registro ASC`,
    [id]
  );
  return historial;
};

const obtenerEntregas = async (id) => {
  const [entregas] = await db.query(
    `SELECT e.id_entrega, e.id_tarea, e.numero_intento, e.comentario_entrega,
            e.entregada_por, entregador.usuario AS entregada_por_usuario,
            e.fecha_entrega, e.estado_revision, e.revisada_por,
            revisor.usuario AS revisada_por_usuario, e.comentario_revision,
            e.fecha_revision
     FROM checklist_entregas e
     INNER JOIN usuarios entregador ON e.entregada_por = entregador.id_usuario
     LEFT JOIN usuarios revisor ON e.revisada_por = revisor.id_usuario
     WHERE e.id_tarea = ?
     ORDER BY e.numero_intento ASC`,
    [id]
  );
  return entregas;
};

const obtenerAlertasPendientes = async (idUsuario) => {
  const [alertas] = await db.query(
    `SELECT n.id_notificacion AS id_alerta, n.id_tarea, n.minutos_antes,
            n.fecha_programada, t.titulo, t.descripcion, t.fecha_vencimiento,
            t.estado, t.prioridad,
            TIMESTAMPDIFF(MINUTE, NOW(), t.fecha_vencimiento) AS minutos_restantes
     FROM notificaciones n
     INNER JOIN checklist_tareas t ON n.id_tarea = t.id_tarea
     WHERE n.destinatario_id = ?
       AND n.evento_origen = 'Vencimiento'
       AND n.estado <> 'Cancelada'
       AND n.leida = 0
       AND n.fecha_programada <= NOW()
       AND t.estado IN ('Pendiente', 'En proceso')
     ORDER BY n.fecha_programada DESC`,
    [idUsuario]
  );
  return alertas;
};

const obtenerAdministradores = async () => {
  const [administradores] = await db.query(
    `SELECT u.id_usuario, u.usuario
     FROM usuarios u
     INNER JOIN roles r ON u.id_rol = r.id_rol
     WHERE r.nombre_rol = 'ADMINISTRADOR'
     ORDER BY u.usuario ASC`
  );
  return administradores;
};

const listarParaExportar = async (filtros) => {
  const { where, valores } = construirFiltros(filtros);
  const [tareas] = await db.query(
    `SELECT t.id_tarea, t.titulo, t.descripcion,
            responsable.usuario AS responsable, creador.usuario AS creada_por,
            t.fecha_asignada, t.fecha_vencimiento, t.limite_minutos,
            t.estado, t.prioridad, t.fecha_inicio, t.fecha_completada,
            TIMESTAMPDIFF(MINUTE, NOW(), t.fecha_vencimiento) AS minutos_restantes
     FROM checklist_tareas t
     INNER JOIN usuarios responsable ON t.asignada_a = responsable.id_usuario
     INNER JOIN usuarios creador ON t.creada_por = creador.id_usuario
     ${where}
     ORDER BY t.fecha_vencimiento ASC`,
    valores
  );
  return tareas;
};

module.exports = {
  obtenerConexion,
  iniciarTransaccion,
  confirmarTransaccion,
  revertirTransaccion,
  liberarConexion,
  actualizarTareasVencidas,
  registrarHistorial,
  validarFechaFuturaYMinutos,
  validarFechaFutura,
  calcularLimiteMinutos,
  obtenerUsuarioConRol,
  crearTarea,
  listarTareas,
  obtenerTareaDetalle,
  obtenerTareaBloqueada,
  obtenerTareaEditableBloqueada,
  editarTarea,
  marcarTareaVencida,
  iniciarTarea,
  obtenerUltimoIntento,
  crearEntrega,
  marcarTareaEntregada,
  obtenerUltimaEntregaBloqueada,
  obtenerEntregaPendienteBloqueada,
  cancelarNotificacionEntrega,
  eliminarEntrega,
  marcarTareaEnProceso,
  aceptarEntrega,
  rechazarEntrega,
  completarTarea,
  rechazarTarea,
  cancelarTarea,
  existeTareaPermitida,
  obtenerHistorial,
  obtenerEntregas,
  obtenerAlertasPendientes,
  obtenerAdministradores,
  listarParaExportar
};
