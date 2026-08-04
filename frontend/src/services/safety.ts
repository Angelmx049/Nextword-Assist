import { apiRequest } from './api';

export type SafetyRisk = 'Bajo' | 'Medio' | 'Alto' | 'Critico';

export interface SafetyArea {
  id_area: number;
  nombre_area: string;
  descripcion: string | null;
  total_hallazgos: number;
}

export interface SafetyFinding {
  id_hallazgo: number;
  id_area: number;
  nombre_area: string;
  descripcion: string;
  nivel_riesgo: SafetyRisk;
  ruta_foto: string;
  fecha_hallazgo: string;
  reportado_por: number;
  nombre_usuario: string;
}

export interface SafetyFilters {
  fecha_desde?: string;
  fecha_hasta?: string;
  nivel_riesgo?: SafetyRisk;
  busqueda?: string;
}

export interface SafetyPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_previous_page: boolean;
  has_next_page: boolean;
}

export interface SafetyHistoryResponse {
  hallazgos: SafetyFinding[];
  paginacion: SafetyPagination;
}

function query(filters: SafetyFilters, page?: number, limit?: number): string {
  const params = new URLSearchParams();
  if (filters.fecha_desde) params.set('fecha_desde', filters.fecha_desde);
  if (filters.fecha_hasta) params.set('fecha_hasta', filters.fecha_hasta);
  if (filters.nivel_riesgo) params.set('nivel_riesgo', filters.nivel_riesgo);
  if (filters.busqueda?.trim()) params.set('busqueda', filters.busqueda.trim());
  if (page !== undefined) params.set('page', String(page));
  if (limit !== undefined) params.set('limit', String(limit));
  const value = params.toString();
  return value ? `?${value}` : '';
}

export const listSafetyAreas = async (): Promise<SafetyArea[]> => {
  const response = await apiRequest<{ total: number; areas: SafetyArea[] }>('/api/safety/areas');
  return response.areas;
};

export const listRecentSafetyFindings = async (areaId: number): Promise<SafetyFinding[]> => {
  const response = await apiRequest<{ total: number; hallazgos: SafetyFinding[] }>(
    `/api/safety/areas/${areaId}/recientes`,
  );
  return response.hallazgos;
};

export const listSafetyHistory = (areaId: number, filters: SafetyFilters, page: number, limit: number) =>
  apiRequest<SafetyHistoryResponse>(`/api/safety/areas/${areaId}/hallazgos${query(filters, page, limit)}`);

export const getSafetyFinding = (findingId: number) =>
  apiRequest<SafetyFinding>(`/api/safety/hallazgos/${findingId}`);

export function createSafetyFinding(areaId: number, descripcion: string, risk: SafetyRisk, foto: File) {
  const formData = new FormData();
  formData.append('id_area', String(areaId));
  formData.append('descripcion', descripcion.trim());
  formData.append('nivel_riesgo', risk);
  formData.append('foto', foto);
  return apiRequest<{ mensaje: string; hallazgo: SafetyFinding }>('/api/safety/hallazgos', {
    method: 'POST',
    body: formData,
  });
}

export const loadSafetyEvidence = (path: string, signal?: AbortSignal) =>
  apiRequest<Blob>(path, { responseType: 'blob', signal });

export const exportSafetyHistory = (areaId: number, filters: SafetyFilters) =>
  apiRequest<Blob>(`/api/safety/areas/${areaId}/hallazgos/exportar/excel${query(filters)}`, {
    responseType: 'blob',
  });
