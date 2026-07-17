const ExcelJS = require('exceljs');
const gembaModel = require('../models/gembaModel');

const MANEJOS_PERMITIDOS = [
  'Excelente',
  'Bueno',
  'Regular',
  'Necesita mejorar'
];

const convertirEntero = (valor) => {
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : null;
};

const errorResultado = (status, mensaje, errores) => ({
  status,
  mensaje,
  ...(errores ? { errores } : {})
});

const validarEvaluacion = ({
  id_courier,
  fecha,
  hora,
  numero_eco,
  cantidad_paradas,
  tiempo_horas,
  tiempo_minutos,
  manejo
}) => {
  const errores = [];
  const courierId = convertirEntero(id_courier);
  if (courierId === null || courierId <= 0) {
    errores.push('El courier es obligatorio y debe ser válido.');
  }
  if (!fecha) errores.push('La fecha es obligatoria.');
  if (!hora) errores.push('La hora es obligatoria.');
  if (!numero_eco || !String(numero_eco).trim()) {
    errores.push('El número económico es obligatorio.');
  }

  const paradas = convertirEntero(cantidad_paradas);
  if (paradas === null || paradas < 0) {
    errores.push('La cantidad de paradas debe ser un entero mayor o igual a 0.');
  }

  const horas = convertirEntero(tiempo_horas);
  if (horas === null || horas < 0) {
    errores.push('Las horas deben ser un entero mayor o igual a 0.');
  }

  const minutos = convertirEntero(tiempo_minutos);
  if (minutos === null || minutos < 0 || minutos > 59) {
    errores.push('Los minutos deben estar entre 0 y 59.');
  }
  if (horas !== null && minutos !== null && horas === 0 && minutos === 0) {
    errores.push('El tiempo total debe ser mayor a 0 minutos.');
  }

  if (!manejo) {
    errores.push('La evaluación de manejo es obligatoria.');
  } else if (!MANEJOS_PERMITIDOS.includes(manejo)) {
    errores.push('La evaluación de manejo debe ser Excelente, Bueno, Regular o Necesita mejorar.');
  }
  return errores;
};

const validarFiltros = ({ id_courier, manejo }) => {
  if (id_courier) {
    const courierId = convertirEntero(id_courier);
    if (courierId === null || courierId <= 0) {
      return errorResultado(400, 'El filtro id_courier no es válido.');
    }
  }
  if (manejo && !MANEJOS_PERMITIDOS.includes(manejo)) {
    return errorResultado(400, 'El filtro de manejo no es válido.');
  }
  return null;
};

const normalizarEvaluacion = (datos) => ({
  id_courier: Number(datos.id_courier),
  fecha: datos.fecha,
  hora: datos.hora,
  numero_eco: String(datos.numero_eco).trim(),
  cantidad_paradas: Number(datos.cantidad_paradas),
  tiempo_horas: Number(datos.tiempo_horas),
  tiempo_minutos: Number(datos.tiempo_minutos),
  manejo: datos.manejo,
  observaciones: datos.observaciones?.trim() || null
});

const listarCouriersActivos = () => gembaModel.listarCouriersActivos();

const crear = async (datos, idUsuario) => {
  if (!idUsuario) {
    return { error: errorResultado(401, 'No se pudo identificar al usuario autenticado.') };
  }
  const errores = validarEvaluacion(datos);
  if (errores.length > 0) {
    return {
      error: errorResultado(400, 'La evaluación contiene datos inválidos.', errores)
    };
  }
  const courier = await gembaModel.buscarCourierActivo(Number(datos.id_courier));
  if (!courier) {
    return {
      error: errorResultado(400, 'El courier seleccionado no existe o está inactivo.')
    };
  }
  const id_gemba = await gembaModel.crear(normalizarEvaluacion(datos), idUsuario);
  return { id_gemba, courier: courier.nombre };
};

const listar = async (filtros) => {
  const error = validarFiltros(filtros);
  if (error) return { error };
  return { registros: await gembaModel.listar(filtros) };
};

const obtenerPorId = async (id) => {
  const idGemba = convertirEntero(id);
  if (idGemba === null || idGemba <= 0) {
    return {
      error: errorResultado(400, 'El identificador de la evaluación no es válido.')
    };
  }
  const registro = await gembaModel.obtenerPorId(idGemba);
  return registro
    ? { registro }
    : { error: errorResultado(404, 'La evaluación GEMBA RIDE no existe.') };
};

const actualizar = async (id, datos, idUsuario, rol) => {
  const idGemba = convertirEntero(id);
  if (idGemba === null || idGemba <= 0) {
    return {
      error: errorResultado(400, 'El identificador de la evaluación no es válido.')
    };
  }
  if (!idUsuario || !rol) {
    return { error: errorResultado(401, 'No se pudo identificar al usuario autenticado.') };
  }

  const errores = validarEvaluacion(datos);
  if (errores.length > 0) {
    return {
      error: errorResultado(400, 'La evaluación contiene datos inválidos.', errores)
    };
  }

  const evaluacionActual = await gembaModel.obtenerPropietario(idGemba);
  if (!evaluacionActual) {
    return { error: errorResultado(404, 'La evaluación GEMBA RIDE no existe.') };
  }

  const esAdministrador = rol === 'ADMINISTRADOR';
  const esPropietario = Number(evaluacionActual.registrado_por) === Number(idUsuario);
  if (!esAdministrador && !esPropietario) {
    return {
      error: errorResultado(
        403,
        'No tienes permiso para editar una evaluación registrada por otro usuario.'
      )
    };
  }

  const courier = await gembaModel.buscarCourierActivo(Number(datos.id_courier));
  if (!courier) {
    return {
      error: errorResultado(400, 'El courier seleccionado no existe o está inactivo.')
    };
  }

  const affectedRows = await gembaModel.actualizar(
    idGemba,
    normalizarEvaluacion(datos)
  );
  if (affectedRows === 0) {
    return {
      error: errorResultado(404, 'La evaluación GEMBA RIDE no pudo ser actualizada.')
    };
  }
  return { id_gemba: idGemba, courier: courier.nombre };
};

const eliminar = async (id) => {
  const idGemba = convertirEntero(id);
  if (idGemba === null || idGemba <= 0) {
    return {
      error: errorResultado(400, 'El identificador de la evaluación no es válido.')
    };
  }
  const affectedRows = await gembaModel.eliminar(idGemba);
  return affectedRows === 0
    ? { error: errorResultado(404, 'La evaluación GEMBA RIDE no existe o ya fue eliminada.') }
    : {};
};

const exportar = async (filtros) => {
  const error = validarFiltros(filtros);
  if (error) return { error };

  const resultados = await gembaModel.listarParaExportar(filtros);
  if (resultados.length === 0) {
    return {
      error: errorResultado(404, 'No existen registros para exportar con los filtros seleccionados.')
    };
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ASSIST DHL';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('GEMBA RIDE');
  worksheet.columns = [
    { header: 'ID', key: 'id_gemba', width: 10 },
    { header: 'Courier', key: 'courier', width: 18 },
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Hora', key: 'hora', width: 12 },
    { header: 'Número económico', key: 'numero_eco', width: 20 },
    { header: 'Paradas', key: 'cantidad_paradas', width: 12 },
    { header: 'Tiempo total', key: 'tiempo_total', width: 18 },
    { header: 'Evaluación', key: 'manejo', width: 18 },
    { header: 'Observaciones', key: 'observaciones', width: 40 },
    { header: 'Registrado por', key: 'usuario_registro', width: 20 }
  ];
  resultados.forEach((registro) => {
    worksheet.addRow({
      id_gemba: registro.id_gemba,
      courier: registro.courier,
      fecha: registro.fecha,
      hora: registro.hora,
      numero_eco: registro.numero_eco,
      cantidad_paradas: registro.cantidad_paradas,
      tiempo_total: `${registro.tiempo_horas}h ${registro.tiempo_minutos}m`,
      manejo: registro.manejo,
      observaciones: registro.observaciones || '',
      usuario_registro: registro.usuario_registro
    });
  });
  worksheet.getRow(1).font = { bold: true };
  worksheet.autoFilter = { from: 'A1', to: 'J1' };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  return {
    workbook,
    nombreArchivo: `gemba-ride-${new Date().toISOString().slice(0, 10)}.xlsx`
  };
};

module.exports = {
  listarCouriersActivos,
  crear,
  listar,
  obtenerPorId,
  actualizar,
  eliminar,
  exportar
};
