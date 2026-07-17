const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authModel = require('../models/authModel');

const autenticar = async (usuario, password) => {
  const usuarioEncontrado = await authModel.buscarUsuarioPorNombre(usuario);

  if (!usuarioEncontrado) {
    return null;
  }

  const passwordCorrecta = await bcrypt.compare(
    password,
    usuarioEncontrado.password
  );

  if (!passwordCorrecta) {
    return null;
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

  return {
    token,
    usuario: {
      id_usuario: usuarioEncontrado.id_usuario,
      usuario: usuarioEncontrado.usuario,
      id_rol: usuarioEncontrado.id_rol,
      rol: usuarioEncontrado.nombre_rol
    }
  };
};

module.exports = {
  autenticar
};
