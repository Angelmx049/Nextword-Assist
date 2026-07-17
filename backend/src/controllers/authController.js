const { authLoginRequestDto } = require('../dto/requestDtos');
const authService = require('../services/authService');

const login = async (req, res) => {
  try {
    const { usuario, password } = authLoginRequestDto(req.body);

    if (!usuario || !password) {
      return res.status(400).json({
        mensaje: 'Usuario y contraseña son obligatorios'
      });
    }

    const autenticacion = await authService.autenticar(usuario, password);

    if (!autenticacion) {
      return res.status(401).json({
        mensaje: 'Credenciales incorrectas'
      });
    }

    return res.status(200).json({
      mensaje: 'Inicio de sesión correcto',
      token: autenticacion.token,
      usuario: autenticacion.usuario
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
