const safetyEvidenceService = require('../services/safetyEvidenceService');

const obtenerEvidencia = (req, res) => {
  const resultado = safetyEvidenceService.obtenerEvidencia(
    req.params.nombre_archivo
  );

  if (resultado.error) {
    return res
      .status(resultado.error.status)
      .json({ mensaje: resultado.error.mensaje });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return res.sendFile(resultado.rutaArchivo);
};

module.exports = { obtenerEvidencia };
