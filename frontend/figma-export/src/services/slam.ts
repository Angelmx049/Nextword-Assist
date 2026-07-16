import { apiRequest } from './api';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export interface SlamRecord {
  id: number;
  fecha: string;
  hora: string;
  nombre: string;
  stop: string;
  look: string;
  assess: string;
  manage: string;
  archivo: string;
  archivoUrl: string;
  archivoTipo: string;
}

export interface SlamInput {
  stop: string;
  look: string;
  assess: string;
  manage: string;
  foto?: File | null;
}

interface ApiSlamRecord {
  id_slam: number;
  stop: string;
  look: string;
  assess: string;
  manage: string;
  ruta_foto: string;
  nombre_foto: string;
  tipo_foto: string;
  reportado_por: number;
  fecha_reporte: string;
  nombre_usuario: string;
}

export function validateSlamImage(file: File | null | undefined, required: boolean): void {
  if (!file) {
    if (required) throw new TypeError('La fotografía es obligatoria');
    return;
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
    throw new TypeError('Solo se permiten fotografías JPEG, PNG o WEBP');
  }
  if (file.size > MAX_IMAGE_SIZE) throw new TypeError('La fotografía no debe superar 5 MB');
}

export function resolveSlamImageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.startsWith('/') ? path : `/${path}`, `${API_BASE_URL}/`).toString();
}

function splitDateTime(value: string): { fecha: string; hora: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { fecha: String(value).slice(0, 10), hora: String(value).slice(11, 16) };
  const pad = (part: number) => String(part).padStart(2, '0');
  return {
    fecha: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    hora: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function toRecord(record: ApiSlamRecord): SlamRecord {
  if (!Number.isInteger(record.id_slam)) throw new TypeError('El servidor devolvió un identificador SLAM inválido');
  return {
    id: record.id_slam,
    ...splitDateTime(record.fecha_reporte),
    nombre: record.nombre_usuario,
    stop: record.stop,
    look: record.look,
    assess: record.assess,
    manage: record.manage,
    archivo: record.nombre_foto,
    archivoUrl: record.ruta_foto ? resolveSlamImageUrl(record.ruta_foto) : '',
    archivoTipo: record.tipo_foto,
  };
}

function toFormData(input: SlamInput, imageRequired: boolean): FormData {
  validateSlamImage(input.foto, imageRequired);
  const formData = new FormData();
  formData.append('stop', input.stop.trim());
  formData.append('look', input.look.trim());
  formData.append('assess', input.assess.trim());
  formData.append('manage', input.manage.trim());
  if (input.foto) formData.append('foto', input.foto);
  return formData;
}

export async function listSlam(): Promise<SlamRecord[]> {
  const response = await apiRequest<{ practicas: ApiSlamRecord[] }>('/api/slam');
  return response.practicas.map(toRecord);
}

export async function getSlam(id: number): Promise<SlamRecord> {
  return toRecord(await apiRequest<ApiSlamRecord>(`/api/slam/${id}`));
}

export const createSlam = (input: SlamInput) =>
  apiRequest('/api/slam', { method: 'POST', body: toFormData(input, true) });

export const updateSlam = (id: number, input: SlamInput) =>
  apiRequest(`/api/slam/${id}`, { method: 'PUT', body: toFormData(input, false) });

export const deleteSlam = (id: number) =>
  apiRequest(`/api/slam/${id}`, { method: 'DELETE' });

export const getSlamCount = async (): Promise<number> =>
  (await apiRequest<{ total: number }>('/api/slam/contador')).total;

export const exportSlam = () =>
  apiRequest<Blob>('/api/slam/exportar/excel', { responseType: 'blob' });
