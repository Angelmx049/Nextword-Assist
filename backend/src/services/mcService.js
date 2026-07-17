const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType
} = require('docx');
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

const actualizar = async (id, datos) => {
  const error = validarRegistro(datos);
  if (error) return { error };

  if (!(await mcModel.existe(id))) {
    return { error: errorResultado(404, 'Registro MC no encontrado') };
  }

  await mcModel.actualizar(id, normalizarRegistro(datos));
  return { registro: await mcModel.obtenerPorId(id) };
};

const eliminar = async (id) => {
  const affectedRows = await mcModel.eliminar(id);
  return affectedRows === 0
    ? { error: errorResultado(404, 'Registro MC no encontrado') }
    : {};
};

const crearCeldaEncabezado = (texto) => new TableCell({
  children: [new Paragraph({
    children: [new TextRun({ text: texto, bold: true })]
  })]
});

const crearCelda = (texto) => new TableCell({
  children: [new Paragraph({
    text: texto !== null && texto !== undefined ? String(texto) : ''
  })]
});

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

  const filas = [
    new TableRow({
      children: [
        crearCeldaEncabezado('Fecha'),
        crearCeldaEncabezado('Hora'),
        crearCeldaEncabezado('MC'),
        crearCeldaEncabezado('Operador'),
        crearCeldaEncabezado('Observaciones')
      ]
    }),
    ...registros.map((registro) => new TableRow({
      children: [
        crearCelda(registro.fecha),
        crearCelda(registro.hora),
        crearCelda(registro.mc),
        crearCelda(registro.operador),
        crearCelda(registro.observaciones)
      ]
    }))
  ];

  const documento = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [new TextRun({
            text: 'Reporte de Registros MC',
            bold: true,
            size: 32
          })]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: `Total de registros: ${registros.length}` }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: filas
        })
      ]
    }]
  });

  return {
    buffer: await Packer.toBuffer(documento),
    nombreArchivo: `reporte_mc_${Date.now()}.docx`
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
