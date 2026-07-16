const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const { slamRequestDto } = require('../dto/requestDtos');
const ExcelJS = require('exceljs');

/**
 * Elimina una fotografía física del servidor.
 * Se utiliza cuando:
 * - falla una creación después de subir archivo
 * - se reemplaza una fotografía
 * - se elimina una práctica
 */
const eliminarArchivoFisico = (rutaFoto) => {
  try {
    if (!rutaFoto) {
      return;
    }

    const rutaRelativa = rutaFoto.replace(
      /^\/uploads\//,
      ''
    );

    const rutaCompleta = path.join(
      __dirname,
      '..',
      'uploads',
      rutaRelativa
    );

    if (fs.existsSync(rutaCompleta)) {
      fs.unlinkSync(rutaCompleta);
    }

  } catch (error) {
    console.error(
      'Error al eliminar fotografía física:',
      error
    );
  }
};


/**
 * POST /api/slam
 *
 * Crear nueva práctica SLAM.
 * La fotografía es obligatoria.
 */
const crearSlam = async (req, res) => {
  try {
    const {
      stop,
      look,
      assess,
      manage
    } = slamRequestDto(req.body);

    // Fotografía obligatoria
    if (!req.file) {
      return res.status(400).json({
        mensaje: 'La fotografía es obligatoria'
      });
    }

    // Validar observaciones
    if (
      !stop?.trim() ||
      !look?.trim() ||
      !assess?.trim() ||
      !manage?.trim()
    ) {
      eliminarArchivoFisico(
        `/uploads/slam/${req.file.filename}`
      );

      return res.status(400).json({
        mensaje:
          'STOP, LOOK, ASSESS y MANAGE son obligatorios'
      });
    }

    // Usuario obtenido automáticamente del JWT
    const reportadoPor =
      req.usuario.id_usuario;

    const rutaFoto =
      `/uploads/slam/${req.file.filename}`;

    const nombreFoto =
      req.file.originalname;

    const tipoFoto =
      req.file.mimetype;

    const [resultado] = await db.query(
      `
      INSERT INTO slam_reportes (
        stop,
        look,
        assess,
        manage,
        ruta_foto,
        nombre_foto,
        tipo_foto,
        reportado_por
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        stop.trim(),
        look.trim(),
        assess.trim(),
        manage.trim(),
        rutaFoto,
        nombreFoto,
        tipoFoto,
        reportadoPor
      ]
    );

    return res.status(201).json({
      mensaje:
        'Práctica SLAM registrada correctamente',

      practica: {
        id_slam: resultado.insertId,

        stop: stop.trim(),
        look: look.trim(),
        assess: assess.trim(),
        manage: manage.trim(),

        ruta_foto: rutaFoto,
        nombre_foto: nombreFoto,
        tipo_foto: tipoFoto,

        reportado_por: reportadoPor
      }
    });

  } catch (error) {
    // Si Multer ya guardó una imagen pero MySQL falló,
    // eliminamos la imagen para no dejar basura.
    if (req.file) {
      eliminarArchivoFisico(
        `/uploads/slam/${req.file.filename}`
      );
    }

    console.error(
      'Error al crear práctica SLAM:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error al registrar la práctica SLAM'
    });
  }
};


/**
 * GET /api/slam
 *
 * Historial completo SLAM.
 */
const obtenerSlams = async (req, res) => {
  try {
    const [practicas] = await db.query(
      `
      SELECT
        s.id_slam,
        s.stop,
        s.look,
        s.assess,
        s.manage,
        s.ruta_foto,
        s.nombre_foto,
        s.tipo_foto,

        s.reportado_por,
        s.fecha_reporte,

        u.usuario AS nombre_usuario

      FROM slam_reportes s

      INNER JOIN usuarios u
        ON s.reportado_por = u.id_usuario

      ORDER BY s.fecha_reporte DESC
      `
    );

    return res.status(200).json({
      total: practicas.length,
      practicas
    });

  } catch (error) {
    console.error(
      'Error al obtener historial SLAM:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error al obtener el historial SLAM'
    });
  }
};


/**
 * GET /api/slam/contador
 *
 * Contador general de prácticas.
 */
const obtenerContadorSlam = async (req, res) => {
  try {
    const [resultado] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM slam_reportes
      `
    );

    return res.status(200).json({
      total: Number(resultado[0].total)
    });

  } catch (error) {
    console.error(
      'Error al obtener contador SLAM:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error al obtener el contador de prácticas'
    });
  }
};


/**
 * GET /api/slam/:id
 *
 * Obtener una práctica específica.
 */
const obtenerSlamPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [practicas] = await db.query(
      `
      SELECT
        s.id_slam,

        s.stop,
        s.look,
        s.assess,
        s.manage,

        s.ruta_foto,
        s.nombre_foto,
        s.tipo_foto,

        s.reportado_por,
        s.fecha_reporte,

        u.usuario AS nombre_usuario

      FROM slam_reportes s

      INNER JOIN usuarios u
        ON s.reportado_por = u.id_usuario

      WHERE s.id_slam = ?
      `,
      [id]
    );

    if (practicas.length === 0) {
      return res.status(404).json({
        mensaje:
          'Práctica SLAM no encontrada'
      });
    }

    return res.status(200).json(
      practicas[0]
    );

  } catch (error) {
    console.error(
      'Error al obtener práctica SLAM:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error al obtener la práctica SLAM'
    });
  }
};


/**
 * PUT /api/slam/:id
 *
 * Actualizar una práctica.
 *
 * La fotografía nueva es opcional porque
 * la práctica ya tiene una fotografía previa.
 *
 * Si se manda una nueva foto:
 * - reemplaza la anterior
 * - elimina físicamente la anterior
 */
const actualizarSlam = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      stop,
      look,
      assess,
      manage
    } = slamRequestDto(req.body);

    // Buscar práctica actual
    const [practicas] = await db.query(
      `
      SELECT *
      FROM slam_reportes
      WHERE id_slam = ?
      `,
      [id]
    );

    if (practicas.length === 0) {
      // Si se subió una foto nueva,
      // eliminarla porque el SLAM no existe.
      if (req.file) {
        eliminarArchivoFisico(
          `/uploads/slam/${req.file.filename}`
        );
      }

      return res.status(404).json({
        mensaje:
          'Práctica SLAM no encontrada'
      });
    }

    const practicaActual = practicas[0];

    // Mantener valores existentes si no se envían
    const nuevoStop =
      stop?.trim() ||
      practicaActual.stop;

    const nuevoLook =
      look?.trim() ||
      practicaActual.look;

    const nuevoAssess =
      assess?.trim() ||
      practicaActual.assess;

    const nuevoManage =
      manage?.trim() ||
      practicaActual.manage;

    // Por defecto conservar foto actual
    let nuevaRutaFoto =
      practicaActual.ruta_foto;

    let nuevoNombreFoto =
      practicaActual.nombre_foto;

    let nuevoTipoFoto =
      practicaActual.tipo_foto;

    // Si se subió nueva fotografía
    if (req.file) {
      nuevaRutaFoto =
        `/uploads/slam/${req.file.filename}`;

      nuevoNombreFoto =
        req.file.originalname;

      nuevoTipoFoto =
        req.file.mimetype;
    }

    await db.query(
      `
      UPDATE slam_reportes
      SET
        stop = ?,
        look = ?,
        assess = ?,
        manage = ?,
        ruta_foto = ?,
        nombre_foto = ?,
        tipo_foto = ?
      WHERE id_slam = ?
      `,
      [
        nuevoStop,
        nuevoLook,
        nuevoAssess,
        nuevoManage,
        nuevaRutaFoto,
        nuevoNombreFoto,
        nuevoTipoFoto,
        id
      ]
    );

    // Solo después de actualizar correctamente MySQL,
    // eliminar la fotografía anterior.
    if (
      req.file &&
      practicaActual.ruta_foto
    ) {
      eliminarArchivoFisico(
        practicaActual.ruta_foto
      );
    }

    return res.status(200).json({
      mensaje:
        'Práctica SLAM actualizada correctamente'
    });

  } catch (error) {
    // Si falló MySQL y se había subido
    // una nueva fotografía, eliminarla.
    if (req.file) {
      eliminarArchivoFisico(
        `/uploads/slam/${req.file.filename}`
      );
    }

    console.error(
      'Error al actualizar práctica SLAM:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error al actualizar la práctica SLAM'
    });
  }
};


/**
 * DELETE /api/slam/:id
 *
 * Eliminar práctica y fotografía física.
 */
const eliminarSlam = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar práctica antes de eliminarla
    const [practicas] = await db.query(
      `
      SELECT
        id_slam,
        ruta_foto
      FROM slam_reportes
      WHERE id_slam = ?
      `,
      [id]
    );

    if (practicas.length === 0) {
      return res.status(404).json({
        mensaje:
          'Práctica SLAM no encontrada'
      });
    }

    const practica = practicas[0];

    // Eliminar primero de MySQL
    await db.query(
      `
      DELETE FROM slam_reportes
      WHERE id_slam = ?
      `,
      [id]
    );

    // Después eliminar la foto física
    eliminarArchivoFisico(
      practica.ruta_foto
    );

    return res.status(200).json({
      mensaje:
        'Práctica SLAM eliminada correctamente'
    });

  } catch (error) {
    console.error(
      'Error al eliminar práctica SLAM:',
      error
    );

    return res.status(500).json({
      mensaje:
        'Error al eliminar la práctica SLAM'
    });
  }
};


const exportarExcel = async (req, res) => {
  try {
    const [practicas] = await db.query(`
      SELECT s.id_slam,
        DATE_FORMAT(s.fecha_reporte, '%Y-%m-%d') AS fecha,
        TIME_FORMAT(s.fecha_reporte, '%H:%i:%s') AS hora,
        s.stop, s.look, s.assess, s.manage,
        u.usuario AS reportado_por
      FROM slam_reportes s
      INNER JOIN usuarios u ON s.reportado_por = u.id_usuario
      ORDER BY s.fecha_reporte DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('SLAM');
    worksheet.columns = [
      { header: 'ID', key: 'id_slam', width: 10 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Hora', key: 'hora', width: 12 },
      { header: 'STOP', key: 'stop', width: 35 },
      { header: 'LOOK', key: 'look', width: 35 },
      { header: 'ASSESS', key: 'assess', width: 35 },
      { header: 'MANAGE', key: 'manage', width: 35 },
      { header: 'Reportado por', key: 'reportado_por', width: 25 }
    ];
    practicas.forEach((practica) => worksheet.addRow(practica));
    worksheet.getRow(1).font = { bold: true };
    worksheet.autoFilter = { from: 'A1', to: 'H1' };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=slam.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar SLAM:', error);
    if (!res.headersSent) {
      return res.status(500).json({ mensaje: 'Error interno al exportar el archivo Excel' });
    }
  }
};

module.exports = {
  crearSlam,
  obtenerSlams,
  obtenerContadorSlam,
  exportarExcel,
  obtenerSlamPorId,
  actualizarSlam,
  eliminarSlam
};
