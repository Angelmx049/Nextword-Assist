const ExcelJS = require('exceljs');
const mcModel = require('../models/mcModel');

const errorResultado = (status, mensaje) => ({ status, mensaje });

const validarRegistro = ({ fecha, hora, mc, operador, observaciones }) => {
  if (!fecha || !hora || !mc || !operador || !observaciones) {
    return errorResultado(
      400,
      'Fecha, hora, MC, operador y observaciones son obligatorios'
    );
  }

  if (String(mc).trim() === '') {
    return errorResultado(400, 'El campo MC es obligatorio');
  }

  if (operador.trim() === '') {
    return errorResultado(400, 'El operador es obligatorio');
  }

  if (observaciones.trim() === '') {
    return errorResultado(400, 'La observación es obligatoria');
  }

  return null;
};

const normalizarRegistro = ({ fecha, hora, mc, operador, observaciones }) => ({
  fecha,
  hora,
  mc: String(mc).trim(),
  operador: operador.trim(),
  observaciones: observaciones.trim()
});

const usuarioPuedeModificar = (registro, idUsuario, rol) => {
  if (!registro || !idUsuario) return false;
  return rol === 'SUPERVISOR' || Number(registro.creado_por) === Number(idUsuario);
};

const validarPermisoModificacion = async (id, idUsuario, rol) => {
  const registro = await mcModel.obtenerPropietario(id);
  if (!registro) return { error: errorResultado(404, 'Registro MC no encontrado') };
  if (!usuarioPuedeModificar(registro, idUsuario, rol)) {
    return {
      error: errorResultado(
        403,
        'No tienes permiso para modificar un registro MC creado por otro usuario'
      )
    };
  }
  return { registro };
};

const listar = (operador, fecha) => mcModel.listar(operador, fecha);

const obtenerPorId = (id) => mcModel.obtenerPorId(id);

const crear = async (datos, idUsuario) => {
  const error = validarRegistro(datos);
  if (error) return { error };

  if (!idUsuario) {
    return {
      error: errorResultado(
        401,
        'No se pudo identificar al usuario autenticado'
      )
    };
  }

  const id = await mcModel.crear(normalizarRegistro(datos), idUsuario);
  return { registro: await mcModel.obtenerPorId(id) };
};

const actualizar = async (id, datos, idUsuario, rol) => {
  const error = validarRegistro(datos);
  if (error) return { error };

  const permiso = await validarPermisoModificacion(id, idUsuario, rol);
  if (permiso.error) return { error: permiso.error };

  await mcModel.actualizar(id, normalizarRegistro(datos));
  return { registro: await mcModel.obtenerPorId(id) };
};

const eliminar = async (id, idUsuario, rol) => {
  const permiso = await validarPermisoModificacion(id, idUsuario, rol);
  if (permiso.error) return { error: permiso.error };

  const affectedRows = await mcModel.eliminar(id);
  return affectedRows === 0
    ? { error: errorResultado(404, 'Registro MC no encontrado') }
    : {};
};

const exportar = async (operador, fecha) => {
  const registros = await mcModel.listarParaExportar(operador, fecha);

  if (registros.length === 0) {
    return {
      error: errorResultado(
        404,
        'No existen registros para exportar con los filtros seleccionados'
      )
    };
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ASSIST DHL';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('MC');
  worksheet.columns = [
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Hora', key: 'hora', width: 12 },
    { header: 'MC', key: 'mc', width: 20 },
    { header: 'Operador', key: 'operador', width: 28 },
    { header: 'Observaciones', key: 'observaciones', width: 60 }
  ];
  registros.forEach((registro) => worksheet.addRow({
    fecha: registro.fecha,
    hora: registro.hora,
    mc: registro.mc,
    operador: registro.operador,
    observaciones: registro.observaciones || ''
  }));
  worksheet.getRow(1).font = { bold: true };
  worksheet.autoFilter = { from: 'A1', to: 'E1' };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  return {
    buffer: await workbook.xlsx.writeBuffer(),
    nombreArchivo: `reporte_mc_${new Date().toISOString().slice(0, 10)}.xlsx`
  };
};

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  exportar
};
