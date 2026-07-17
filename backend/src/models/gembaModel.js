const db = require('../config/db');

const construirFiltrosSql = ({ id_courier, fecha, manejo }) => {
  const condiciones = ['g.activo = 1'];
  const valores = [];

  if (id_courier) {
    condiciones.push('g.id_courier = ?');
    valores.push(Number(id_courier));
  }
  if (fecha) {
    condiciones.push('g.fecha = ?');
    valores.push(fecha);
  }
  if (manejo) {
    condiciones.push('g.manejo = ?');
    valores.push(manejo);
  }

  return { where: condiciones.join(' AND '), valores };
};

const listarCouriersActivos = async () => {
  const [resultados] = await db.query(`
    SELECT
      id_courier,
      nombre
    FROM couriers
    WHERE estado = 'Activo'
    ORDER BY id_courier ASC
  `);
  return resultados;
};

const buscarCourierActivo = async (idCourier) => {
  const [resultados] = await db.query(
    `
    SELECT
      id_courier,
      nombre,
      estado
    FROM couriers
    WHERE
      id_courier = ?
      AND estado = 'Activo'
    LIMIT 1
    `,
    [idCourier]
  );
  return resultados[0] || null;
};

const crear = async (datos, idUsuario) => {
  const [resultado] = await db.query(
    `
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
    `,
    [
      datos.id_courier,
      datos.fecha,
      datos.hora,
      datos.numero_eco,
      datos.cantidad_paradas,
      datos.tiempo_horas,
      datos.tiempo_minutos,
      datos.manejo,
      datos.observaciones,
      idUsuario
    ]
  );
  return resultado.insertId;
};

const listar = async (filtros) => {
  const { where, valores } = construirFiltrosSql(filtros);
  const [resultados] = await db.query(
    `
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
    `,
    valores
  );
  return resultados;
};

const obtenerPorId = async (idGemba) => {
  const [resultados] = await db.query(
    `
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
    `,
    [idGemba]
  );
  return resultados[0] || null;
};

const obtenerPropietario = async (idGemba) => {
  const [evaluaciones] = await db.query(
    `
    SELECT
      id_gemba,
      registrado_por
    FROM gemba_ride
    WHERE
      id_gemba = ?
      AND activo = 1
    LIMIT 1
    `,
    [idGemba]
  );
  return evaluaciones[0] || null;
};

const actualizar = async (idGemba, datos) => {
  const [resultado] = await db.query(
    `
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
    `,
    [
      datos.id_courier,
      datos.fecha,
      datos.hora,
      datos.numero_eco,
      datos.cantidad_paradas,
      datos.tiempo_horas,
      datos.tiempo_minutos,
      datos.manejo,
      datos.observaciones,
      idGemba
    ]
  );
  return resultado.affectedRows;
};

const eliminar = async (idGemba) => {
  const [resultado] = await db.query(
    `
    UPDATE gemba_ride
    SET activo = 0
    WHERE
      id_gemba = ?
      AND activo = 1
    `,
    [idGemba]
  );
  return resultado.affectedRows;
};

const listarParaExportar = async (filtros) => {
  const { where, valores } = construirFiltrosSql(filtros);
  const [resultados] = await db.query(
    `
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
    `,
    valores
  );
  return resultados;
};

module.exports = {
  listarCouriersActivos,
  buscarCourierActivo,
  crear,
  listar,
  obtenerPorId,
  obtenerPropietario,
  actualizar,
  eliminar,
  listarParaExportar
};
