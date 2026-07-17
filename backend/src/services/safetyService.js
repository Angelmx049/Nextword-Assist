const fs = require('fs');
const ExcelJS = require('exceljs');
const safetyModel = require('../models/safetyModel');

const NIVELES_RIESGO_VALIDOS = ['Bajo', 'Medio', 'Alto', 'Critico'];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const errorResultado = (status, mensaje) => ({ status, mensaje });

const convertirEnteroPositivo = (valor) => {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
};

const fechaEsValida = (valor) => {
  if (!FECHA_REGEX.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia;
};

const eliminarArchivoSubido = (archivo) => {
  if (!archivo?.path) return;
  try {
    if (fs.existsSync(archivo.path)) fs.unlinkSync(archivo.path);
  } catch (error) {
    console.error('Error al eliminar fotografía Safety:', error);
  }
};

const construirFiltros = (idArea, query) => {
  const fechaDesde = query.fecha_desde?.trim();
  const fechaHasta = query.fecha_hasta?.trim();
  const nivelRiesgo = query.nivel_riesgo?.trim();
  const busqueda = query.busqueda?.trim();
  if (fechaDesde && !fechaEsValida(fechaDesde)) {
    return { error: 'fecha_desde debe tener el formato YYYY-MM-DD' };
  }
  if (fechaHasta && !fechaEsValida(fechaHasta)) {
    return { error: 'fecha_hasta debe tener el formato YYYY-MM-DD' };
  }
  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    return { error: 'fecha_desde no puede ser posterior a fecha_hasta' };
  }
  if (nivelRiesgo && !NIVELES_RIESGO_VALIDOS.includes(nivelRiesgo)) {
    return { error: 'nivel_riesgo no es válido' };
  }
  const condiciones = ['h.id_area = ?'];
  const valores = [idArea];
  if (fechaDesde) {
    condiciones.push('h.fecha_hallazgo >= ?');
    valores.push(`${fechaDesde} 00:00:00`);
  }
  if (fechaHasta) {
    condiciones.push('h.fecha_hallazgo < DATE_ADD(?, INTERVAL 1 DAY)');
    valores.push(fechaHasta);
  }
  if (nivelRiesgo) {
    condiciones.push('h.nivel_riesgo = ?');
    valores.push(nivelRiesgo);
  }
  if (busqueda) {
    condiciones.push('h.descripcion LIKE ?');
    valores.push(`%${busqueda}%`);
  }
  return { where: `WHERE ${condiciones.join(' AND ')}`, valores };
};

const listarAreas = async () => {
  const areas = await safetyModel.listarAreas();
  return areas.map((area) => ({
    ...area,
    total_hallazgos: Number(area.total_hallazgos)
  }));
};

const listarRecientes = async (idAreaValor) => {
  const idArea = convertirEnteroPositivo(idAreaValor);
  if (!idArea) return { error: errorResultado(400, 'id_area debe ser un entero válido') };
  if (!(await safetyModel.obtenerArea(idArea))) {
    return { error: errorResultado(404, 'Área Safety no encontrada') };
  }
  return { hallazgos: await safetyModel.listarRecientes(idArea) };
};

const crear = async (datos, archivo, reportadoPor) => {
  let connection;
  let transaccionConfirmada = false;
  try {
    if (!archivo) return { error: errorResultado(400, 'La fotografía es obligatoria') };
    const idArea = convertirEnteroPositivo(datos.id_area);
    if (!idArea) {
      eliminarArchivoSubido(archivo);
      return { error: errorResultado(400, 'id_area debe ser un entero válido') };
    }
    if (!datos.descripcion) {
      eliminarArchivoSubido(archivo);
      return { error: errorResultado(400, 'La descripción es obligatoria') };
    }
    if (!datos.nivel_riesgo) {
      eliminarArchivoSubido(archivo);
      return { error: errorResultado(400, 'El nivel de riesgo es obligatorio') };
    }
    if (!NIVELES_RIESGO_VALIDOS.includes(datos.nivel_riesgo)) {
      eliminarArchivoSubido(archivo);
      return { error: errorResultado(400, 'El nivel de riesgo no es válido') };
    }

    connection = await safetyModel.obtenerConexion();
    await safetyModel.iniciarTransaccion(connection);
    const area = await safetyModel.obtenerArea(idArea, connection, true);
    if (!area) {
      await safetyModel.revertirTransaccion(connection);
      eliminarArchivoSubido(archivo);
      return { error: errorResultado(404, 'Área Safety no encontrada') };
    }
    if (area.estado !== 'Activa') {
      await safetyModel.revertirTransaccion(connection);
      eliminarArchivoSubido(archivo);
      return { error: errorResultado(400, 'No se pueden registrar hallazgos en un área inactiva') };
    }

    const idHallazgo = await safetyModel.crearHallazgo(connection, {
      idArea,
      descripcion: datos.descripcion,
      nivelRiesgo: datos.nivel_riesgo,
      rutaFoto: `/uploads/safety/${archivo.filename}`,
      reportadoPor
    });
    const hallazgo = await safetyModel.obtenerHallazgo(idHallazgo, connection);
    if (!hallazgo) throw new Error('No se pudo consultar el hallazgo recién creado');
    await safetyModel.confirmarTransaccion(connection);
    transaccionConfirmada = true;
    return { hallazgo };
  } catch (error) {
    if (connection && !transaccionConfirmada) {
      await safetyModel.revertirTransaccion(connection).catch((rollbackError) => {
        console.error('Error al revertir creación Safety:', rollbackError);
      });
    }
    if (!transaccionConfirmada) eliminarArchivoSubido(archivo);
    throw error;
  } finally {
    if (connection) safetyModel.liberarConexion(connection);
  }
};

const obtenerHistorial = async (idAreaValor, query) => {
  const idArea = convertirEnteroPositivo(idAreaValor);
  if (!idArea) return { error: errorResultado(400, 'id_area debe ser un entero válido') };
  if (!(await safetyModel.obtenerArea(idArea))) {
    return { error: errorResultado(404, 'Área Safety no encontrada') };
  }
  const filtros = construirFiltros(idArea, query);
  if (filtros.error) return { error: errorResultado(400, filtros.error) };

  const page = query.page === undefined ? 1 : convertirEnteroPositivo(query.page);
  const solicitado = query.limit === undefined ? 20 : convertirEnteroPositivo(query.limit);
  if (!page || !solicitado) {
    return { error: errorResultado(400, 'page y limit deben ser enteros positivos y seguros') };
  }
  if (page > 100000) return { error: errorResultado(400, 'page no puede ser mayor a 100000') };

  const limit = Math.min(solicitado, 100);
  const { total, hallazgos } = await safetyModel.obtenerHistorial(
    filtros.where,
    filtros.valores,
    limit,
    (page - 1) * limit
  );
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    hallazgos,
    paginacion: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_previous_page: page > 1,
      has_next_page: page < totalPages
    }
  };
};

const obtenerPorId = async (valor) => {
  const id = convertirEnteroPositivo(valor);
  if (!id) return { error: errorResultado(400, 'id_hallazgo debe ser un entero válido') };
  const hallazgo = await safetyModel.obtenerHallazgo(id);
  return hallazgo
    ? { hallazgo }
    : { error: errorResultado(404, 'Hallazgo Safety no encontrado') };
};

const exportar = async (idAreaValor, query) => {
  const idArea = convertirEnteroPositivo(idAreaValor);
  if (!idArea) return { error: errorResultado(400, 'id_area debe ser un entero válido') };
  if (!(await safetyModel.obtenerArea(idArea))) {
    return { error: errorResultado(404, 'Área Safety no encontrada') };
  }
  const filtros = construirFiltros(idArea, query);
  if (filtros.error) return { error: errorResultado(400, filtros.error) };
  const hallazgos = await safetyModel.listarParaExportar(filtros.where, filtros.valores);
  if (hallazgos.length > 10000) {
    return { error: errorResultado(400, 'La exportación supera el máximo de 10,000 registros. Aplica filtros más específicos') };
  }
  if (hallazgos.length === 0) {
    return { error: errorResultado(404, 'No existen hallazgos para exportar con los filtros seleccionados') };
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Safety');
  worksheet.columns = [
    { header: 'Área', key: 'area', width: 28 },
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Hora', key: 'hora', width: 12 },
    { header: 'Usuario', key: 'usuario', width: 24 },
    { header: 'Descripción', key: 'descripcion', width: 60 },
    { header: 'Nivel de riesgo', key: 'nivel_riesgo', width: 18 }
  ];
  hallazgos.forEach((hallazgo) => worksheet.addRow(hallazgo));
  worksheet.getRow(1).font = { bold: true };
  worksheet.autoFilter = { from: 'A1', to: 'F1' };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  return {
    workbook,
    nombreArchivo: `safety-${idArea}-${new Date().toISOString().slice(0, 10)}.xlsx`
  };
};

module.exports = { listarAreas, listarRecientes, crear, obtenerHistorial, obtenerPorId, exportar };
