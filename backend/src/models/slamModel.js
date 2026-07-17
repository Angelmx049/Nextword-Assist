const db = require('../config/db');

const crear = async (datos) => {
  const [resultado] = await db.query(
    `INSERT INTO slam_reportes
      (stop, look, assess, manage, ruta_foto, nombre_foto, tipo_foto, reportado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.stop, datos.look, datos.assess, datos.manage,
      datos.ruta_foto, datos.nombre_foto, datos.tipo_foto, datos.reportado_por
    ]
  );
  return resultado.insertId;
};

const listar = async () => {
  const [practicas] = await db.query(`
    SELECT s.id_slam, s.stop, s.look, s.assess, s.manage,
           s.ruta_foto, s.nombre_foto, s.tipo_foto,
           s.reportado_por, s.fecha_reporte,
           u.usuario AS nombre_usuario
    FROM slam_reportes s
    INNER JOIN usuarios u ON s.reportado_por = u.id_usuario
    ORDER BY s.fecha_reporte DESC
  `);
  return practicas;
};

const contar = async () => {
  const [resultado] = await db.query('SELECT COUNT(*) AS total FROM slam_reportes');
  return Number(resultado[0].total);
};

const obtenerPorId = async (id) => {
  const [practicas] = await db.query(
    `SELECT s.id_slam, s.stop, s.look, s.assess, s.manage,
            s.ruta_foto, s.nombre_foto, s.tipo_foto,
            s.reportado_por, s.fecha_reporte,
            u.usuario AS nombre_usuario
     FROM slam_reportes s
     INNER JOIN usuarios u ON s.reportado_por = u.id_usuario
     WHERE s.id_slam = ?`,
    [id]
  );
  return practicas[0] || null;
};

const obtenerRegistro = async (id) => {
  const [practicas] = await db.query('SELECT * FROM slam_reportes WHERE id_slam = ?', [id]);
  return practicas[0] || null;
};

const actualizar = (id, datos) => db.query(
  `UPDATE slam_reportes
   SET stop = ?, look = ?, assess = ?, manage = ?,
       ruta_foto = ?, nombre_foto = ?, tipo_foto = ?
   WHERE id_slam = ?`,
  [
    datos.stop, datos.look, datos.assess, datos.manage,
    datos.ruta_foto, datos.nombre_foto, datos.tipo_foto, id
  ]
);

const obtenerRutaFoto = async (id) => {
  const [practicas] = await db.query(
    'SELECT id_slam, ruta_foto FROM slam_reportes WHERE id_slam = ?',
    [id]
  );
  return practicas[0] || null;
};

const eliminar = (id) => db.query('DELETE FROM slam_reportes WHERE id_slam = ?', [id]);

const listarParaExportar = async () => {
  const [practicas] = await db.query(`
    SELECT s.id_slam,
      DATE_FORMAT(s.fecha_reporte, '%Y-%m-%d') AS fecha,
      TIME_FORMAT(s.fecha_reporte, '%H:%i:%s') AS hora,
      s.stop, s.look, s.assess, s.manage,
      u.usuario AS reportado_por
    FROM slam_reportes s
    INNER JOIN usuarios u ON s.reportado_por = u.id_usuario
    ORDER BY s.fecha_reporte DESC
  `);
  return practicas;
};

module.exports = {
  crear,
  listar,
  contar,
  obtenerPorId,
  obtenerRegistro,
  actualizar,
  obtenerRutaFoto,
  eliminar,
  listarParaExportar
};
