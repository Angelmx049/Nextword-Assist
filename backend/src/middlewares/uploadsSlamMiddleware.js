const multer = require('multer');
const path = require('path');
const fs = require('fs');

const carpetaSlam = path.join(
  __dirname,
  '..',
  'uploads',
  'slam'
);

// Crear la carpeta automáticamente si no existe
if (!fs.existsSync(carpetaSlam)) {
  fs.mkdirSync(carpetaSlam, {
    recursive: true
  });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, carpetaSlam);
  },

  filename: function (req, file, cb) {
    const nombreUnico =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1E9);

    const extension =
      path.extname(file.originalname).toLowerCase();

    cb(
      null,
      `slam-${nombreUnico}${extension}`
    );
  }
});

const fileFilter = (req, file, cb) => {
  const tiposPermitidos = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (tiposPermitidos.includes(file.mimetype)) {
    return cb(null, true);
  }

  return cb(
    new Error(
      'Solo se permiten fotografías JPG, JPEG, PNG o WEBP'
    ),
    false
  );
};

const uploadSlam = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = uploadSlam;