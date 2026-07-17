const db = require('../config/db');
const ExcelJS = require('exceljs');
const { checklistTaskRequestDto } = require('../dto/requestDtos');
const {
  crearAlertasVencimiento,
  obtenerSiguienteVersionVencimiento,
  cancelarAlertasVencimiento,
  crearNotificacionEntrega
} = require('../models/notificacionModel');

const ESTADOS_VALIDOS = [
  'Pendiente',
  'En proceso',
  'Entregada',
  'Rechazada',
  'Completada',
  'Vencida',
  'Cancelada'
];

const PRIORIDADES_VALIDAS = [
  'Baja',
  'Media',
  'Alta'
];

const obtenerIdUsuarioToken = (req) => {
  return req.usuario?.id_usuario;
};

const obtenerRolToken = (req) => {
  return req.usuario?.rol;
};

const convertirFechaMySQL = (fecha) => {
  if (typeof fecha !== 'string') return null;
  const coincidencia = fecha.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
  );
  if (!coincidencia) return null;
  const [, anio, mes, dia, hora, minuto, segundo = '00'] = coincidencia;
  return `${anio}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
};

const actualizarTareasVencidas = async (connection = db) => {
  await connection.query(`
    UPDATE notificaciones n
    INNER JOIN checklist_tareas t ON t.id_tarea = n.id_tarea
    SET n.estado = 'Cancelada'
    WHERE t.fecha_vencimiento < NOW()
      AND t.estado IN ('Pendiente', 'En proceso', 'Rechazada')
      AND n.evento_origen = 'Vencimiento'
      AND n.estado = 'Programada'
      AND n.leida = 0
  `);
  await connection.query(`
    UPDATE checklist_tareas
    SET estado = 'Vencida'
    WHERE fecha_vencimiento < NOW()
      AND estado IN (
        'Pendiente',
        'En proceso',
        'Rechazada'
      )
  `);
};

const registrarHistorial = async (
  connection,
  {
    idTarea,
    tipoEvento,
    estadoAnterior = null,
    estadoNuevo = null,
    comentario = null,
    actualizadoPor
  }
) => {
  await connection.query(
    `
      INSERT INTO checklist_registros (
        id_tarea,
        tipo_evento,
        estado_anterior,
        estado_nuevo,
        comentario,
        actualizado_por
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      idTarea,
      tipoEvento,
      estadoAnterior,
      estadoNuevo,
      comentario,
      actualizadoPor
    ]
  );
};

const cancelarAlertasPendientes = async (connection, idTarea) => {
  await cancelarAlertasVencimiento(connection, idTarea);
};

const crearAlertasTarea = async (
  connection,
  idTarea,
  fechaVencimiento,
  destinatarioId,
  titulo,
  version = 1
) => {
  await crearAlertasVencimiento(connection, {
    idTarea,
    destinatarioId,
    titulo,
    fechaVencimiento,
    version
  });
};

const regenerarAlertasTarea = async (
  connection,
  idTarea,
  fechaVencimiento,
  destinatarioId,
  titulo
) => {
  await cancelarAlertasVencimiento(connection, idTarea);
  const version = await obtenerSiguienteVersionVencimiento(connection, idTarea);
  await crearAlertasTarea(
    connection,
    idTarea,
    fechaVencimiento,
    destinatarioId,
    titulo,
    version
  );
};

const construirFiltros = ({
  busqueda,
  estado,
  prioridad,
  responsable,
  fecha,
  rol,
  idUsuario
}) => {
  const condiciones = [];
  const valores = [];

  if (rol === 'ADMINISTRADOR') {
    condiciones.push('t.asignada_a = ?');
    valores.push(idUsuario);
  }

  if (busqueda) {
    condiciones.push(`
      (
        t.titulo LIKE ?
        OR t.descripcion LIKE ?
      )
    `);

    valores.push(`%${busqueda}%`);
    valores.push(`%${busqueda}%`);
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

  const where =
    condiciones.length > 0
      ? `WHERE ${condiciones.join(' AND ')}`
      : '';

  return {
    where,
    valores
  };
};


// =====================================================
// CREAR TAREA
// SOLO SUPERVISOR
// =====================================================

const crearTarea = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const idUsuario = obtenerIdUsuarioToken(req);

    const {
      titulo,
      descripcion,
      asignada_a,
      fecha_vencimiento,
      prioridad
    } = checklistTaskRequestDto(req.body);

    if (!idUsuario) {
      return res.status(401).json({
        mensaje: 'Token inválido o usuario no identificado'
      });
    }

    if (
      !titulo ||
      !asignada_a ||
      !fecha_vencimiento
    ) {
      return res.status(400).json({
        mensaje:
          'Título, responsable y fecha de vencimiento son obligatorios'
      });
    }

    if (!PRIORIDADES_VALIDAS.includes(prioridad)) {
      return res.status(400).json({
        mensaje: 'Prioridad inválida'
      });
    }

    const fechaVencimientoMySQL =
      convertirFechaMySQL(fecha_vencimiento);

    if (!fechaVencimientoMySQL) {
      return res.status(400).json({
        mensaje: 'La fecha de vencimiento no es válida'
      });
    }

    const [validacionFecha] = await connection.query(
      'SELECT ? > NOW() AS es_futura, TIMESTAMPDIFF(MINUTE, NOW(), ?) AS minutos',
      [fechaVencimientoMySQL, fechaVencimientoMySQL]
    );

    if (!validacionFecha[0].es_futura) {
      return res.status(400).json({
        mensaje:
          'La fecha de vencimiento debe ser posterior a la fecha actual'
      });
    }

    const [usuarios] = await connection.query(
      `
        SELECT
          u.id_usuario,
          r.nombre_rol
        FROM usuarios u
        INNER JOIN roles r
          ON u.id_rol = r.id_rol
        WHERE u.id_usuario = ?
        LIMIT 1
      `,
      [asignada_a]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        mensaje: 'El responsable seleccionado no existe'
      });
    }

    if (usuarios[0].nombre_rol !== 'ADMINISTRADOR') {
      return res.status(400).json({
        mensaje:
          'Las tareas de CHECKLIST solamente pueden asignarse a un ADMINISTRADOR'
      });
    }

    const limiteMinutos = Math.max(1, Number(validacionFecha[0].minutos));

    await connection.beginTransaction();

    const [resultado] = await connection.query(
      `
        INSERT INTO checklist_tareas (
          titulo,
          descripcion,
          fecha_asignada,
          fecha_vencimiento,
          limite_minutos,
          estado,
          prioridad,
          creada_por,
          asignada_a
        )
        VALUES (
          ?,
          ?,
          NOW(),
          ?,
          ?,
          'Pendiente',
          ?,
          ?,
          ?
        )
      `,
      [
        titulo.trim(),
        descripcion?.trim() || null,
        fechaVencimientoMySQL,
        limiteMinutos,
        prioridad,
        idUsuario,
        asignada_a
      ]
    );

    const idTarea = resultado.insertId;

    await registrarHistorial(connection, {
      idTarea,
      tipoEvento: 'Creacion',
      estadoAnterior: null,
      estadoNuevo: 'Pendiente',
      comentario: 'Tarea creada y asignada',
      actualizadoPor: idUsuario
    });

    await crearAlertasTarea(
      connection,
      idTarea,
      fechaVencimientoMySQL,
      asignada_a,
      titulo.trim(),
      1
    );

    await connection.commit();

    return res.status(201).json({
      mensaje: 'Tarea creada correctamente',
      id_tarea: idTarea
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al crear tarea:', error);

    return res.status(500).json({
      mensaje: 'Error interno al crear la tarea'
    });
  } finally {
    connection.release();
  }
};


// =====================================================
// LISTAR TAREAS
// SUPERVISOR: TODAS
// ADMINISTRADOR: SOLO ASIGNADAS
// =====================================================

const obtenerTareas = async (req, res) => {
  try {
    await actualizarTareasVencidas();

    const idUsuario = obtenerIdUsuarioToken(req);
    const rol = obtenerRolToken(req);

    const {
      busqueda,
      estado,
      prioridad,
      responsable,
      fecha
    } = req.query;

    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        mensaje: 'Estado inválido'
      });
    }

    if (
      prioridad &&
      !PRIORIDADES_VALIDAS.includes(prioridad)
    ) {
      return res.status(400).json({
        mensaje: 'Prioridad inválida'
      });
    }

    const { where, valores } = construirFiltros({
      busqueda,
      estado,
      prioridad,
      responsable,
      fecha,
      rol,
      idUsuario
    });

    const [tareas] = await db.query(
      `
        SELECT
          t.id_tarea,
          t.titulo,
          t.descripcion,
          t.fecha_asignada,
          t.fecha_vencimiento,
          t.limite_minutos,
          t.estado,
          t.prioridad,
          t.creada_por,
          t.asignada_a,
          t.fecha_inicio,
          t.fecha_completada,
          t.fecha_creacion,
          t.fecha_actualizacion,

          creador.usuario AS creado_por_usuario,
          responsable.usuario AS responsable_usuario,

          TIMESTAMPDIFF(
            MINUTE,
            NOW(),
            t.fecha_vencimiento
          ) AS minutos_restantes,

          CASE
            WHEN t.estado = 'Vencida'
              THEN 'Vencida'

            WHEN TIMESTAMPDIFF(
              MINUTE,
              NOW(),
              t.fecha_vencimiento
            ) <= 10
              THEN 'Rojo'

            WHEN TIMESTAMPDIFF(
              MINUTE,
              NOW(),
              t.fecha_vencimiento
            ) <= 20
              THEN 'Naranja'

            WHEN TIMESTAMPDIFF(
              MINUTE,
              NOW(),
              t.fecha_vencimiento
            ) <= 30
              THEN 'Amarillo'

            ELSE 'Normal'
          END AS nivel_alerta

        FROM checklist_tareas t

        INNER JOIN usuarios creador
          ON t.creada_por = creador.id_usuario

        INNER JOIN usuarios responsable
          ON t.asignada_a = responsable.id_usuario

        ${where}

        ORDER BY
          CASE t.estado
            WHEN 'Entregada' THEN 1
            WHEN 'Rechazada' THEN 2
            WHEN 'En proceso' THEN 3
            WHEN 'Pendiente' THEN 4
            WHEN 'Vencida' THEN 5
            WHEN 'Completada' THEN 6
            WHEN 'Cancelada' THEN 7
            ELSE 8
          END,
          t.fecha_vencimiento ASC
      `,
      valores
    );

    return res.status(200).json({
      total: tareas.length,
      tareas
    });
  } catch (error) {
    console.error('Error al obtener tareas:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener las tareas'
    });
  }
};


// =====================================================
// OBTENER UNA TAREA
// =====================================================

const obtenerTareaPorId = async (req, res) => {
  try {
    await actualizarTareasVencidas();

    const { id } = req.params;
    const idUsuario = obtenerIdUsuarioToken(req);
    const rol = obtenerRolToken(req);

    const valores = [id];

    let filtroAdministrador = '';

    if (rol === 'ADMINISTRADOR') {
      filtroAdministrador = `
        AND t.asignada_a = ?
      `;

      valores.push(idUsuario);
    }

    const [tareas] = await db.query(
      `
        SELECT
          t.id_tarea,
          t.titulo,
          t.descripcion,
          t.fecha_asignada,
          t.fecha_vencimiento,
          t.limite_minutos,
          t.estado,
          t.prioridad,
          t.creada_por,
          t.asignada_a,
          t.fecha_inicio,
          t.fecha_completada,
          t.fecha_creacion,
          t.fecha_actualizacion,

          creador.usuario AS creado_por_usuario,
          responsable.usuario AS responsable_usuario,

          TIMESTAMPDIFF(
            MINUTE,
            NOW(),
            t.fecha_vencimiento
          ) AS minutos_restantes,

          CASE
            WHEN t.estado = 'Vencida'
              THEN 'Vencida'

            WHEN TIMESTAMPDIFF(
              MINUTE,
              NOW(),
              t.fecha_vencimiento
            ) <= 10
              THEN 'Rojo'

            WHEN TIMESTAMPDIFF(
              MINUTE,
              NOW(),
              t.fecha_vencimiento
            ) <= 20
              THEN 'Naranja'

            WHEN TIMESTAMPDIFF(
              MINUTE,
              NOW(),
              t.fecha_vencimiento
            ) <= 30
              THEN 'Amarillo'

            ELSE 'Normal'
          END AS nivel_alerta

        FROM checklist_tareas t

        INNER JOIN usuarios creador
          ON t.creada_por = creador.id_usuario

        INNER JOIN usuarios responsable
          ON t.asignada_a = responsable.id_usuario

        WHERE t.id_tarea = ?

        ${filtroAdministrador}

        LIMIT 1
      `,
      valores
    );

    if (tareas.length === 0) {
      return res.status(404).json({
        mensaje:
          'Tarea no encontrada o no tienes permiso para consultarla'
      });
    }

    return res.status(200).json({
      tarea: tareas[0]
    });
  } catch (error) {
    console.error('Error al obtener tarea:', error);

    return res.status(500).json({
      mensaje: 'Error interno al obtener la tarea'
    });
  }
};


// =====================================================
// EDITAR TAREA
// SOLO SUPERVISOR
// =====================================================

const editarTarea = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;
    const idUsuario = obtenerIdUsuarioToken(req);

    const {
      titulo,
      descripcion,
      asignada_a,
      fecha_vencimiento,
      prioridad
    } = checklistTaskRequestDto(req.body);

    await connection.beginTransaction();

    const [tareas] = await connection.query(
      `
        SELECT *, DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d %H:%i:%s') AS fecha_vencimiento_texto
        FROM checklist_tareas
        WHERE id_tarea = ?
        FOR UPDATE
      `,
      [id]
    );

    if (tareas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensaje: 'Tarea no encontrada'
      });
    }

    const tareaActual = tareas[0];

    if (
      !['Pendiente', 'En proceso'].includes(
        tareaActual.estado
      )
    ) {
      await connection.rollback();

      return res.status(409).json({
        mensaje:
          'La tarea ya no puede editarse en su estado actual'
      });
    }

    const nuevoTitulo =
      titulo !== undefined
        ? titulo.trim()
        : tareaActual.titulo;

    const nuevaDescripcion =
      descripcion !== undefined
        ? descripcion.trim() || null
        : tareaActual.descripcion;

    const nuevoResponsable =
      asignada_a !== undefined
        ? asignada_a
        : tareaActual.asignada_a;

    const nuevaPrioridad =
      prioridad !== undefined
        ? prioridad
        : tareaActual.prioridad;

    if (!nuevoTitulo) {
      await connection.rollback();

      return res.status(400).json({
        mensaje: 'El título es obligatorio'
      });
    }

    if (
      !PRIORIDADES_VALIDAS.includes(
        nuevaPrioridad
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        mensaje: 'Prioridad inválida'
      });
    }

    const [responsables] = await connection.query(
      `
        SELECT
          u.id_usuario,
          r.nombre_rol
        FROM usuarios u
        INNER JOIN roles r
          ON u.id_rol = r.id_rol
        WHERE u.id_usuario = ?
        LIMIT 1
      `,
      [nuevoResponsable]
    );

    if (responsables.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensaje: 'El responsable no existe'
      });
    }

    if (
      responsables[0].nombre_rol !==
      'ADMINISTRADOR'
    ) {
      await connection.rollback();

      return res.status(400).json({
        mensaje:
          'La tarea solamente puede asignarse a un ADMINISTRADOR'
      });
    }

    let nuevaFechaVencimiento =
      tareaActual.fecha_vencimiento;

    if (fecha_vencimiento !== undefined) {
      const fechaConvertida =
        convertirFechaMySQL(fecha_vencimiento);

      if (!fechaConvertida) {
        await connection.rollback();

        return res.status(400).json({
          mensaje:
            'La fecha de vencimiento no es válida'
        });
      }

      const [validacionFecha] = await connection.query(
        'SELECT ? > NOW() AS es_futura',
        [fechaConvertida]
      );
      if (!validacionFecha[0].es_futura) {
        await connection.rollback();

        return res.status(400).json({
          mensaje:
            'La fecha de vencimiento debe ser futura'
        });
      }

      nuevaFechaVencimiento = fechaConvertida;
    }

    const [calculoLimite] = await connection.query(
      'SELECT GREATEST(1, TIMESTAMPDIFF(MINUTE, ?, ?)) AS limite_minutos',
      [tareaActual.fecha_asignada || tareaActual.fecha_creacion, nuevaFechaVencimiento]
    );
    const limiteMinutos = Number(calculoLimite[0].limite_minutos);

    await connection.query(
      `
        UPDATE checklist_tareas
        SET
          titulo = ?,
          descripcion = ?,
          asignada_a = ?,
          fecha_vencimiento = ?,
          limite_minutos = ?,
          prioridad = ?
        WHERE id_tarea = ?
      `,
      [
        nuevoTitulo,
        nuevaDescripcion,
        nuevoResponsable,
        nuevaFechaVencimiento,
        limiteMinutos,
        nuevaPrioridad,
        id
      ]
    );

    const vencimientoCambio =
      fecha_vencimiento !== undefined &&
      convertirFechaMySQL(fecha_vencimiento) !== tareaActual.fecha_vencimiento_texto;

    if (vencimientoCambio) {
      await regenerarAlertasTarea(
        connection,
        id,
        nuevaFechaVencimiento,
        nuevoResponsable,
        nuevoTitulo
      );
    } else if (nuevoResponsable !== tareaActual.asignada_a) {
      await regenerarAlertasTarea(
        connection,
        id,
        nuevaFechaVencimiento,
        nuevoResponsable,
        nuevoTitulo
      );
    }

    await registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Edicion',
      estadoAnterior: tareaActual.estado,
      estadoNuevo: tareaActual.estado,
      comentario: 'Información de la tarea actualizada',
      actualizadoPor: idUsuario
    });

    await connection.commit();

    return res.status(200).json({
      mensaje: 'Tarea actualizada correctamente'
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al editar tarea:', error);

    return res.status(500).json({
      mensaje: 'Error interno al editar la tarea'
    });
  } finally {
    connection.release();
  }
};


// =====================================================
// INICIAR TAREA
// SOLO ADMINISTRADOR ASIGNADO
// =====================================================

const iniciarTarea = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;
    const idUsuario = obtenerIdUsuarioToken(req);

    await connection.beginTransaction();

    const [tareas] = await connection.query(
      `
        SELECT *
        FROM checklist_tareas
        WHERE id_tarea = ?
        FOR UPDATE
      `,
      [id]
    );

    if (tareas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensaje: 'Tarea no encontrada'
      });
    }

    const tarea = tareas[0];

    if (tarea.asignada_a !== idUsuario) {
      await connection.rollback();

      return res.status(403).json({
        mensaje:
          'No puedes iniciar una tarea asignada a otro usuario'
      });
    }

    if (tarea.estado !== 'Pendiente') {
      await connection.rollback();

      return res.status(409).json({
        mensaje:
          'Solamente una tarea Pendiente puede iniciarse'
      });
    }

    if (
      new Date(tarea.fecha_vencimiento) <
      new Date()
    ) {
      await connection.query(
        `
          UPDATE checklist_tareas
          SET estado = 'Vencida'
          WHERE id_tarea = ?
        `,
        [id]
      );

      await registrarHistorial(connection, {
        idTarea: id,
        tipoEvento: 'Vencimiento',
        estadoAnterior: 'Pendiente',
        estadoNuevo: 'Vencida',
        comentario:
          'La tarea venció antes de ser iniciada',
        actualizadoPor: idUsuario
      });

      await cancelarAlertasPendientes(
        connection,
        id
      );

      await connection.commit();

      return res.status(409).json({
        mensaje:
          'La tarea ya venció y no puede iniciarse'
      });
    }

    await connection.query(
      `
        UPDATE checklist_tareas
        SET
          estado = 'En proceso',
          fecha_inicio = NOW()
        WHERE id_tarea = ?
      `,
      [id]
    );

    await registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Inicio',
      estadoAnterior: 'Pendiente',
      estadoNuevo: 'En proceso',
      comentario: 'Tarea iniciada',
      actualizadoPor: idUsuario
    });

    await connection.commit();

    return res.status(200).json({
      mensaje: 'Tarea iniciada correctamente'
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al iniciar tarea:', error);

    return res.status(500).json({
      mensaje: 'Error interno al iniciar la tarea'
    });
  } finally {
    connection.release();
  }
};


// =====================================================
// ENTREGAR / REENTREGAR TAREA
// SOLO ADMINISTRADOR ASIGNADO
// =====================================================

const entregarTarea = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;
    const idUsuario = obtenerIdUsuarioToken(req);

    const {
      comentario_entrega
    } = req.body;

    await connection.beginTransaction();

    const [tareas] = await connection.query(
      `
        SELECT *
        FROM checklist_tareas
        WHERE id_tarea = ?
        FOR UPDATE
      `,
      [id]
    );

    if (tareas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensaje: 'Tarea no encontrada'
      });
    }

    const tarea = tareas[0];

    if (tarea.asignada_a !== idUsuario) {
      await connection.rollback();

      return res.status(403).json({
        mensaje:
          'No puedes entregar una tarea asignada a otro usuario'
      });
    }

    if (
      !['En proceso', 'Rechazada'].includes(
        tarea.estado
      )
    ) {
      await connection.rollback();

      return res.status(409).json({
        mensaje:
          'La tarea no puede entregarse en su estado actual'
      });
    }

    const [intentos] = await connection.query(
      `
        SELECT
          COALESCE(
            MAX(numero_intento),
            0
          ) AS ultimo_intento
        FROM checklist_entregas
        WHERE id_tarea = ?
      `,
      [id]
    );

    const numeroIntento =
      intentos[0].ultimo_intento + 1;

    const [resultadoEntrega] = await connection.query(
      `
        INSERT INTO checklist_entregas (
          id_tarea,
          numero_intento,
          comentario_entrega,
          entregada_por,
          estado_revision
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          'Pendiente'
        )
      `,
      [
        id,
        numeroIntento,
        comentario_entrega?.trim() || null,
        idUsuario
      ]
    );

    await crearNotificacionEntrega(connection, {
      idTarea: Number(id),
      idEntrega: resultadoEntrega.insertId,
      destinatarioId: tarea.creada_por,
      titulo: tarea.titulo,
      esReentrega: tarea.estado === 'Rechazada'
    });

    const tipoEvento =
      tarea.estado === 'Rechazada'
        ? 'Reentrega'
        : 'Entrega';

    await connection.query(
      `
        UPDATE checklist_tareas
        SET estado = 'Entregada'
        WHERE id_tarea = ?
      `,
      [id]
    );

    await registrarHistorial(connection, {
      idTarea: id,
      tipoEvento,
      estadoAnterior: tarea.estado,
      estadoNuevo: 'Entregada',
      comentario:
        numeroIntento === 1
          ? 'Primera entrega de la tarea'
          : `Reentrega número ${numeroIntento}`,
      actualizadoPor: idUsuario
    });

    await cancelarAlertasPendientes(
      connection,
      id
    );

    await connection.commit();

    return res.status(201).json({
      mensaje: 'Tarea entregada correctamente',
      numero_intento: numeroIntento
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al entregar tarea:', error);

    return res.status(500).json({
      mensaje: 'Error interno al entregar la tarea'
    });
  } finally {
    connection.release();
  }
};


// =====================================================
// CANCELAR ENTREGA
// ADMINISTRADOR
// SOLO SI TODAVÍA NO FUE REVISADA
// =====================================================

const cancelarEntrega = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;
    const idUsuario = obtenerIdUsuarioToken(req);

    await connection.beginTransaction();

    const [tareas] = await connection.query(
      `
        SELECT *
        FROM checklist_tareas
        WHERE id_tarea = ?
        FOR UPDATE
      `,
      [id]
    );

    if (tareas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensaje: 'Tarea no encontrada'
      });
    }

    const tarea = tareas[0];

    if (tarea.asignada_a !== idUsuario) {
      await connection.rollback();

      return res.status(403).json({
        mensaje:
          'No puedes cancelar la entrega de otra persona'
      });
    }

    if (tarea.estado !== 'Entregada') {
      await connection.rollback();

      return res.status(409).json({
        mensaje:
          'Solamente una tarea Entregada puede cancelar su envío'
      });
    }

    const [entregas] = await connection.query(
      `
        SELECT *
        FROM checklist_entregas
        WHERE id_tarea = ?
        ORDER BY numero_intento DESC
        LIMIT 1
        FOR UPDATE
      `,
      [id]
    );

    if (entregas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensaje: 'No existe una entrega para cancelar'
      });
    }

    const ultimaEntrega = entregas[0];

    if (
      ultimaEntrega.estado_revision !==
      'Pendiente'
    ) {
      await connection.rollback();

      return res.status(409).json({
        mensaje:
          'La entrega ya fue revisada y no puede cancelarse'
      });
    }

    await connection.query(
      `UPDATE notificaciones
       SET estado = 'Cancelada'
       WHERE id_entrega = ? AND estado = 'Programada' AND leida = 0`,
      [ultimaEntrega.id_entrega]
    );

    await connection.query(
      `
        DELETE FROM checklist_entregas
        WHERE id_entrega = ?
      `,
      [ultimaEntrega.id_entrega]
    );

    await connection.query(
      `
        UPDATE checklist_tareas
        SET estado = 'En proceso'
        WHERE id_tarea = ?
      `,
      [id]
    );

    await registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Edicion',
      estadoAnterior: 'Entregada',
      estadoNuevo: 'En proceso',
      comentario:
        'El administrador canceló una entrega aún no revisada',
      actualizadoPor: idUsuario
    });

    const [vigencia] = await connection.query(
      'SELECT ? > NOW() AS es_futura',
      [tarea.fecha_vencimiento]
    );
    if (vigencia[0].es_futura) {
      await regenerarAlertasTarea(
        connection,
        id,
        tarea.fecha_vencimiento,
        tarea.asignada_a,
        tarea.titulo
      );
    }

    await connection.commit();

    return res.status(200).json({
      mensaje:
        'Entrega cancelada. La tarea volvió a En proceso'
    });
  } catch (error) {
    await connection.rollback();

    console.error(
      'Error al cancelar entrega:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error interno al cancelar la entrega'
    });
  } finally {
    connection.release();
  }
};


// =====================================================
// ACEPTAR ENTREGA
// SOLO SUPERVISOR
// =====================================================

const aceptarEntrega = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;
    const idUsuario = obtenerIdUsuarioToken(req);

    const {
      comentario_revision
    } = req.body;

    await connection.beginTransaction();

    const [tareas] = await connection.query(
      `
        SELECT *
        FROM checklist_tareas
        WHERE id_tarea = ?
        FOR UPDATE
      `,
      [id]
    );

    if (tareas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensaje: 'Tarea no encontrada'
      });
    }

    const tarea = tareas[0];

    if (tarea.estado !== 'Entregada') {
      await connection.rollback();

      return res.status(409).json({
        mensaje:
          'Solamente una tarea Entregada puede aceptarse'
      });
    }

    const [entregas] = await connection.query(
      `
        SELECT *
        FROM checklist_entregas
        WHERE id_tarea = ?
          AND estado_revision = 'Pendiente'
        ORDER BY numero_intento DESC
        LIMIT 1
        FOR UPDATE
      `,
      [id]
    );

    if (entregas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensaje:
          'No existe una entrega pendiente de revisión'
      });
    }

    const entrega = entregas[0];

    await connection.query(
      `
        UPDATE checklist_entregas
        SET
          estado_revision = 'Aceptada',
          revisada_por = ?,
          comentario_revision = ?,
          fecha_revision = NOW()
        WHERE id_entrega = ?
      `,
      [
        idUsuario,
        comentario_revision?.trim() || null,
        entrega.id_entrega
      ]
    );

    await connection.query(
      `
        UPDATE checklist_tareas
        SET
          estado = 'Completada',
          fecha_completada = NOW()
        WHERE id_tarea = ?
      `,
      [id]
    );

    await registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Aceptacion',
      estadoAnterior: 'Entregada',
      estadoNuevo: 'Completada',
      comentario:
        comentario_revision?.trim() ||
        'Entrega aceptada por el supervisor',
      actualizadoPor: idUsuario
    });

    await cancelarAlertasPendientes(
      connection,
      id
    );

    await connection.commit();

    return res.status(200).json({
      mensaje:
        'Entrega aceptada. La tarea fue completada'
    });
  } catch (error) {
    await connection.rollback();

    console.error(
      'Error al aceptar entrega:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error interno al aceptar la entrega'
    });
  } finally {
    connection.release();
  }
};


// =====================================================
// RECHAZAR ENTREGA
// SOLO SUPERVISOR
// =====================================================

const rechazarEntrega = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;
    const idUsuario = obtenerIdUsuarioToken(req);

    const {
      comentario_revision
    } = req.body;

    if (
      !comentario_revision ||
      !comentario_revision.trim()
    ) {
      return res.status(400).json({
        mensaje:
          'El motivo del rechazo es obligatorio'
      });
    }

    await connection.beginTransaction();

    const [tareas] = await connection.query(
      `
        SELECT *
        FROM checklist_tareas
        WHERE id_tarea = ?
        FOR UPDATE
      `,
      [id]
    );

    if (tareas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensaje: 'Tarea no encontrada'
      });
    }

    const tarea = tareas[0];

    if (tarea.estado !== 'Entregada') {
      await connection.rollback();

      return res.status(409).json({
        mensaje:
          'Solamente una tarea Entregada puede rechazarse'
      });
    }

    const [entregas] = await connection.query(
      `
        SELECT *
        FROM checklist_entregas
        WHERE id_tarea = ?
          AND estado_revision = 'Pendiente'
        ORDER BY numero_intento DESC
        LIMIT 1
        FOR UPDATE
      `,
      [id]
    );

    if (entregas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensaje:
          'No existe una entrega pendiente de revisión'
      });
    }

    const entrega = entregas[0];

    await connection.query(
      `
        UPDATE checklist_entregas
        SET
          estado_revision = 'Rechazada',
          revisada_por = ?,
          comentario_revision = ?,
          fecha_revision = NOW()
        WHERE id_entrega = ?
      `,
      [
        idUsuario,
        comentario_revision.trim(),
        entrega.id_entrega
      ]
    );

    await connection.query(
      `
        UPDATE checklist_tareas
        SET estado = 'Rechazada'
        WHERE id_tarea = ?
      `,
      [id]
    );

    await registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Rechazo',
      estadoAnterior: 'Entregada',
      estadoNuevo: 'Rechazada',
      comentario: comentario_revision.trim(),
      actualizadoPor: idUsuario
    });

    await cancelarAlertasPendientes(connection, id);

    await connection.commit();

    return res.status(200).json({
      mensaje:
        'Entrega rechazada correctamente'
    });
  } catch (error) {
    await connection.rollback();

    console.error(
      'Error al rechazar entrega:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error interno al rechazar la entrega'
    });
  } finally {
    connection.release();
  }
};


// =====================================================
// CANCELAR TAREA
// SOLO SUPERVISOR
// BAJA LÓGICA
// =====================================================

const cancelarTarea = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;
    const idUsuario = obtenerIdUsuarioToken(req);

    const {
      comentario
    } = req.body;

    await connection.beginTransaction();

    const [tareas] = await connection.query(
      `
        SELECT *
        FROM checklist_tareas
        WHERE id_tarea = ?
        FOR UPDATE
      `,
      [id]
    );

    if (tareas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensaje: 'Tarea no encontrada'
      });
    }

    const tarea = tareas[0];

    if (
      ['Completada', 'Cancelada'].includes(
        tarea.estado
      )
    ) {
      await connection.rollback();

      return res.status(409).json({
        mensaje:
          'La tarea no puede cancelarse en su estado actual'
      });
    }

    await connection.query(
      `
        UPDATE checklist_tareas
        SET estado = 'Cancelada'
        WHERE id_tarea = ?
      `,
      [id]
    );

    await registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Cancelacion',
      estadoAnterior: tarea.estado,
      estadoNuevo: 'Cancelada',
      comentario:
        comentario?.trim() ||
        'Tarea cancelada por el supervisor',
      actualizadoPor: idUsuario
    });

    await cancelarAlertasPendientes(
      connection,
      id
    );

    await connection.commit();

    return res.status(200).json({
      mensaje: 'Tarea cancelada correctamente'
    });
  } catch (error) {
    await connection.rollback();

    console.error(
      'Error al cancelar tarea:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error interno al cancelar la tarea'
    });
  } finally {
    connection.release();
  }
};


// =====================================================
// HISTORIAL DE UNA TAREA
// =====================================================

const obtenerHistorialTarea = async (req, res) => {
  try {
    const { id } = req.params;
    const idUsuario = obtenerIdUsuarioToken(req);
    const rol = obtenerRolToken(req);

    const valores = [id];

    let filtroAdministrador = '';

    if (rol === 'ADMINISTRADOR') {
      filtroAdministrador = `
        AND t.asignada_a = ?
      `;

      valores.push(idUsuario);
    }

    const [tareas] = await db.query(
      `
        SELECT
          t.id_tarea
        FROM checklist_tareas t
        WHERE t.id_tarea = ?
        ${filtroAdministrador}
        LIMIT 1
      `,
      valores
    );

    if (tareas.length === 0) {
      return res.status(404).json({
        mensaje:
          'Tarea no encontrada o sin permiso'
      });
    }

    const [historial] = await db.query(
      `
        SELECT
          r.id_registro,
          r.id_tarea,
          r.tipo_evento,
          r.estado_anterior,
          r.estado_nuevo,
          r.comentario,
          r.actualizado_por,
          u.usuario AS actualizado_por_usuario,
          r.fecha_registro

        FROM checklist_registros r

        LEFT JOIN usuarios u
          ON r.actualizado_por = u.id_usuario

        WHERE r.id_tarea = ?

        ORDER BY
          r.fecha_registro ASC,
          r.id_registro ASC
      `,
      [id]
    );

    return res.status(200).json({
      total: historial.length,
      historial
    });
  } catch (error) {
    console.error(
      'Error al obtener historial:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error interno al obtener el historial'
    });
  }
};


// =====================================================
// OBTENER ENTREGAS DE UNA TAREA
// =====================================================

const obtenerEntregasTarea = async (req, res) => {
  try {
    const { id } = req.params;
    const idUsuario = obtenerIdUsuarioToken(req);
    const rol = obtenerRolToken(req);

    const valores = [id];

    let filtroAdministrador = '';

    if (rol === 'ADMINISTRADOR') {
      filtroAdministrador = `
        AND t.asignada_a = ?
      `;

      valores.push(idUsuario);
    }

    const [tareas] = await db.query(
      `
        SELECT
          t.id_tarea
        FROM checklist_tareas t
        WHERE t.id_tarea = ?
        ${filtroAdministrador}
        LIMIT 1
      `,
      valores
    );

    if (tareas.length === 0) {
      return res.status(404).json({
        mensaje:
          'Tarea no encontrada o sin permiso'
      });
    }

    const [entregas] = await db.query(
      `
        SELECT
          e.id_entrega,
          e.id_tarea,
          e.numero_intento,
          e.comentario_entrega,
          e.entregada_por,
          entregador.usuario AS entregada_por_usuario,
          e.fecha_entrega,
          e.estado_revision,
          e.revisada_por,
          revisor.usuario AS revisada_por_usuario,
          e.comentario_revision,
          e.fecha_revision

        FROM checklist_entregas e

        INNER JOIN usuarios entregador
          ON e.entregada_por =
             entregador.id_usuario

        LEFT JOIN usuarios revisor
          ON e.revisada_por =
             revisor.id_usuario

        WHERE e.id_tarea = ?

        ORDER BY
          e.numero_intento ASC
      `,
      [id]
    );

    return res.status(200).json({
      total: entregas.length,
      entregas
    });
  } catch (error) {
    console.error(
      'Error al obtener entregas:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error interno al obtener las entregas'
    });
  }
};


// =====================================================
// CONSULTAR ALERTAS ACTIVAS
// WEB Y REACT NATIVE
// =====================================================

const obtenerAlertasPendientes = async (req, res) => {
  try {
    const idUsuario = obtenerIdUsuarioToken(req);
    const [alertas] = await db.query(
      `
        SELECT
          n.id_notificacion AS id_alerta,
          n.id_tarea,
          n.minutos_antes,
          n.fecha_programada,
          t.titulo,
          t.descripcion,
          t.fecha_vencimiento,
          t.estado,
          t.prioridad,
          TIMESTAMPDIFF(MINUTE, NOW(), t.fecha_vencimiento) AS minutos_restantes
        FROM notificaciones n
        INNER JOIN checklist_tareas t ON n.id_tarea = t.id_tarea
        WHERE n.destinatario_id = ?
          AND n.evento_origen = 'Vencimiento'
          AND n.estado <> 'Cancelada'
          AND n.leida = 0
          AND n.fecha_programada <= NOW()
          AND t.estado IN ('Pendiente', 'En proceso')
        ORDER BY n.fecha_programada DESC
      `,
      [idUsuario]
    );
    return res.status(200).json({
      total: alertas.length,
      alertas
    });
  } catch (error) {
    console.error(
      'Error al obtener alertas:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error interno al obtener las alertas'
    });
  }
};


// =====================================================
// LISTAR ADMINISTRADORES PARA ASIGNACIÓN
// SOLO SUPERVISOR
// =====================================================

const obtenerAdministradores = async (req, res) => {
  try {
    const [administradores] = await db.query(
      `
        SELECT
          u.id_usuario,
          u.usuario

        FROM usuarios u

        INNER JOIN roles r
          ON u.id_rol = r.id_rol

        WHERE r.nombre_rol = 'ADMINISTRADOR'

        ORDER BY
          u.usuario ASC
      `
    );

    return res.status(200).json({
      total: administradores.length,
      administradores
    });
  } catch (error) {
    console.error(
      'Error al obtener administradores:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error interno al obtener administradores'
    });
  }
};


// =====================================================
// EXPORTAR EXCEL
// RESPETA FILTROS
// =====================================================

const exportarExcel = async (req, res) => {
  try {
    await actualizarTareasVencidas();

    const idUsuario = obtenerIdUsuarioToken(req);
    const rol = obtenerRolToken(req);

    const {
      busqueda,
      estado,
      prioridad,
      responsable,
      fecha
    } = req.query;

    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        mensaje: 'Estado inválido'
      });
    }

    if (
      prioridad &&
      !PRIORIDADES_VALIDAS.includes(prioridad)
    ) {
      return res.status(400).json({
        mensaje: 'Prioridad inválida'
      });
    }

    const { where, valores } = construirFiltros({
      busqueda,
      estado,
      prioridad,
      responsable,
      fecha,
      rol,
      idUsuario
    });

    const [tareas] = await db.query(
      `
        SELECT
          t.id_tarea,
          t.titulo,
          t.descripcion,
          responsable.usuario AS responsable,
          creador.usuario AS creada_por,
          t.fecha_asignada,
          t.fecha_vencimiento,
          t.limite_minutos,
          t.estado,
          t.prioridad,
          t.fecha_inicio,
          t.fecha_completada,

          TIMESTAMPDIFF(
            MINUTE,
            NOW(),
            t.fecha_vencimiento
          ) AS minutos_restantes

        FROM checklist_tareas t

        INNER JOIN usuarios responsable
          ON t.asignada_a =
             responsable.id_usuario

        INNER JOIN usuarios creador
          ON t.creada_por =
             creador.id_usuario

        ${where}

        ORDER BY
          t.fecha_vencimiento ASC
      `,
      valores
    );

    const workbook = new ExcelJS.Workbook();

    const worksheet =
      workbook.addWorksheet('Checklist');

    worksheet.columns = [
      {
        header: 'ID',
        key: 'id_tarea',
        width: 10
      },
      {
        header: 'Tarea',
        key: 'titulo',
        width: 30
      },
      {
        header: 'Descripción',
        key: 'descripcion',
        width: 40
      },
      {
        header: 'Responsable',
        key: 'responsable',
        width: 25
      },
      {
        header: 'Creada por',
        key: 'creada_por',
        width: 25
      },
      {
        header: 'Fecha asignada',
        key: 'fecha_asignada',
        width: 22
      },
      {
        header: 'Fecha límite',
        key: 'fecha_vencimiento',
        width: 22
      },
      {
        header: 'Límite minutos',
        key: 'limite_minutos',
        width: 18
      },
      {
        header: 'Minutos restantes',
        key: 'minutos_restantes',
        width: 20
      },
      {
        header: 'Estado',
        key: 'estado',
        width: 18
      },
      {
        header: 'Prioridad',
        key: 'prioridad',
        width: 15
      },
      {
        header: 'Fecha inicio',
        key: 'fecha_inicio',
        width: 22
      },
      {
        header: 'Fecha completada',
        key: 'fecha_completada',
        width: 22
      }
    ];

    tareas.forEach((tarea) => {
      worksheet.addRow(tarea);
    });

    worksheet.getRow(1).font = {
      bold: true
    };

    worksheet.autoFilter = {
      from: 'A1',
      to: 'M1'
    };

    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 1
      }
    ];

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=checklist.xlsx'
    );

    await workbook.xlsx.write(res);

    res.end();
  } catch (error) {
    console.error(
      'Error al exportar checklist:',
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        mensaje:
          'Error interno al exportar el archivo Excel'
      });
    }
  }
};


module.exports = {
  crearTarea,
  obtenerTareas,
  obtenerTareaPorId,
  editarTarea,
  iniciarTarea,
  entregarTarea,
  cancelarEntrega,
  aceptarEntrega,
  rechazarEntrega,
  cancelarTarea,
  obtenerHistorialTarea,
  obtenerEntregasTarea,
  obtenerAlertasPendientes,
  obtenerAdministradores,
  exportarExcel
};
