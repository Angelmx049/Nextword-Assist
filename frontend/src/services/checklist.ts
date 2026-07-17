import { apiRequest } from './api';

export type ChecklistStatus = 'pendiente' | 'en_proceso' | 'entregada' | 'rechazada' | 'completada' | 'vencida' | 'cancelada';
export type ChecklistApiStatus = 'Pendiente' | 'En proceso' | 'Entregada' | 'Rechazada' | 'Completada' | 'Vencida' | 'Cancelada';
export type ChecklistPriority = 'baja' | 'media' | 'alta';
export type ChecklistApiPriority = 'Baja' | 'Media' | 'Alta';

export interface ChecklistDelivery {
  comentario: string;
  observaciones: string;
  fecha: string;
}

export interface ChecklistTask {
  id: number;
  titulo: string;
  descripcion: string;
  responsableId: number;
  responsable: string;
  supervisorAsignador: string;
  fechaLimite: string;
  horaLimite: string;
  prioridad: ChecklistPriority;
  observaciones: string;
  estado: ChecklistStatus;
  entrega?: ChecklistDelivery;
  motivoRechazo?: string;
  fechaCreacion: string;
}

export interface ChecklistTaskInput {
  titulo: string;
  descripcion: string;
  responsableId: number;
  fechaLimite: string;
  horaLimite: string;
  prioridad: ChecklistPriority;
}

export interface ChecklistFilters {
  search?: string;
  estado?: ChecklistStatus;
  prioridad?: ChecklistPriority;
  responsableId?: number;
  fecha?: string;
}

export interface ChecklistAdministrator { id: number; usuario: string }

interface ApiChecklistTask {
  id_tarea: number;
  titulo: string;
  descripcion: string | null;
  fecha_asignada: string;
  fecha_vencimiento: string;
  estado: ChecklistApiStatus;
  prioridad: ChecklistApiPriority;
  creada_por: number;
  asignada_a: number;
  creado_por_usuario: string;
  responsable_usuario: string;
  fecha_creacion: string;
}

interface ApiDelivery {
  comentario_entrega: string | null;
  fecha_entrega: string;
  estado_revision: 'Pendiente' | 'Aceptada' | 'Rechazada';
  comentario_revision: string | null;
}

export const STATUS_TO_API: Record<ChecklistStatus, ChecklistApiStatus> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  entregada: 'Entregada',
  rechazada: 'Rechazada',
  completada: 'Completada',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

export const PRIORITY_TO_API: Record<ChecklistPriority, ChecklistApiPriority> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

const STATUS_FROM_API = Object.fromEntries(
  Object.entries(STATUS_TO_API).map(([view, api]) => [api, view]),
) as Record<ChecklistApiStatus, ChecklistStatus>;

const PRIORITY_FROM_API = Object.fromEntries(
  Object.entries(PRIORITY_TO_API).map(([view, api]) => [api, view]),
) as Record<ChecklistApiPriority, ChecklistPriority>;

export function combineDeadline(fechaLimite: string, horaLimite: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaLimite) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaLimite)) {
    throw new TypeError('La fecha y hora límite no son válidas');
  }
  return `${fechaLimite}T${horaLimite}:00`;
}

function splitDeadline(value: string): { fechaLimite: string; horaLimite: string } {
  const normalized = String(value).replace(' ', 'T');
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) throw new TypeError('El servidor devolvió una fecha límite inválida');
    const pad = (part: number) => String(part).padStart(2, '0');
    return {
      fechaLimite: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      horaLimite: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
  }
  return { fechaLimite: normalized.slice(0, 10), horaLimite: normalized.slice(11, 16) };
}

function toTask(task: ApiChecklistTask): ChecklistTask {
  if (!Number.isInteger(task.id_tarea) || !Number.isInteger(task.asignada_a)) {
    throw new TypeError('El servidor devolvió un identificador Checklist inválido');
  }
  const estado = STATUS_FROM_API[task.estado];
  const prioridad = PRIORITY_FROM_API[task.prioridad];
  if (!estado || !prioridad) throw new TypeError('El servidor devolvió un estado o prioridad Checklist inválido');
  return {
    id: task.id_tarea,
    titulo: task.titulo,
    descripcion: task.descripcion ?? '',
    responsableId: task.asignada_a,
    responsable: task.responsable_usuario,
    supervisorAsignador: task.creado_por_usuario,
    ...splitDeadline(task.fecha_vencimiento),
    prioridad,
    observaciones: '',
    estado,
    fechaCreacion: task.fecha_creacion,
  };
}

function toPayload(input: ChecklistTaskInput) {
  return {
    titulo: input.titulo,
    descripcion: input.descripcion,
    asignada_a: input.responsableId,
    fecha_vencimiento: combineDeadline(input.fechaLimite, input.horaLimite),
    prioridad: PRIORITY_TO_API[input.prioridad],
  };
}

function query(filters: ChecklistFilters): string {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('busqueda', filters.search.trim());
  if (filters.estado) params.set('estado', STATUS_TO_API[filters.estado]);
  if (filters.prioridad) params.set('prioridad', PRIORITY_TO_API[filters.prioridad]);
  if (filters.responsableId) params.set('responsable', String(filters.responsableId));
  if (filters.fecha) params.set('fecha', filters.fecha);
  const value = params.toString();
  return value ? `?${value}` : '';
}

export async function listChecklist(filters: ChecklistFilters = {}): Promise<ChecklistTask[]> {
  const response = await apiRequest<{ tareas: ApiChecklistTask[] }>(`/api/checklist${query(filters)}`);
  return response.tareas.map(toTask);
}

export async function listChecklistAdministrators(): Promise<ChecklistAdministrator[]> {
  const response = await apiRequest<{ administradores: Array<{ id_usuario: number; usuario: string }> }>('/api/checklist/administradores');
  return response.administradores.map(item => ({ id: item.id_usuario, usuario: item.usuario }));
}

export const createChecklistTask = (input: ChecklistTaskInput) =>
  apiRequest('/api/checklist', { method: 'POST', body: toPayload(input) });

export const updateChecklistTask = (id: number, input: ChecklistTaskInput) =>
  apiRequest(`/api/checklist/${id}`, { method: 'PUT', body: toPayload(input) });

export const startChecklistTask = (id: number) =>
  apiRequest(`/api/checklist/${id}/iniciar`, { method: 'PATCH' });

export const deliverChecklistTask = (id: number, comentario: string) =>
  apiRequest(`/api/checklist/${id}/entregar`, { method: 'POST', body: { comentario_entrega: comentario } });

export const acceptChecklistTask = (id: number, comentario = '') =>
  apiRequest(`/api/checklist/${id}/aceptar`, { method: 'PATCH', body: { comentario_revision: comentario } });

export const rejectChecklistTask = (id: number, comentario: string) =>
  apiRequest(`/api/checklist/${id}/rechazar`, { method: 'PATCH', body: { comentario_revision: comentario } });

export const cancelChecklistTask = (id: number, comentario = '') =>
  apiRequest(`/api/checklist/${id}/cancelar`, { method: 'PATCH', body: { comentario } });

export async function getChecklistTaskDetails(task: ChecklistTask): Promise<ChecklistTask> {
  const response = await apiRequest<{ entregas: ApiDelivery[] }>(`/api/checklist/${task.id}/entregas`);
  const latest = response.entregas.at(-1);
  if (!latest) return task;
  return {
    ...task,
    entrega: {
      comentario: latest.comentario_entrega ?? '',
      observaciones: '',
      fecha: latest.fecha_entrega,
    },
    motivoRechazo: latest.estado_revision === 'Rechazada' ? latest.comentario_revision ?? undefined : undefined,
  };
}

export const exportChecklist = (filters: ChecklistFilters = {}) =>
  apiRequest<Blob>(`/api/checklist/exportar/excel${query(filters)}`, { responseType: 'blob' });
