const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        mensaje: 'Token no proporcionado'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        mensaje: 'Formato de token inválido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      mensaje: 'Token inválido o expirado'
    });
  }
};

const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    const rolUsuario = req.usuario?.rol;

    if (!rolUsuario) {
      return res.status(401).json({
        mensaje:
          'No se pudo identificar el rol del usuario'
      });
    }

    if (
      !rolesPermitidos.includes(rolUsuario)
    ) {
      return res.status(403).json({
        mensaje:
          'No tienes permisos para realizar esta acción'
      });
    }

    next();
  };
};

module.exports = {
  verificarToken,
  verificarRol
};