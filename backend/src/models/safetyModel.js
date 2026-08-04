const db = require('../config/db');

const consultaHallazgos = (where, limite = '') => `
  SELECT h.id_hallazgo, h.id_area, a.nombre_area, h.descripcion,
         h.nivel_riesgo, h.ruta_foto, h.fecha_hallazgo,
         h.reportado_por, u.usuario AS nombre_usuario
  FROM safety_hallazgos h
  INNER JOIN safety_areas a ON h.id_area = a.id_area
  INNER JOIN usuarios u ON h.reportado_por = u.id_usuario
  ${where}
  ORDER BY h.fecha_hallazgo DESC, h.id_hallazgo DESC
  ${limite}
`;

const listarAreas = async () => {
  const [areas] = await db.query(`
    SELECT a.id_area, a.nombre_area, a.descripcion,
           COUNT(h.id_hallazgo) AS total_hallazgos
    FROM safety_areas a
    LEFT JOIN safety_hallazgos h ON a.id_area = h.id_area
    WHERE a.estado = 'Activa'
    GROUP BY a.id_area, a.nombre_area, a.descripcion
    ORDER BY a.id_area ASC
  `);
  return areas;
};

const obtenerArea = async (idArea, connection = db, bloquear = false) => {
  const [areas] = await connection.query(
    `SELECT id_area, nombre_area, descripcion, estado
     FROM safety_areas
     WHERE id_area = ?
     LIMIT 1
     ${bloquear ? 'FOR UPDATE' : ''}`,
    [idArea]
  );
  return areas[0] || null;
};

const listarRecientes = async (idArea) => {
  const [hallazgos] = await db.query(
    consultaHallazgos('WHERE h.id_area = ?', 'LIMIT 5'),
    [idArea]
  );
  return hallazgos;
};

const obtenerConexion = () => db.getConnection();
const iniciarTransaccion = (connection) => connection.beginTransaction();
const confirmarTransaccion = (connection) => connection.commit();
const revertirTransaccion = (connection) => connection.rollback();
const liberarConexion = (connection) => connection.release();

const crearHallazgo = async (connection, datos) => {
  const [resultado] = await connection.query(
    `INSERT INTO safety_hallazgos
      (id_area, descripcion, nivel_riesgo, ruta_foto, reportado_por)
     VALUES (?, ?, ?, ?, ?)`,
    [datos.idArea, datos.descripcion, datos.nivelRiesgo, datos.rutaFoto, datos.reportadoPor]
  );
  return resultado.insertId;
};

const obtenerHallazgo = async (idHallazgo, connection = db) => {
  const [hallazgos] = await connection.query(
    consultaHallazgos('WHERE h.id_hallazgo = ?'),
    [idHallazgo]
  );
  return hallazgos[0] || null;
};

const obtenerHistorial = async (where, valores, limit, offset) => {
  const [[conteo], [hallazgos]] = await Promise.all([
    db.query(`SELECT COUNT(*) AS total FROM safety_hallazgos h ${where}`, valores),
    db.query(consultaHallazgos(where, 'LIMIT ? OFFSET ?'), [...valores, limit, offset])
  ]);
  return { total: Number(conteo[0].total), hallazgos };
};

const listarParaExportar = async (where, valores) => {
  const [hallazgos] = await db.query(
    `SELECT a.nombre_area AS area,
            DATE_FORMAT(h.fecha_hallazgo, '%Y-%m-%d') AS fecha,
            TIME_FORMAT(h.fecha_hallazgo, '%H:%i:%s') AS hora,
            u.usuario, h.descripcion, h.nivel_riesgo
     FROM safety_hallazgos h
     INNER JOIN safety_areas a ON h.id_area = a.id_area
     INNER JOIN usuarios u ON h.reportado_por = u.id_usuario
     ${where}
     ORDER BY h.fecha_hallazgo DESC, h.id_hallazgo DESC
     LIMIT 10001`,
    valores
  );
  return hallazgos;
};

module.exports = {
  listarAreas,
  obtenerArea,
  listarRecientes,
  obtenerConexion,
  iniciarTransaccion,
  confirmarTransaccion,
  revertirTransaccion,
  liberarConexion,
  crearHallazgo,
  obtenerHallazgo,
  obtenerHistorial,
  listarParaExportar
};
