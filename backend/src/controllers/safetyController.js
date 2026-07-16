const db = require('../config/db');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { safetyFindingRequestDto } = require('../dto/requestDtos');

const NIVELES_RIESGO_VALIDOS = [
  'Bajo',
  'Medio',
  'Alto',
  'Critico'
];

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const convertirEnteroPositivo = (valor) => {
  const numero = Number(valor);

  return Number.isSafeInteger(numero) && numero > 0
    ? numero
    : null;
};

const fechaEsValida = (valor) => {
  if (!FECHA_REGEX.test(valor)) {
    return false;
  }

  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia;
};

const eliminarArchivoSubido = (archivo) => {
  if (!archivo?.path) {
    return;
  }

  try {
    if (fs.existsSync(archivo.path)) {
      fs.unlinkSync(archivo.path);
    }
  } catch (error) {
    console.error(
      'Error al eliminar fotografía Safety:',
      error
    );
  }
};

const obtenerArea = async (
  idArea,
  connection = db,
  bloquear = false
) => {
  const [areas] = await connection.query(
    `
      SELECT id_area, nombre_area, descripcion, estado
      FROM safety_areas
      WHERE id_area = ?
      LIMIT 1
      ${bloquear ? 'FOR UPDATE' : ''}
    `,
    [idArea]
  );

  return areas[0] || null;
};

const construirFiltrosHistorial = (idArea, query) => {
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
    return {
      error: 'fecha_desde no puede ser posterior a fecha_hasta'
    };
  }

  if (
    nivelRiesgo &&
    !NIVELES_RIESGO_VALIDOS.includes(nivelRiesgo)
  ) {
    return { error: 'nivel_riesgo no es válido' };
  }

  const condiciones = ['h.id_area = ?'];
  const valores = [idArea];

  if (fechaDesde) {
    condiciones.push('h.fecha_hallazgo >= ?');
    valores.push(`${fechaDesde} 00:00:00`);
  }

  if (fechaHasta) {
    condiciones.push(
      'h.fecha_hallazgo < DATE_ADD(?, INTERVAL 1 DAY)'
    );
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

  return {
    where: `WHERE ${condiciones.join(' AND ')}`,
    valores
  };
};

const consultaHallazgos = (where, limite = '') => `
  SELECT
    h.id_hallazgo,
    h.id_area,
    a.nombre_area,
    h.descripcion,
    h.nivel_riesgo,
    h.ruta_foto,
    h.fecha_hallazgo,
    h.reportado_por,
    u.usuario AS nombre_usuario
  FROM safety_hallazgos h
  INNER JOIN safety_areas a
    ON h.id_area = a.id_area
  INNER JOIN usuarios u
    ON h.reportado_por = u.id_usuario
  ${where}
  ORDER BY
    h.fecha_hallazgo DESC,
    h.id_hallazgo DESC
  ${limite}
`;

const obtenerAreas = async (req, res) => {
  try {
    const [areas] = await db.query(`
      SELECT
        a.id_area,
        a.nombre_area,
        a.descripcion,
        COUNT(h.id_hallazgo) AS total_hallazgos
      FROM safety_areas a
      LEFT JOIN safety_hallazgos h
        ON a.id_area = h.id_area
      WHERE a.estado = 'Activa'
      GROUP BY
        a.id_area,
        a.nombre_area,
        a.descripcion
      ORDER BY a.id_area ASC
    `);

    return res.status(200).json({
      total: areas.length,
      areas: areas.map((area) => ({
        ...area,
        total_hallazgos: Number(area.total_hallazgos)
      }))
    });
  } catch (error) {
    console.error('Error al obtener áreas Safety:', error);

    return res.status(500).json({
      mensaje: 'Error al obtener las áreas de Safety'
    });
  }
};

const obtenerHallazgosRecientes = async (req, res) => {
  try {
    const idArea = convertirEnteroPositivo(req.params.id_area);

    if (!idArea) {
      return res.status(400).json({
        mensaje: 'id_area debe ser un entero válido'
      });
    }

    const area = await obtenerArea(idArea);

    if (!area) {
      return res.status(404).json({
        mensaje: 'Área Safety no encontrada'
      });
    }

    const [hallazgos] = await db.query(
      consultaHallazgos('WHERE h.id_area = ?', 'LIMIT 10'),
      [idArea]
    );

    return res.status(200).json({
      total: hallazgos.length,
      hallazgos
    });
  } catch (error) {
    console.error(
      'Error al obtener hallazgos recientes Safety:',
      error
    );

    return res.status(500).json({
      mensaje: 'Error al obtener los hallazgos recientes'
    });
  }
};

const crearHallazgo = async (req, res) => {
  let connection;
  let transaccionConfirmada = false;

  try {
    const { id_area, descripcion, nivel_riesgo } =
      safetyFindingRequestDto(req.body);

    if (!req.file) {
      return res.status(400).json({
        mensaje: 'La fotografía es obligatoria'
      });
    }

    const idArea = convertirEnteroPositivo(id_area);

    if (!idArea) {
      eliminarArchivoSubido(req.file);
      return res.status(400).json({
        mensaje: 'id_area debe ser un entero válido'
      });
    }

    if (!descripcion) {
      eliminarArchivoSubido(req.file);
      return res.status(400).json({
        mensaje: 'La descripción es obligatoria'
      });
    }

    if (!nivel_riesgo) {
      eliminarArchivoSubido(req.file);
      return res.status(400).json({
        mensaje: 'El nivel de riesgo es obligatorio'
      });
    }

    if (!NIVELES_RIESGO_VALIDOS.includes(nivel_riesgo)) {
      eliminarArchivoSubido(req.file);
      return res.status(400).json({
        mensaje: 'El nivel de riesgo no es válido'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const area = await obtenerArea(idArea, connection, true);

    if (!area) {
      await connection.rollback();
      eliminarArchivoSubido(req.file);
      return res.status(404).json({
        mensaje: 'Área Safety no encontrada'
      });
    }

    if (area.estado !== 'Activa') {
      await connection.rollback();
      eliminarArchivoSubido(req.file);
      return res.status(400).json({
        mensaje: 'No se pueden registrar hallazgos en un área inactiva'
      });
    }

    const reportadoPor = req.usuario.id_usuario;
    const rutaFoto = `/uploads/safety/${req.file.filename}`;

    const [resultado] = await connection.query(
      `
        INSERT INTO safety_hallazgos (
          id_area,
          descripcion,
          nivel_riesgo,
          ruta_foto,
          reportado_por
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        idArea,
        descripcion,
        nivel_riesgo,
        rutaFoto,
        reportadoPor
      ]
    );

    const [hallazgos] = await connection.query(
      consultaHallazgos('WHERE h.id_hallazgo = ?'),
      [resultado.insertId]
    );

    if (hallazgos.length === 0) {
      throw new Error(
        'No se pudo consultar el hallazgo recién creado'
      );
    }

    await connection.commit();
    transaccionConfirmada = true;

    return res.status(201).json({
      mensaje: 'Hallazgo Safety registrado correctamente',
      hallazgo: hallazgos[0]
    });
  } catch (error) {
    if (connection && !transaccionConfirmada) {
      await connection.rollback().catch((rollbackError) => {
        console.error(
          'Error al revertir creación Safety:',
          rollbackError
        );
      });
    }

    if (!transaccionConfirmada) {
      eliminarArchivoSubido(req.file);
    }

    console.error('Error al crear hallazgo Safety:', error);

    return res.status(500).json({
      mensaje: 'Error al registrar el hallazgo Safety'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const obtenerHistorial = async (req, res) => {
  try {
    const idArea = convertirEnteroPositivo(req.params.id_area);

    if (!idArea) {
      return res.status(400).json({
        mensaje: 'id_area debe ser un entero válido'
      });
    }

    const area = await obtenerArea(idArea);

    if (!area) {
      return res.status(404).json({
        mensaje: 'Área Safety no encontrada'
      });
    }

    const filtros = construirFiltrosHistorial(idArea, req.query);

    if (filtros.error) {
      return res.status(400).json({ mensaje: filtros.error });
    }

    const page = req.query.page === undefined
      ? 1
      : convertirEnteroPositivo(req.query.page);
    const limitSolicitado = req.query.limit === undefined
      ? 20
      : convertirEnteroPositivo(req.query.limit);

    if (!page || !limitSolicitado) {
      return res.status(400).json({
        mensaje: 'page y limit deben ser enteros positivos y seguros'
      });
    }

    if (page > 100000) {
      return res.status(400).json({
        mensaje: 'page no puede ser mayor a 100000'
      });
    }

    const limit = Math.min(limitSolicitado, 100);
    const offset = (page - 1) * limit;

    const [[conteo], [hallazgos]] = await Promise.all([
      db.query(
        `
          SELECT COUNT(*) AS total
          FROM safety_hallazgos h
          ${filtros.where}
        `,
        filtros.valores
      ),
      db.query(
        consultaHallazgos(filtros.where, 'LIMIT ? OFFSET ?'),
        [...filtros.valores, limit, offset]
      )
    ]);

    const total = Number(conteo[0].total);
    const totalPages = total === 0
      ? 0
      : Math.ceil(total / limit);

    return res.status(200).json({
      hallazgos,
      paginacion: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_previous_page: page > 1,
        has_next_page: page < totalPages
      }
    });
  } catch (error) {
    console.error('Error al obtener historial Safety:', error);

    return res.status(500).json({
      mensaje: 'Error al obtener el historial Safety'
    });
  }
};

const obtenerHallazgoPorId = async (req, res) => {
  try {
    const idHallazgo = convertirEnteroPositivo(
      req.params.id_hallazgo
    );

    if (!idHallazgo) {
      return res.status(400).json({
        mensaje: 'id_hallazgo debe ser un entero válido'
      });
    }

    const [hallazgos] = await db.query(
      consultaHallazgos('WHERE h.id_hallazgo = ?'),
      [idHallazgo]
    );

    if (hallazgos.length === 0) {
      return res.status(404).json({
        mensaje: 'Hallazgo Safety no encontrado'
      });
    }

    return res.status(200).json(hallazgos[0]);
  } catch (error) {
    console.error('Error al obtener hallazgo Safety:', error);

    return res.status(500).json({
      mensaje: 'Error al obtener el hallazgo Safety'
    });
  }
};

const exportarHistorial = async (req, res) => {
  try {
    const idArea = convertirEnteroPositivo(req.params.id_area);

    if (!idArea) {
      return res.status(400).json({
        mensaje: 'id_area debe ser un entero válido'
      });
    }

    const area = await obtenerArea(idArea);

    if (!area) {
      return res.status(404).json({
        mensaje: 'Área Safety no encontrada'
      });
    }

    const filtros = construirFiltrosHistorial(idArea, req.query);

    if (filtros.error) {
      return res.status(400).json({ mensaje: filtros.error });
    }

    const [hallazgos] = await db.query(
      `
        SELECT
          a.nombre_area AS area,
          DATE_FORMAT(h.fecha_hallazgo, '%Y-%m-%d') AS fecha,
          TIME_FORMAT(h.fecha_hallazgo, '%H:%i:%s') AS hora,
          u.usuario,
          h.descripcion,
          h.nivel_riesgo
        FROM safety_hallazgos h
        INNER JOIN safety_areas a
          ON h.id_area = a.id_area
        INNER JOIN usuarios u
          ON h.reportado_por = u.id_usuario
        ${filtros.where}
        ORDER BY
          h.fecha_hallazgo DESC,
          h.id_hallazgo DESC
        LIMIT 10001
      `,
      filtros.valores
    );

    if (hallazgos.length > 10000) {
      return res.status(400).json({
        mensaje:
          'La exportación supera el máximo de 10,000 registros. Aplica filtros más específicos'
      });
    }

    if (hallazgos.length === 0) {
      return res.status(404).json({
        mensaje:
          'No existen hallazgos para exportar con los filtros seleccionados'
      });
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

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `safety-${idArea}-${fechaArchivo}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreArchivo}"`
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Error al exportar historial Safety:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        mensaje: 'Error interno al generar el archivo Excel'
      });
    }

    return res.end();
  }
};

module.exports = {
  obtenerAreas,
  obtenerHallazgosRecientes,
  crearHallazgo,
  obtenerHistorial,
  obtenerHallazgoPorId,
  exportarHistorial
};
