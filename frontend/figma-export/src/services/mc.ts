import { apiRequest } from './api';

export interface MCRecord {
  id: number;
  fecha: string;
  hora: string;
  evento: string;
  operador: string;
  observaciones: string;
}

export interface MCInput {
  fecha: string;
  hora: string;
  evento: string;
  operador: string;
  observaciones: string;
}

export interface MCFilters {
  operador?: string;
  fecha?: string;
}

interface ApiMCRecord {
  id_mc: number;
  fecha: string;
  hora: string;
  mc: string;
  operador: string;
  observaciones: string;
}

interface MCListResponse { registros: ApiMCRecord[] }

function toRecord(record: ApiMCRecord): MCRecord {
  if (!Number.isInteger(record.id_mc)) throw new TypeError('El servidor devolvió un identificador MC inválido');
  return {
    id: record.id_mc,
    fecha: record.fecha,
    hora: record.hora,
    evento: record.mc,
    operador: record.operador,
    observaciones: record.observaciones,
  };
}

function toPayload(input: MCInput) {
  return {
    fecha: input.fecha,
    hora: input.hora,
    mc: input.evento,
    operador: input.operador,
    observaciones: input.observaciones,
  };
}

function query(filters: MCFilters): string {
  const params = new URLSearchParams();
  if (filters.operador?.trim()) params.set('operador', filters.operador.trim());
  if (filters.fecha) params.set('fecha', filters.fecha);
  const value = params.toString();
  return value ? `?${value}` : '';
}

export async function listMC(filters: MCFilters = {}): Promise<MCRecord[]> {
  const response = await apiRequest<MCListResponse>(`/api/mc${query(filters)}`);
  return response.registros.map(toRecord);
}

export function createMC(input: MCInput): Promise<unknown> {
  return apiRequest('/api/mc', { method: 'POST', body: toPayload(input) });
}

export function updateMC(id: number, input: MCInput): Promise<unknown> {
  return apiRequest(`/api/mc/${id}`, { method: 'PUT', body: toPayload(input) });
}

export function deleteMC(id: number): Promise<unknown> {
  return apiRequest(`/api/mc/${id}`, { method: 'DELETE' });
}

export function exportMC(filters: MCFilters = {}): Promise<Blob> {
  return apiRequest<Blob>(`/api/mc/exportar${query(filters)}`, { responseType: 'blob' });
}
