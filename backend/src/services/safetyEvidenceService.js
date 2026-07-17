const fs = require('fs');
const path = require('path');

const carpetaSafety = path.join(
  __dirname,
  '..',
  'uploads',
  'safety'
);

const obtenerEvidencia = (nombreArchivo) => {
  if (
    nombreArchivo !== path.basename(nombreArchivo) ||
    !/^safety-\d+-\d+\.(jpg|png|webp)$/.test(nombreArchivo)
  ) {
    return {
      error: {
        status: 400,
        mensaje: 'Nombre de evidencia inválido'
      }
    };
  }

  const rutaArchivo = path.join(carpetaSafety, nombreArchivo);

  if (!fs.existsSync(rutaArchivo)) {
    return {
      error: {
        status: 404,
        mensaje: 'Evidencia Safety no encontrada'
      }
    };
  }

  return { rutaArchivo };
};

module.exports = { obtenerEvidencia };
