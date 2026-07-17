const obtenerPerfil = (req, res) => {
  res.json({
    mensaje: 'Acceso autorizado',
    usuario: req.usuario
  });
};

const obtenerAdministrador = (req, res) => {
  res.json({
    mensaje: 'Ruta exclusiva para Administrador',
    usuario: req.usuario
  });
};

const obtenerSupervisor = (req, res) => {
  res.json({
    mensaje: 'Ruta permitida para Administrador y Supervisor',
    usuario: req.usuario
  });
};

module.exports = {
  obtenerPerfil,
  obtenerAdministrador,
  obtenerSupervisor
};
