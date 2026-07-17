const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const slamModel = require('../models/slamModel');

const rutaPublicaArchivo = (archivo) => `/uploads/slam/${archivo.filename}`;

const eliminarArchivoFisico = (rutaFoto) => {
  try {
    if (!rutaFoto) return;
    const rutaRelativa = rutaFoto.replace(/^\/uploads\//, '');
    const rutaCompleta = path.join(__dirname, '..', 'uploads', rutaRelativa);
    if (fs.existsSync(rutaCompleta)) fs.unlinkSync(rutaCompleta);
  } catch (error) {
    console.error('Error al eliminar fotografía física:', error);
  }
};

const crear = async (datos, archivo, reportadoPor) => {
  if (!archivo) return { error: { status: 400, mensaje: 'La fotografía es obligatoria' } };
  const rutaFoto = rutaPublicaArchivo(archivo);
  if (!datos.stop?.trim() || !datos.look?.trim() || !datos.assess?.trim() || !datos.manage?.trim()) {
    eliminarArchivoFisico(rutaFoto);
    return {
      error: { status: 400, mensaje: 'STOP, LOOK, ASSESS y MANAGE son obligatorios' }
    };
  }

  const practica = {
    stop: datos.stop.trim(),
    look: datos.look.trim(),
    assess: datos.assess.trim(),
    manage: datos.manage.trim(),
    ruta_foto: rutaFoto,
    nombre_foto: archivo.originalname,
    tipo_foto: archivo.mimetype,
    reportado_por: reportadoPor
  };
  try {
    practica.id_slam = await slamModel.crear(practica);
    return { practica };
  } catch (error) {
    eliminarArchivoFisico(rutaFoto);
    throw error;
  }
};

const listar = () => slamModel.listar();
const contar = () => slamModel.contar();
const obtenerPorId = (id) => slamModel.obtenerPorId(id);

const actualizar = async (id, datos, archivo) => {
  const rutaNueva = archivo ? rutaPublicaArchivo(archivo) : null;
  try {
    const actual = await slamModel.obtenerRegistro(id);
    if (!actual) {
      if (rutaNueva) eliminarArchivoFisico(rutaNueva);
      return { error: { status: 404, mensaje: 'Práctica SLAM no encontrada' } };
    }

    await slamModel.actualizar(id, {
      stop: datos.stop?.trim() || actual.stop,
      look: datos.look?.trim() || actual.look,
      assess: datos.assess?.trim() || actual.assess,
      manage: datos.manage?.trim() || actual.manage,
      ruta_foto: rutaNueva || actual.ruta_foto,
      nombre_foto: archivo ? archivo.originalname : actual.nombre_foto,
      tipo_foto: archivo ? archivo.mimetype : actual.tipo_foto
    });
    if (archivo && actual.ruta_foto) eliminarArchivoFisico(actual.ruta_foto);
    return {};
  } catch (error) {
    if (rutaNueva) eliminarArchivoFisico(rutaNueva);
    throw error;
  }
};

const eliminar = async (id) => {
  const practica = await slamModel.obtenerRutaFoto(id);
  if (!practica) {
    return { error: { status: 404, mensaje: 'Práctica SLAM no encontrada' } };
  }
  await slamModel.eliminar(id);
  eliminarArchivoFisico(practica.ruta_foto);
  return {};
};

const exportar = async () => {
  const practicas = await slamModel.listarParaExportar();
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
  return workbook;
};

module.exports = { crear, listar, contar, obtenerPorId, actualizar, eliminar, exportar };
