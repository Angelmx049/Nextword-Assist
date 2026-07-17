import { apiRequest } from './api';

export type ManejoApi = 'Excelente' | 'Bueno' | 'Regular' | 'Necesita mejorar';
export type EvaluacionView = 'Excelente' | 'Bueno' | 'Regular' | 'Necesita Mejora';

export interface Courier { id: number; nombre: string }

export interface GembaRecord {
  id: number;
  idCourier: number;
  courier: string;
  fecha: string;
  hora: string;
  numeroEconomico: string;
  numeroParadas: number;
  tiempoTotal: string;
  evaluacion: EvaluacionView;
  observaciones: string;
}

export interface GembaInput {
  idCourier: number;
  fecha: string;
  hora: string;
  numeroEconomico: string;
  numeroParadas: number;
  tiempoTotal: string;
  evaluacion: EvaluacionView;
  observaciones: string;
}

export interface GembaFilters { idCourier?: number; fecha?: string; evaluacion?: EvaluacionView }

interface ApiGembaRecord {
  id_gemba: number;
  id_courier: number;
  courier: string;
  fecha: string;
  hora: string;
  numero_eco: string;
  cantidad_paradas: number;
  tiempo_horas: number;
  tiempo_minutos: number;
  manejo: ManejoApi;
  observaciones: string | null;
}

const toApiManejo = (value: EvaluacionView): ManejoApi =>
  value === 'Necesita Mejora' ? 'Necesita mejorar' : value;

const toViewManejo = (value: ManejoApi): EvaluacionView =>
  value === 'Necesita mejorar' ? 'Necesita Mejora' : value;

export function splitTiempoTotal(value: string): { tiempo_horas: number; tiempo_minutos: number } {
  const match = /^(0|[1-9]\d*):([0-5]\d)$/.exec(value.trim());
  if (!match) throw new TypeError('El tiempo total debe usar el formato H:MM y los minutos deben estar entre 00 y 59');
  const tiempo_horas = Number(match[1]);
  const tiempo_minutos = Number(match[2]);
  if (tiempo_horas === 0 && tiempo_minutos === 0) throw new TypeError('El tiempo total debe ser mayor a 0 minutos');
  return { tiempo_horas, tiempo_minutos };
}

function toRecord(record: ApiGembaRecord): GembaRecord {
  if (!Number.isInteger(record.id_gemba) || !Number.isInteger(record.id_courier)) {
    throw new TypeError('El servidor devolvió un identificador Gemba inválido');
  }
  if (!Number.isInteger(record.tiempo_horas) || record.tiempo_horas < 0 ||
      !Number.isInteger(record.tiempo_minutos) || record.tiempo_minutos < 0 || record.tiempo_minutos > 59) {
    throw new TypeError('El servidor devolvió un tiempo Gemba inválido');
  }
  return {
    id: record.id_gemba,
    idCourier: record.id_courier,
    courier: record.courier,
    fecha: String(record.fecha).slice(0, 10),
    hora: String(record.hora).slice(0, 5),
    numeroEconomico: record.numero_eco,
    numeroParadas: record.cantidad_paradas,
    tiempoTotal: `${record.tiempo_horas}:${String(record.tiempo_minutos).padStart(2, '0')}`,
    evaluacion: toViewManejo(record.manejo),
    observaciones: record.observaciones ?? '',
  };
}

function toPayload(input: GembaInput) {
  return {
    id_courier: input.idCourier,
    fecha: input.fecha,
    hora: input.hora,
    numero_eco: input.numeroEconomico,
    cantidad_paradas: input.numeroParadas,
    ...splitTiempoTotal(input.tiempoTotal),
    manejo: toApiManejo(input.evaluacion),
    observaciones: input.observaciones,
  };
}

function query(filters: GembaFilters): string {
  const params = new URLSearchParams();
  if (filters.idCourier) params.set('id_courier', String(filters.idCourier));
  if (filters.fecha) params.set('fecha', filters.fecha);
  if (filters.evaluacion) params.set('manejo', toApiManejo(filters.evaluacion));
  const value = params.toString();
  return value ? `?${value}` : '';
}

export async function listGemba(filters: GembaFilters = {}): Promise<GembaRecord[]> {
  const response = await apiRequest<{ registros: ApiGembaRecord[] }>(`/api/gemba${query(filters)}`);
  return response.registros.map(toRecord);
}

export async function listCouriers(): Promise<Courier[]> {
  const response = await apiRequest<{ couriers: Array<{ id_courier: number; nombre: string }> }>('/api/gemba/couriers');
  return response.couriers.map(courier => ({ id: courier.id_courier, nombre: courier.nombre }));
}

export const createGemba = (input: GembaInput) =>
  apiRequest('/api/gemba', { method: 'POST', body: toPayload(input) });

export const updateGemba = (id: number, input: GembaInput) =>
  apiRequest(`/api/gemba/${id}`, { method: 'PUT', body: toPayload(input) });

export const deleteGemba = (id: number) =>
  apiRequest(`/api/gemba/${id}`, { method: 'DELETE' });

export const exportGemba = (filters: GembaFilters = {}) =>
  apiRequest<Blob>(`/api/gemba/exportar/excel${query(filters)}`, { responseType: 'blob' });
