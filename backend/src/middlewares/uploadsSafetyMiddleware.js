const multer = require('multer');
const path = require('path');
const fs = require('fs');

const carpetaSafety = path.join(
  __dirname,
  '..',
  'uploads',
  'safety'
);

if (!fs.existsSync(carpetaSafety)) {
  fs.mkdirSync(carpetaSafety, {
    recursive: true
  });
}

const extensionesPorMime = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, carpetaSafety);
  },

  filename: function (req, file, cb) {
    const nombreUnico =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1E9);

    cb(
      null,
      `safety-${nombreUnico}${extensionesPorMime[file.mimetype]}`
    );
  }
});

const fileFilter = (req, file, cb) => {
  if (extensionesPorMime[file.mimetype]) {
    return cb(null, true);
  }

  return cb(
    new Error(
      'Solo se permiten fotografías JPG, JPEG, PNG o WEBP'
    ),
    false
  );
};

const uploadSafety = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const detectarTipoReal = (buffer) => {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF
  ) {
    return 'image/jpeg';
  }

  const firmaPng = [
    0x89, 0x50, 0x4E, 0x47,
    0x0D, 0x0A, 0x1A, 0x0A
  ];

  if (
    buffer.length >= firmaPng.length &&
    firmaPng.every((byte, indice) => buffer[indice] === byte)
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
};

const validarFirmaImagen = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const archivo = await fs.promises.open(req.file.path, 'r');
    const buffer = Buffer.alloc(12);

    try {
      await archivo.read(buffer, 0, buffer.length, 0);
    } finally {
      await archivo.close();
    }

    const tipoReal = detectarTipoReal(buffer);

    if (!tipoReal || tipoReal !== req.file.mimetype) {
      await fs.promises.unlink(req.file.path);
      req.file = undefined;

      return res.status(400).json({
        mensaje:
          'El contenido del archivo no corresponde a una imagen JPEG, PNG o WEBP válida'
      });
    }

    return next();
  } catch (error) {
    if (req.file?.path) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      req.file = undefined;
    }

    console.error('Error al validar fotografía Safety:', error);

    return res.status(400).json({
      mensaje: 'No se pudo validar la fotografía'
    });
  }
};

module.exports = {
  uploadSafety,
  validarFirmaImagen
};
