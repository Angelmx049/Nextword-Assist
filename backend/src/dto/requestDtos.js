const normalizarTexto = (valor) => {
  return typeof valor === 'string' ? valor.trim() : valor;
};

const authLoginRequestDto = (body = {}) => ({
  usuario: normalizarTexto(body.usuario),
  password: body.password
});

const mcRequestDto = (body = {}) => ({
  fecha: body.fecha,
  hora: body.hora,
  mc: normalizarTexto(body.mc),
  operador: normalizarTexto(body.operador),
  observaciones: normalizarTexto(body.observaciones)
});

const gembaRequestDto = (body = {}) => ({
  id_courier: body.id_courier,
  fecha: body.fecha,
  hora: body.hora,
  numero_eco: normalizarTexto(body.numero_eco),
  cantidad_paradas: body.cantidad_paradas,
  tiempo_horas: body.tiempo_horas,
  tiempo_minutos: body.tiempo_minutos === undefined ? 0 : body.tiempo_minutos,
  manejo: normalizarTexto(body.manejo),
  observaciones: normalizarTexto(body.observaciones)
});

const checklistTaskRequestDto = (body = {}) => ({
  titulo: normalizarTexto(body.titulo),
  descripcion: normalizarTexto(body.descripcion),
  asignada_a: body.asignada_a,
  fecha_vencimiento: body.fecha_vencimiento,
  prioridad: body.prioridad === undefined ? 'Media' : normalizarTexto(body.prioridad)
});

const slamRequestDto = (body = {}) => ({
  stop: normalizarTexto(body.stop),
  look: normalizarTexto(body.look),
  assess: normalizarTexto(body.assess),
  manage: normalizarTexto(body.manage)
});

const safetyFindingRequestDto = (body = {}) => ({
  id_area: body.id_area,
  descripcion: normalizarTexto(body.descripcion),
  nivel_riesgo: normalizarTexto(body.nivel_riesgo)
});

module.exports = {
  authLoginRequestDto,
  mcRequestDto,
  gembaRequestDto,
  checklistTaskRequestDto,
  slamRequestDto,
  safetyFindingRequestDto
};
