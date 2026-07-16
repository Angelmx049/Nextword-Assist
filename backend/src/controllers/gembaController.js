const db = require("../config/db");
const { gembaRequestDto } = require("../dto/requestDtos");
const ExcelJS = require("exceljs");

/**
 * Evaluaciones permitidas por GEMBA RIDE.
 */
const MANEJOS_PERMITIDOS = [
  "Excelente",
  "Bueno",
  "Regular",
  "Necesita mejorar",
];

/**
 * Convierte un valor a entero.
 * Devuelve null cuando el valor no es un entero válido.
 */
const convertirEntero = (valor) => {
  const numero = Number(valor);

  if (!Number.isInteger(numero)) {
    return null;
  }

  return numero;
};

/**
 * Obtiene el ID del usuario autenticado desde el JWT.
 *
 * Se contempla:
 * - req.usuario.id_usuario
 * - req.usuario.id
 *
 * Esto permite compatibilidad con la estructura actual
 * del token del proyecto.
 */
const obtenerIdUsuario = (req) => {
  return req.usuario?.id_usuario ?? req.usuario?.id ?? null;
};

/**
 * Obtiene el rol del usuario autenticado.
 */
const obtenerRolUsuario = (req) => {
  return req.usuario?.rol ?? null;
};

/**
 * Valida los campos obligatorios
 * de una evaluación GEMBA RIDE.
 */
const validarEvaluacion = ({
  id_courier,
  fecha,
  hora,
  numero_eco,
  cantidad_paradas,
  tiempo_horas,
  tiempo_minutos,
  manejo,
}) => {
  const errores = [];

  const courierId = convertirEntero(id_courier);

  if (courierId === null || courierId <= 0) {
    errores.push(
      "El courier es obligatorio y debe ser válido."
    );
  }

  if (!fecha) {
    errores.push("La fecha es obligatoria.");
  }

  if (!hora) {
    errores.push("La hora es obligatoria.");
  }

  if (!numero_eco || !String(numero_eco).trim()) {
    errores.push(
      "El número económico es obligatorio."
    );
  }

  const paradas = convertirEntero(cantidad_paradas);

  if (paradas === null || paradas < 0) {
    errores.push(
      "La cantidad de paradas debe ser un entero mayor o igual a 0."
    );
  }

  const horas = convertirEntero(tiempo_horas);

  if (horas === null || horas < 0) {
    errores.push(
      "Las horas deben ser un entero mayor o igual a 0."
    );
  }

  const minutos = convertirEntero(tiempo_minutos);

  if (
    minutos === null ||
    minutos < 0 ||
    minutos > 59
  ) {
    errores.push(
      "Los minutos deben estar entre 0 y 59."
    );
  }

  if (
    horas !== null &&
    minutos !== null &&
    horas === 0 &&
    minutos === 0
  ) {
    errores.push(
      "El tiempo total debe ser mayor a 0 minutos."
    );
  }

  if (!manejo) {
    errores.push(
      "La evaluación de manejo es obligatoria."
    );
  } else if (!MANEJOS_PERMITIDOS.includes(manejo)) {
    errores.push(
      "La evaluación de manejo debe ser Excelente, Bueno, Regular o Necesita mejorar."
    );
  }

  return errores;
};

/**
 * Verifica que un courier exista
 * y se encuentre activo.
 */
const buscarCourierActivo = async (idCourier) => {
  const sql = `
    SELECT
      id_courier,
      nombre,
      estado
    FROM couriers
    WHERE
      id_courier = ?
      AND estado = 'Activo'
    LIMIT 1
  `;

  const [resultados] = await db.query(
    sql,
    [idCourier]
  );

  return resultados[0] || null;
};

/**
 * Construye filtros SQL reutilizables.
 *
 * Se utiliza en:
 * - historial
 * - exportación Excel
 */
const construirFiltros = (query) => {
  const {
    id_courier,
    fecha,
    manejo,
  } = query;

  const condiciones = [
    "g.activo = 1",
  ];

  const valores = [];

  if (id_courier) {
    condiciones.push(
      "g.id_courier = ?"
    );

    valores.push(
      Number(id_courier)
    );
  }

  if (fecha) {
    condiciones.push(
      "g.fecha = ?"
    );

    valores.push(fecha);
  }

  if (manejo) {
    condiciones.push(
      "g.manejo = ?"
    );

    valores.push(manejo);
  }

  return {
    where: condiciones.join(" AND "),
    valores,
  };
};

/**
 * GET /api/gemba/couriers
 *
 * Obtiene solamente couriers activos.
 *
 * React utilizará esta información
 * para construir los botones.
 */
const obtenerCouriersActivos = async (req, res) => {
  try {
    const sql = `
      SELECT
        id_courier,
        nombre
      FROM couriers
      WHERE estado = 'Activo'
      ORDER BY id_courier ASC
    `;

    const [resultados] = await db.query(sql);

    return res.status(200).json({
      total: resultados.length,
      couriers: resultados,
    });
  } catch (error) {
    console.error(
      "Error al consultar couriers:",
      error
    );

    return res.status(500).json({
      mensaje:
        "Error interno al consultar los couriers.",
    });
  }
};

/**
 * POST /api/gemba
 *
 * Registra una nueva evaluación.
 */
const crearEvaluacion = async (req, res) => {
  try {
    const {
      id_courier,
      fecha,
      hora,
      numero_eco,
      cantidad_paradas,
      tiempo_horas,
      tiempo_minutos = 0,
      manejo,
      observaciones,
    } = gembaRequestDto(req.body);

    const idUsuario = obtenerIdUsuario(req);

    if (!idUsuario) {
      return res.status(401).json({
        mensaje:
          "No se pudo identificar al usuario autenticado.",
      });
    }

    const errores = validarEvaluacion({
      id_courier,
      fecha,
      hora,
      numero_eco,
      cantidad_paradas,
      tiempo_horas,
      tiempo_minutos,
      manejo,
    });

    if (errores.length > 0) {
      return res.status(400).json({
        mensaje:
          "La evaluación contiene datos inválidos.",
        errores,
      });
    }

    /**
     * Verificamos que el courier exista
     * y esté activo.
     */
    const courier = await buscarCourierActivo(
      Number(id_courier)
    );

    if (!courier) {
      return res.status(400).json({
        mensaje:
          "El courier seleccionado no existe o está inactivo.",
      });
    }

    const sql = `
      INSERT INTO gemba_ride (
        id_courier,
        fecha,
        hora,
        numero_eco,
        cantidad_paradas,
        tiempo_horas,
        tiempo_minutos,
        manejo,
        observaciones,
        registrado_por
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valores = [
      Number(id_courier),
      fecha,
      hora,
      String(numero_eco).trim(),
      Number(cantidad_paradas),
      Number(tiempo_horas),
      Number(tiempo_minutos),
      manejo,
      observaciones?.trim() || null,
      idUsuario,
    ];

    const [resultado] = await db.query(
      sql,
      valores
    );

    return res.status(201).json({
      mensaje:
        "Evaluación GEMBA RIDE registrada correctamente.",

      id_gemba:
        resultado.insertId,

      courier:
        courier.nombre,
    });
  } catch (error) {
    console.error(
      "Error al crear evaluación GEMBA RIDE:",
      error
    );

    return res.status(500).json({
      mensaje:
        "Error interno al guardar la evaluación.",
    });
  }
};

/**
 * GET /api/gemba
 *
 * Consulta historial.
 *
 * Filtros:
 * - id_courier
 * - fecha
 * - manejo
 */
const obtenerEvaluaciones = async (req, res) => {
  try {
    const {
      id_courier,
      manejo,
    } = req.query;

    /**
     * Validación del filtro courier.
     */
    if (id_courier) {
      const courierId =
        convertirEntero(id_courier);

      if (
        courierId === null ||
        courierId <= 0
      ) {
        return res.status(400).json({
          mensaje:
            "El filtro id_courier no es válido.",
        });
      }
    }

    /**
     * Validación del filtro manejo.
     */
    if (
      manejo &&
      !MANEJOS_PERMITIDOS.includes(manejo)
    ) {
      return res.status(400).json({
        mensaje:
          "El filtro de manejo no es válido.",
      });
    }

    const {
      where,
      valores,
    } = construirFiltros(req.query);

    const sql = `
      SELECT
        g.id_gemba,

        g.id_courier,
        c.nombre AS courier,

        g.fecha,
        g.hora,

        g.numero_eco,
        g.cantidad_paradas,

        g.tiempo_horas,
        g.tiempo_minutos,

        g.manejo,
        g.observaciones,

        g.registrado_por,
        u.usuario AS usuario_registro,

        g.fecha_creacion,
        g.fecha_actualizacion

      FROM gemba_ride g

      INNER JOIN couriers c
        ON c.id_courier = g.id_courier

      INNER JOIN usuarios u
        ON u.id_usuario = g.registrado_por

      WHERE ${where}

      ORDER BY
        g.fecha DESC,
        g.hora DESC,
        g.id_gemba DESC
    `;

    const [resultados] = await db.query(
      sql,
      valores
    );

    return res.status(200).json({
      total:
        resultados.length,

      filtros: {
        id_courier:
          req.query.id_courier || null,

        fecha:
          req.query.fecha || null,

        manejo:
          req.query.manejo || null,
      },

      registros:
        resultados,
    });
  } catch (error) {
    console.error(
      "Error al consultar GEMBA RIDE:",
      error
    );

    return res.status(500).json({
      mensaje:
        "Error interno al consultar el historial.",
    });
  }
};

/**
 * GET /api/gemba/:id
 *
 * Consulta una evaluación específica.
 */
const obtenerEvaluacionPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const idGemba = convertirEntero(id);

    if (
      idGemba === null ||
      idGemba <= 0
    ) {
      return res.status(400).json({
        mensaje:
          "El identificador de la evaluación no es válido.",
      });
    }

    const sql = `
      SELECT
        g.id_gemba,

        g.id_courier,
        c.nombre AS courier,

        g.fecha,
        g.hora,

        g.numero_eco,
        g.cantidad_paradas,

        g.tiempo_horas,
        g.tiempo_minutos,

        g.manejo,
        g.observaciones,

        g.registrado_por,
        u.usuario AS usuario_registro,

        g.fecha_creacion,
        g.fecha_actualizacion

      FROM gemba_ride g

      INNER JOIN couriers c
        ON c.id_courier = g.id_courier

      INNER JOIN usuarios u
        ON u.id_usuario = g.registrado_por

      WHERE
        g.id_gemba = ?
        AND g.activo = 1

      LIMIT 1
    `;

    const [resultados] = await db.query(
      sql,
      [idGemba]
    );

    if (resultados.length === 0) {
      return res.status(404).json({
        mensaje:
          "La evaluación GEMBA RIDE no existe.",
      });
    }

    return res.status(200).json(
      resultados[0]
    );
  } catch (error) {
    console.error(
      "Error al consultar evaluación GEMBA RIDE:",
      error
    );

    return res.status(500).json({
      mensaje:
        "Error interno al consultar la evaluación.",
    });
  }
};

/**
 * PUT /api/gemba/:id
 *
 * ADMINISTRADOR:
 * - puede editar cualquier registro
 *
 * SUPERVISOR:
 * - solamente registros creados por él
 */
const actualizarEvaluacion = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      id_courier,
      fecha,
      hora,
      numero_eco,
      cantidad_paradas,
      tiempo_horas,
      tiempo_minutos = 0,
      manejo,
      observaciones,
    } = gembaRequestDto(req.body);

    const idGemba =
      convertirEntero(id);

    const idUsuario =
      obtenerIdUsuario(req);

    const rol =
      obtenerRolUsuario(req);

    if (
      idGemba === null ||
      idGemba <= 0
    ) {
      return res.status(400).json({
        mensaje:
          "El identificador de la evaluación no es válido.",
      });
    }

    if (!idUsuario || !rol) {
      return res.status(401).json({
        mensaje:
          "No se pudo identificar al usuario autenticado.",
      });
    }

    const errores = validarEvaluacion({
      id_courier,
      fecha,
      hora,
      numero_eco,
      cantidad_paradas,
      tiempo_horas,
      tiempo_minutos,
      manejo,
    });

    if (errores.length > 0) {
      return res.status(400).json({
        mensaje:
          "La evaluación contiene datos inválidos.",
        errores,
      });
    }

    /**
     * Buscar evaluación existente.
     */
    const sqlBuscarEvaluacion = `
      SELECT
        id_gemba,
        registrado_por
      FROM gemba_ride
      WHERE
        id_gemba = ?
        AND activo = 1
      LIMIT 1
    `;

    const [evaluaciones] = await db.query(
      sqlBuscarEvaluacion,
      [idGemba]
    );

    if (evaluaciones.length === 0) {
      return res.status(404).json({
        mensaje:
          "La evaluación GEMBA RIDE no existe.",
      });
    }

    const evaluacionActual =
      evaluaciones[0];

    const esAdministrador =
      rol === "ADMINISTRADOR";

    const esPropietario =
      Number(
        evaluacionActual.registrado_por
      ) === Number(idUsuario);

    /**
     * SUPERVISOR solo puede editar
     * evaluaciones creadas por él.
     */
    if (
      !esAdministrador &&
      !esPropietario
    ) {
      return res.status(403).json({
        mensaje:
          "No tienes permiso para editar una evaluación registrada por otro usuario.",
      });
    }

    /**
     * Verificar courier.
     */
    const courier = await buscarCourierActivo(
      Number(id_courier)
    );

    if (!courier) {
      return res.status(400).json({
        mensaje:
          "El courier seleccionado no existe o está inactivo.",
      });
    }

    /**
     * Actualizar evaluación.
     */
    const sqlActualizar = `
      UPDATE gemba_ride
      SET
        id_courier = ?,
        fecha = ?,
        hora = ?,
        numero_eco = ?,
        cantidad_paradas = ?,
        tiempo_horas = ?,
        tiempo_minutos = ?,
        manejo = ?,
        observaciones = ?
      WHERE
        id_gemba = ?
        AND activo = 1
    `;

    const valores = [
      Number(id_courier),
      fecha,
      hora,
      String(numero_eco).trim(),
      Number(cantidad_paradas),
      Number(tiempo_horas),
      Number(tiempo_minutos),
      manejo,
      observaciones?.trim() || null,
      idGemba,
    ];

    const [resultado] = await db.query(
      sqlActualizar,
      valores
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensaje:
          "La evaluación GEMBA RIDE no pudo ser actualizada.",
      });
    }

    return res.status(200).json({
      mensaje:
        "Evaluación GEMBA RIDE actualizada correctamente.",

      id_gemba:
        idGemba,

      courier:
        courier.nombre,
    });
  } catch (error) {
    console.error(
      "Error al actualizar evaluación GEMBA RIDE:",
      error
    );

    return res.status(500).json({
      mensaje:
        "Error interno al actualizar la evaluación.",
    });
  }
};

/**
 * DELETE /api/gemba/:id
 *
 * Baja lógica.
 *
 * No elimina físicamente.
 *
 * La ruta debe estar limitada
 * a ADMINISTRADOR.
 */
const eliminarEvaluacion = async (req, res) => {
  try {
    const { id } = req.params;

    const idGemba =
      convertirEntero(id);

    if (
      idGemba === null ||
      idGemba <= 0
    ) {
      return res.status(400).json({
        mensaje:
          "El identificador de la evaluación no es válido.",
      });
    }

    const sql = `
      UPDATE gemba_ride
      SET activo = 0
      WHERE
        id_gemba = ?
        AND activo = 1
    `;

    const [resultado] = await db.query(
      sql,
      [idGemba]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensaje:
          "La evaluación GEMBA RIDE no existe o ya fue eliminada.",
      });
    }

    return res.status(200).json({
      mensaje:
        "Evaluación GEMBA RIDE eliminada correctamente.",
    });
  } catch (error) {
    console.error(
      "Error al eliminar GEMBA RIDE:",
      error
    );

    return res.status(500).json({
      mensaje:
        "Error interno al eliminar la evaluación.",
    });
  }
};

/**
 * GET /api/gemba/exportar/excel
 *
 * Exporta:
 * - todos los registros
 * - o registros filtrados
 *
 * Filtros:
 * - id_courier
 * - fecha
 * - manejo
 *
 * Solo ADMINISTRADOR.
 */
const exportarExcel = async (req, res) => {
  try {
    const {
      id_courier,
      manejo,
    } = req.query;

    /**
     * Validar courier.
     */
    if (id_courier) {
      const courierId =
        convertirEntero(id_courier);

      if (
        courierId === null ||
        courierId <= 0
      ) {
        return res.status(400).json({
          mensaje:
            "El filtro id_courier no es válido.",
        });
      }
    }

    /**
     * Validar manejo.
     */
    if (
      manejo &&
      !MANEJOS_PERMITIDOS.includes(manejo)
    ) {
      return res.status(400).json({
        mensaje:
          "El filtro de manejo no es válido.",
      });
    }

    const {
      where,
      valores,
    } = construirFiltros(req.query);

    const sql = `
      SELECT
        g.id_gemba,

        c.nombre AS courier,

        g.fecha,
        g.hora,

        g.numero_eco,
        g.cantidad_paradas,

        g.tiempo_horas,
        g.tiempo_minutos,

        g.manejo,
        g.observaciones,

        u.usuario AS usuario_registro,

        g.fecha_creacion

      FROM gemba_ride g

      INNER JOIN couriers c
        ON c.id_courier = g.id_courier

      INNER JOIN usuarios u
        ON u.id_usuario = g.registrado_por

      WHERE ${where}

      ORDER BY
        g.fecha DESC,
        g.hora DESC,
        g.id_gemba DESC
    `;

    const [resultados] = await db.query(
      sql,
      valores
    );

    if (resultados.length === 0) {
      return res.status(404).json({
        mensaje:
          "No existen registros para exportar con los filtros seleccionados.",
      });
    }

    /**
     * Crear archivo Excel.
     */
    const workbook =
      new ExcelJS.Workbook();

    workbook.creator =
      "ASSIST DHL";

    workbook.created =
      new Date();

    const worksheet =
      workbook.addWorksheet(
        "GEMBA RIDE"
      );

    /**
     * Columnas.
     */
    worksheet.columns = [
      {
        header: "ID",
        key: "id_gemba",
        width: 10,
      },
      {
        header: "Courier",
        key: "courier",
        width: 18,
      },
      {
        header: "Fecha",
        key: "fecha",
        width: 15,
      },
      {
        header: "Hora",
        key: "hora",
        width: 12,
      },
      {
        header: "Número económico",
        key: "numero_eco",
        width: 20,
      },
      {
        header: "Paradas",
        key: "cantidad_paradas",
        width: 12,
      },
      {
        header: "Tiempo total",
        key: "tiempo_total",
        width: 18,
      },
      {
        header: "Evaluación",
        key: "manejo",
        width: 18,
      },
      {
        header: "Observaciones",
        key: "observaciones",
        width: 40,
      },
      {
        header: "Registrado por",
        key: "usuario_registro",
        width: 20,
      },
    ];

    /**
     * Agregar registros.
     */
    resultados.forEach((registro) => {
      worksheet.addRow({
        id_gemba:
          registro.id_gemba,

        courier:
          registro.courier,

        fecha:
          registro.fecha,

        hora:
          registro.hora,

        numero_eco:
          registro.numero_eco,

        cantidad_paradas:
          registro.cantidad_paradas,

        tiempo_total:
          `${registro.tiempo_horas}h ${registro.tiempo_minutos}m`,

        manejo:
          registro.manejo,

        observaciones:
          registro.observaciones || "",

        usuario_registro:
          registro.usuario_registro,
      });
    });

    /**
     * Encabezados en negritas.
     */
    worksheet.getRow(1).font = {
      bold: true,
    };

    /**
     * Filtro automático en Excel.
     */
    worksheet.autoFilter = {
      from: "A1",
      to: "J1",
    };

    /**
     * Congelar encabezados.
     */
    worksheet.views = [
      {
        state: "frozen",
        ySplit: 1,
      },
    ];

    /**
     * Nombre de archivo.
     */
    const fechaArchivo =
      new Date()
        .toISOString()
        .slice(0, 10);

    const nombreArchivo =
      `gemba-ride-${fechaArchivo}.xlsx`;

    /**
     * Headers HTTP.
     */
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nombreArchivo}"`
    );

    /**
     * Escribir Excel directamente
     * en la respuesta HTTP.
     */
    await workbook.xlsx.write(res);

    return res.end();
  } catch (error) {
    console.error(
      "Error al exportar GEMBA RIDE a Excel:",
      error
    );

    /**
     * Si todavía no se enviaron headers,
     * podemos devolver JSON.
     */
    if (!res.headersSent) {
      return res.status(500).json({
        mensaje:
          "Error interno al generar el archivo Excel.",
      });
    }

    return res.end();
  }
};

module.exports = {
  obtenerCouriersActivos,
  crearEvaluacion,
  obtenerEvaluaciones,
  obtenerEvaluacionPorId,
  actualizarEvaluacion,
  eliminarEvaluacion,
  exportarExcel,
};
