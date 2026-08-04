const db = require('../config/db');

const construirFiltrosSql = (operador, fecha) => {
  const condiciones = [];
  const valores = [];

  if (operador && operador.trim() !== '') {
    condiciones.push('operador LIKE ?');
    valores.push(`%${operador.trim()}%`);
  }

  if (fecha && fecha.trim() !== '') {
    condiciones.push('fecha = ?');
    valores.push(fecha.trim());
  }

  return {
    where: condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '',
    valores
  };
};

const listar = async (operador, fecha) => {
  const { where, valores } = construirFiltrosSql(operador, fecha);
  const [registros] = await db.query(
    `
    SELECT
      id_mc,
      DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
      TIME_FORMAT(hora, '%H:%i:%s') AS hora,
      mc,
      operador,
      observaciones,
      creado_por,
      fecha_creacion,
      fecha_actualizacion
    FROM mc_marcaciones
    ${where}
    ORDER BY fecha DESC, hora DESC
    `,
    valores
  );
  return registros;
};

const obtenerPorId = async (id) => {
  const [registros] = await db.query(
    `
    SELECT
      id_mc,
      DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
      TIME_FORMAT(hora, '%H:%i:%s') AS hora,
      mc,
      operador,
      observaciones,
      creado_por,
      fecha_creacion,
      fecha_actualizacion
    FROM mc_marcaciones
    WHERE id_mc = ?
    `,
    [id]
  );
  return registros[0] || null;
};

const crear = async ({ fecha, hora, mc, operador, observaciones }, idUsuario) => {
  const [resultado] = await db.query(
    `
    INSERT INTO mc_marcaciones (
      fecha,
      hora,
      mc,
      operador,
      observaciones,
      creado_por
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [fecha, hora, mc, operador, observaciones, idUsuario]
  );
  return resultado.insertId;
};

const existe = async (id) => {
  const [registros] = await db.query(
    `
    SELECT id_mc
    FROM mc_marcaciones
    WHERE id_mc = ?
    `,
    [id]
  );
  return registros.length > 0;
};

const obtenerPropietario = async (id) => {
  const [registros] = await db.query(
    `
    SELECT
      id_mc,
      creado_por
    FROM mc_marcaciones
    WHERE id_mc = ?
    LIMIT 1
    `,
    [id]
  );
  return registros[0] || null;
};

const actualizar = async (id, { fecha, hora, mc, operador, observaciones }) => {
  await db.query(
    `
    UPDATE mc_marcaciones
    SET
      fecha = ?,
      hora = ?,
      mc = ?,
      operador = ?,
      observaciones = ?
    WHERE id_mc = ?
    `,
    [fecha, hora, mc, operador, observaciones, id]
  );
};

const eliminar = async (id) => {
  const [resultado] = await db.query(
    `
    DELETE FROM mc_marcaciones
    WHERE id_mc = ?
    `,
    [id]
  );
  return resultado.affectedRows;
};

const listarParaExportar = async (operador, fecha) => {
  const { where, valores } = construirFiltrosSql(operador, fecha);
  const [registros] = await db.query(
    `
    SELECT
      DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
      TIME_FORMAT(hora, '%H:%i:%s') AS hora,
      mc,
      operador,
      observaciones
    FROM mc_marcaciones
    ${where}
    ORDER BY fecha DESC, hora DESC
    `,
    valores
  );
  return registros;
};

module.exports = {
  listar,
  obtenerPorId,
  crear,
  existe,
  obtenerPropietario,
  actualizar,
  eliminar,
  listarParaExportar
};
