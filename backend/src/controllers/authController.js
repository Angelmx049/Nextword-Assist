const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authLoginRequestDto } = require('../dto/requestDtos');

const login = async (req, res) => {
  try {
    const { usuario, password } = authLoginRequestDto(req.body);

    if (!usuario || !password) {
      return res.status(400).json({
        mensaje: 'Usuario y contraseña son obligatorios'
      });
    }

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

    if (usuarios.length === 0) {
      return res.status(401).json({
        mensaje: 'Credenciales incorrectas'
      });
    }

    const usuarioEncontrado = usuarios[0];

    const passwordCorrecta = await bcrypt.compare(
      password,
      usuarioEncontrado.password
    );

    if (!passwordCorrecta) {
      return res.status(401).json({
        mensaje: 'Credenciales incorrectas'
      });
    }

    const token = jwt.sign(
      {
        id_usuario: usuarioEncontrado.id_usuario,
        usuario: usuarioEncontrado.usuario,
        id_rol: usuarioEncontrado.id_rol,
        rol: usuarioEncontrado.nombre_rol
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '8h'
      }
    );

    return res.status(200).json({
      mensaje: 'Inicio de sesión correcto',
      token,
      usuario: {
        id_usuario: usuarioEncontrado.id_usuario,
        usuario: usuarioEncontrado.usuario,
        id_rol: usuarioEncontrado.id_rol,
        rol: usuarioEncontrado.nombre_rol
      }
    });

  } catch (error) {
    console.error('Error en login:', error);

    return res.status(500).json({
      mensaje: 'Error interno del servidor'
    });
  }
};

module.exports = {
  login
};
