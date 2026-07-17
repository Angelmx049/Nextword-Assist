const db = require('../config/db');

const buscarUsuarioPorNombre = async (usuario) => {
  const [usuarios] = await db.query(
    `
    SELECT
      u.id_usuario,
      u.usuario,
      u.password,
      u.id_rol,
      r.nombre_rol
    FROM usuarios u
    INNER JOIN roles r
      ON u.id_rol = r.id_rol
    WHERE u.usuario = ?
    `,
    [usuario]
  );

  return usuarios[0] || null;
};

module.exports = {
  buscarUsuarioPorNombre
};
