const multer = require('multer');
const { uploadSafety } = require('./uploadsSafetyMiddleware');

const cargarFotografia = (req, res, next) => {
  uploadSafety.single('foto')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const mensaje = error.code === 'LIMIT_FILE_SIZE'
        ? 'La fotografía no puede superar 5 MB'
        : 'No se pudo procesar la fotografía';
      return res.status(400).json({ mensaje });
    }
    return res.status(400).json({ mensaje: error.message });
  });
};

module.exports = cargarFotografia;
