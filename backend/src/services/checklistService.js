const ExcelJS = require('exceljs');
const checklistModel = require('../models/checklistModel');
const {
  crearAlertasVencimiento,
  obtenerSiguienteVersionVencimiento,
  cancelarAlertasVencimiento,
  crearNotificacionAsignacion,
  crearNotificacionEntrega
} = require('../models/notificacionModel');

const ESTADOS_VALIDOS = [
  'Pendiente', 'En proceso', 'Entregada', 'Rechazada',
  'Completada', 'Vencida', 'Cancelada'
];
const PRIORIDADES_VALIDAS = ['Baja', 'Media', 'Alta'];
const errorResultado = (status, mensaje) => ({ status, mensaje });

const convertirFechaMySQL = (fecha) => {
  if (typeof fecha !== 'string') return null;
  const coincidencia = fecha.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
  );
  if (!coincidencia) return null;
  const [, anio, mes, dia, hora, minuto, segundo = '00'] = coincidencia;
  return `${anio}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
};

const crearAlertasTarea = (connection, idTarea, fecha, destinatarioId, titulo, version = 1) =>
  crearAlertasVencimiento(connection, {
    idTarea,
    destinatarioId,
    titulo,
    fechaVencimiento: fecha,
    version
  });

const regenerarAlertasTarea = async (connection, idTarea, fecha, destinatarioId, titulo) => {
  await cancelarAlertasVencimiento(connection, idTarea);
  const version = await obtenerSiguienteVersionVencimiento(connection, idTarea);
  await crearAlertasTarea(connection, idTarea, fecha, destinatarioId, titulo, version);
};

const crearTarea = async (datos, idUsuario) => {
  const connection = await checklistModel.obtenerConexion();
  try {
    if (!idUsuario) return { error: errorResultado(401, 'Token inválido o usuario no identificado') };
    if (!datos.titulo || !datos.asignada_a || !datos.fecha_vencimiento) {
      return {
        error: errorResultado(400, 'Título, responsable y fecha de vencimiento son obligatorios')
      };
    }
    if (!PRIORIDADES_VALIDAS.includes(datos.prioridad)) {
      return { error: errorResultado(400, 'Prioridad inválida') };
    }

    const fecha = convertirFechaMySQL(datos.fecha_vencimiento);
    if (!fecha) return { error: errorResultado(400, 'La fecha de vencimiento no es válida') };

    const validacion = await checklistModel.validarFechaFuturaYMinutos(connection, fecha);
    if (!validacion.es_futura) {
      return { error: errorResultado(400, 'La fecha de vencimiento debe ser posterior a la fecha actual') };
    }

    const responsable = await checklistModel.obtenerUsuarioConRol(connection, datos.asignada_a);
    if (!responsable) {
      return { error: errorResultado(404, 'El responsable seleccionado no existe') };
    }
    if (responsable.nombre_rol !== 'ADMINISTRADOR') {
      return {
        error: errorResultado(400, 'Las tareas de CHECKLIST solamente pueden asignarse a un ADMINISTRADOR')
      };
    }

    await checklistModel.iniciarTransaccion(connection);
    const idTarea = await checklistModel.crearTarea(connection, {
      titulo: datos.titulo.trim(),
      descripcion: datos.descripcion?.trim() || null,
      fechaVencimiento: fecha,
      limiteMinutos: Math.max(1, Number(validacion.minutos)),
      prioridad: datos.prioridad,
      creadaPor: idUsuario,
      asignadaA: datos.asignada_a
    });
    await checklistModel.registrarHistorial(connection, {
      idTarea,
      tipoEvento: 'Creacion',
      estadoAnterior: null,
      estadoNuevo: 'Pendiente',
      comentario: 'Tarea creada y asignada',
      actualizadoPor: idUsuario
    });
    await crearNotificacionAsignacion(connection, {
      idTarea,
      destinatarioId: datos.asignada_a,
      titulo: datos.titulo.trim()
    });
    await crearAlertasTarea(
      connection,
      idTarea,
      fecha,
      datos.asignada_a,
      datos.titulo.trim(),
      1
    );
    await checklistModel.confirmarTransaccion(connection);
    return { id_tarea: idTarea };
  } catch (error) {
    await checklistModel.revertirTransaccion(connection);
    throw error;
  } finally {
    checklistModel.liberarConexion(connection);
  }
};

const validarFiltros = ({ estado, prioridad }) => {
  if (estado && !ESTADOS_VALIDOS.includes(estado)) {
    return errorResultado(400, 'Estado inválido');
  }
  if (prioridad && !PRIORIDADES_VALIDAS.includes(prioridad)) {
    return errorResultado(400, 'Prioridad inválida');
  }
  return null;
};

const listarTareas = async (filtros, rol, idUsuario) => {
  await checklistModel.actualizarTareasVencidas();
  const error = validarFiltros(filtros);
  if (error) return { error };
  return {
    tareas: await checklistModel.listarTareas({ ...filtros, rol, idUsuario })
  };
};

const obtenerTareaPorId = async (id, rol, idUsuario) => {
  await checklistModel.actualizarTareasVencidas();
  const tarea = await checklistModel.obtenerTareaDetalle(id, rol, idUsuario);
  return tarea
    ? { tarea }
    : { error: errorResultado(404, 'Tarea no encontrada o no tienes permiso para consultarla') };
};

const editarTarea = async (id, datos, idUsuario) => {
  const connection = await checklistModel.obtenerConexion();
  try {
    await checklistModel.iniciarTransaccion(connection);
    const tarea = await checklistModel.obtenerTareaEditableBloqueada(connection, id);
    if (!tarea) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(404, 'Tarea no encontrada') };
    }
    if (!['Pendiente', 'En proceso'].includes(tarea.estado)) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(409, 'La tarea ya no puede editarse en su estado actual') };
    }

    const titulo = datos.titulo !== undefined ? datos.titulo.trim() : tarea.titulo;
    const descripcion = datos.descripcion !== undefined
      ? datos.descripcion.trim() || null
      : tarea.descripcion;
    const responsableId = datos.asignada_a !== undefined ? datos.asignada_a : tarea.asignada_a;
    const prioridad = datos.prioridad !== undefined ? datos.prioridad : tarea.prioridad;

    if (!titulo) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(400, 'El título es obligatorio') };
    }
    if (!PRIORIDADES_VALIDAS.includes(prioridad)) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(400, 'Prioridad inválida') };
    }

    const responsable = await checklistModel.obtenerUsuarioConRol(connection, responsableId);
    if (!responsable) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(404, 'El responsable no existe') };
    }
    if (responsable.nombre_rol !== 'ADMINISTRADOR') {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(400, 'La tarea solamente puede asignarse a un ADMINISTRADOR') };
    }

    let fecha = tarea.fecha_vencimiento;
    if (datos.fecha_vencimiento !== undefined) {
      const convertida = convertirFechaMySQL(datos.fecha_vencimiento);
      if (!convertida) {
        await checklistModel.revertirTransaccion(connection);
        return { error: errorResultado(400, 'La fecha de vencimiento no es válida') };
      }
      if (!(await checklistModel.validarFechaFutura(connection, convertida))) {
        await checklistModel.revertirTransaccion(connection);
        return { error: errorResultado(400, 'La fecha de vencimiento debe ser futura') };
      }
      fecha = convertida;
    }

    const limiteMinutos = await checklistModel.calcularLimiteMinutos(
      connection,
      tarea.fecha_asignada || tarea.fecha_creacion,
      fecha
    );
    await checklistModel.editarTarea(connection, id, {
      titulo,
      descripcion,
      asignadaA: responsableId,
      fechaVencimiento: fecha,
      limiteMinutos,
      prioridad
    });

    const vencimientoCambio = datos.fecha_vencimiento !== undefined &&
      convertirFechaMySQL(datos.fecha_vencimiento) !== tarea.fecha_vencimiento_texto;
    if (vencimientoCambio || responsableId !== tarea.asignada_a) {
      await regenerarAlertasTarea(connection, id, fecha, responsableId, titulo);
    }
    await checklistModel.registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Edicion',
      estadoAnterior: tarea.estado,
      estadoNuevo: tarea.estado,
      comentario: 'Información de la tarea actualizada',
      actualizadoPor: idUsuario
    });
    await checklistModel.confirmarTransaccion(connection);
    return {};
  } catch (error) {
    await checklistModel.revertirTransaccion(connection);
    throw error;
  } finally {
    checklistModel.liberarConexion(connection);
  }
};

const iniciarTarea = async (id, idUsuario) => {
  const connection = await checklistModel.obtenerConexion();
  try {
    await checklistModel.iniciarTransaccion(connection);
    const tarea = await checklistModel.obtenerTareaBloqueada(connection, id);
    if (!tarea) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(404, 'Tarea no encontrada') };
    }
    if (tarea.asignada_a !== idUsuario) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(403, 'No puedes iniciar una tarea asignada a otro usuario') };
    }
    if (tarea.estado !== 'Pendiente') {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(409, 'Solamente una tarea Pendiente puede iniciarse') };
    }
    if (new Date(tarea.fecha_vencimiento) < new Date()) {
      await checklistModel.marcarTareaVencida(connection, id);
      await checklistModel.registrarHistorial(connection, {
        idTarea: id,
        tipoEvento: 'Vencimiento',
        estadoAnterior: 'Pendiente',
        estadoNuevo: 'Vencida',
        comentario: 'La tarea venció antes de ser iniciada',
        actualizadoPor: idUsuario
      });
      await cancelarAlertasVencimiento(connection, id);
      await checklistModel.confirmarTransaccion(connection);
      return { error: errorResultado(409, 'La tarea ya venció y no puede iniciarse') };
    }
    await checklistModel.iniciarTarea(connection, id);
    await checklistModel.registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Inicio',
      estadoAnterior: 'Pendiente',
      estadoNuevo: 'En proceso',
      comentario: 'Tarea iniciada',
      actualizadoPor: idUsuario
    });
    await checklistModel.confirmarTransaccion(connection);
    return {};
  } catch (error) {
    await checklistModel.revertirTransaccion(connection);
    throw error;
  } finally {
    checklistModel.liberarConexion(connection);
  }
};

const entregarTarea = async (id, idUsuario, comentarioEntrega) => {
  const connection = await checklistModel.obtenerConexion();
  try {
    await checklistModel.iniciarTransaccion(connection);
    const tarea = await checklistModel.obtenerTareaBloqueada(connection, id);
    if (!tarea) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(404, 'Tarea no encontrada') };
    }
    if (tarea.asignada_a !== idUsuario) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(403, 'No puedes entregar una tarea asignada a otro usuario') };
    }
    if (!['En proceso', 'Rechazada'].includes(tarea.estado)) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(409, 'La tarea no puede entregarse en su estado actual') };
    }

    const numeroIntento = (await checklistModel.obtenerUltimoIntento(connection, id)) + 1;
    const idEntrega = await checklistModel.crearEntrega(connection, {
      idTarea: id,
      numeroIntento,
      comentario: comentarioEntrega?.trim() || null,
      entregadaPor: idUsuario
    });
    await crearNotificacionEntrega(connection, {
      idTarea: Number(id),
      idEntrega,
      destinatarioId: tarea.creada_por,
      titulo: tarea.titulo,
      esReentrega: tarea.estado === 'Rechazada'
    });
    await checklistModel.marcarTareaEntregada(connection, id);
    await checklistModel.registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: tarea.estado === 'Rechazada' ? 'Reentrega' : 'Entrega',
      estadoAnterior: tarea.estado,
      estadoNuevo: 'Entregada',
      comentario: numeroIntento === 1 ? 'Primera entrega de la tarea' : `Reentrega número ${numeroIntento}`,
      actualizadoPor: idUsuario
    });
    await cancelarAlertasVencimiento(connection, id);
    await checklistModel.confirmarTransaccion(connection);
    return { numero_intento: numeroIntento };
  } catch (error) {
    await checklistModel.revertirTransaccion(connection);
    throw error;
  } finally {
    checklistModel.liberarConexion(connection);
  }
};

const cancelarEntrega = async (id, idUsuario) => {
  const connection = await checklistModel.obtenerConexion();
  try {
    await checklistModel.iniciarTransaccion(connection);
    const tarea = await checklistModel.obtenerTareaBloqueada(connection, id);
    if (!tarea) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(404, 'Tarea no encontrada') };
    }
    if (tarea.asignada_a !== idUsuario) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(403, 'No puedes cancelar la entrega de otra persona') };
    }
    if (tarea.estado !== 'Entregada') {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(409, 'Solamente una tarea Entregada puede cancelar su envío') };
    }

    const entrega = await checklistModel.obtenerUltimaEntregaBloqueada(connection, id);
    if (!entrega) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(404, 'No existe una entrega para cancelar') };
    }
    if (entrega.estado_revision !== 'Pendiente') {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(409, 'La entrega ya fue revisada y no puede cancelarse') };
    }

    await checklistModel.cancelarNotificacionEntrega(connection, entrega.id_entrega);
    await checklistModel.eliminarEntrega(connection, entrega.id_entrega);
    await checklistModel.marcarTareaEnProceso(connection, id);
    await checklistModel.registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Edicion',
      estadoAnterior: 'Entregada',
      estadoNuevo: 'En proceso',
      comentario: 'El administrador canceló una entrega aún no revisada',
      actualizadoPor: idUsuario
    });
    if (await checklistModel.validarFechaFutura(connection, tarea.fecha_vencimiento)) {
      await regenerarAlertasTarea(
        connection, id, tarea.fecha_vencimiento, tarea.asignada_a, tarea.titulo
      );
    }
    await checklistModel.confirmarTransaccion(connection);
    return {};
  } catch (error) {
    await checklistModel.revertirTransaccion(connection);
    throw error;
  } finally {
    checklistModel.liberarConexion(connection);
  }
};

const aceptarEntrega = async (id, idUsuario, comentarioRevision) => {
  const connection = await checklistModel.obtenerConexion();
  try {
    await checklistModel.iniciarTransaccion(connection);
    const tarea = await checklistModel.obtenerTareaBloqueada(connection, id);
    if (!tarea) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(404, 'Tarea no encontrada') };
    }
    if (tarea.estado !== 'Entregada') {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(409, 'Solamente una tarea Entregada puede aceptarse') };
    }
    const entrega = await checklistModel.obtenerEntregaPendienteBloqueada(connection, id);
    if (!entrega) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(404, 'No existe una entrega pendiente de revisión') };
    }
    await checklistModel.aceptarEntrega(
      connection,
      entrega.id_entrega,
      idUsuario,
      comentarioRevision?.trim() || null
    );
    await checklistModel.completarTarea(connection, id);
    await checklistModel.registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Aceptacion',
      estadoAnterior: 'Entregada',
      estadoNuevo: 'Completada',
      comentario: comentarioRevision?.trim() || 'Entrega aceptada por el supervisor',
      actualizadoPor: idUsuario
    });
    await cancelarAlertasVencimiento(connection, id);
    await checklistModel.confirmarTransaccion(connection);
    return {};
  } catch (error) {
    await checklistModel.revertirTransaccion(connection);
    throw error;
  } finally {
    checklistModel.liberarConexion(connection);
  }
};

const rechazarEntrega = async (id, idUsuario, comentarioRevision) => {
  const connection = await checklistModel.obtenerConexion();
  try {
    if (!comentarioRevision || !comentarioRevision.trim()) {
      return { error: errorResultado(400, 'El motivo del rechazo es obligatorio') };
    }
    await checklistModel.iniciarTransaccion(connection);
    const tarea = await checklistModel.obtenerTareaBloqueada(connection, id);
    if (!tarea) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(404, 'Tarea no encontrada') };
    }
    if (tarea.estado !== 'Entregada') {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(409, 'Solamente una tarea Entregada puede rechazarse') };
    }
    const entrega = await checklistModel.obtenerEntregaPendienteBloqueada(connection, id);
    if (!entrega) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(404, 'No existe una entrega pendiente de revisión') };
    }
    await checklistModel.rechazarEntrega(
      connection,
      entrega.id_entrega,
      idUsuario,
      comentarioRevision.trim()
    );
    await checklistModel.rechazarTarea(connection, id);
    await checklistModel.registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Rechazo',
      estadoAnterior: 'Entregada',
      estadoNuevo: 'Rechazada',
      comentario: comentarioRevision.trim(),
      actualizadoPor: idUsuario
    });
    await cancelarAlertasVencimiento(connection, id);
    await checklistModel.confirmarTransaccion(connection);
    return {};
  } catch (error) {
    await checklistModel.revertirTransaccion(connection);
    throw error;
  } finally {
    checklistModel.liberarConexion(connection);
  }
};

const cancelarTarea = async (id, idUsuario, comentario) => {
  const connection = await checklistModel.obtenerConexion();
  try {
    await checklistModel.iniciarTransaccion(connection);
    const tarea = await checklistModel.obtenerTareaBloqueada(connection, id);
    if (!tarea) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(404, 'Tarea no encontrada') };
    }
    if (['Completada', 'Cancelada'].includes(tarea.estado)) {
      await checklistModel.revertirTransaccion(connection);
      return { error: errorResultado(409, 'La tarea no puede cancelarse en su estado actual') };
    }
    await checklistModel.cancelarTarea(connection, id);
    await checklistModel.registrarHistorial(connection, {
      idTarea: id,
      tipoEvento: 'Cancelacion',
      estadoAnterior: tarea.estado,
      estadoNuevo: 'Cancelada',
      comentario: comentario?.trim() || 'Tarea cancelada por el supervisor',
      actualizadoPor: idUsuario
    });
    await cancelarAlertasVencimiento(connection, id);
    await checklistModel.confirmarTransaccion(connection);
    return {};
  } catch (error) {
    await checklistModel.revertirTransaccion(connection);
    throw error;
  } finally {
    checklistModel.liberarConexion(connection);
  }
};

const obtenerHistorial = async (id, rol, idUsuario) => {
  if (!(await checklistModel.existeTareaPermitida(id, rol, idUsuario))) {
    return { error: errorResultado(404, 'Tarea no encontrada o sin permiso') };
  }
  return { historial: await checklistModel.obtenerHistorial(id) };
};

const obtenerEntregas = async (id, rol, idUsuario) => {
  if (!(await checklistModel.existeTareaPermitida(id, rol, idUsuario))) {
    return { error: errorResultado(404, 'Tarea no encontrada o sin permiso') };
  }
  return { entregas: await checklistModel.obtenerEntregas(id) };
};

const obtenerAlertasPendientes = (idUsuario) => checklistModel.obtenerAlertasPendientes(idUsuario);
const obtenerAdministradores = () => checklistModel.obtenerAdministradores();

const exportarExcel = async (filtros, rol, idUsuario) => {
  await checklistModel.actualizarTareasVencidas();
  const error = validarFiltros(filtros);
  if (error) return { error };
  const tareas = await checklistModel.listarParaExportar({ ...filtros, rol, idUsuario });
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Checklist');
  worksheet.columns = [
    { header: 'Tarea', key: 'titulo', width: 30 },
    { header: 'Descripción', key: 'descripcion', width: 40 },
    { header: 'Responsable', key: 'responsable', width: 25 },
    { header: 'Creada por', key: 'creada_por', width: 25 },
    { header: 'Fecha asignada', key: 'fecha_asignada', width: 22 },
    { header: 'Fecha límite', key: 'fecha_vencimiento', width: 22 },
    { header: 'Límite minutos', key: 'limite_minutos', width: 18 },
    { header: 'Minutos restantes', key: 'minutos_restantes', width: 20 },
    { header: 'Estado', key: 'estado', width: 18 },
    { header: 'Prioridad', key: 'prioridad', width: 15 },
    { header: 'Fecha inicio', key: 'fecha_inicio', width: 22 },
    { header: 'Fecha completada', key: 'fecha_completada', width: 22 }
  ];
  tareas.forEach((tarea) => worksheet.addRow(tarea));
  worksheet.getRow(1).font = { bold: true };
  worksheet.autoFilter = { from: 'A1', to: 'L1' };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  return { workbook };
};

module.exports = {
  crearTarea,
  listarTareas,
  obtenerTareaPorId,
  editarTarea,
  iniciarTarea,
  entregarTarea,
  cancelarEntrega,
  aceptarEntrega,
  rechazarEntrega,
  cancelarTarea,
  obtenerHistorial,
  obtenerEntregas,
  obtenerAlertasPendientes,
  obtenerAdministradores,
  exportarExcel
};
