import { apiRequest } from './api';

export type NotificationType =
  | 'VENCIMIENTO_30'
  | 'VENCIMIENTO_20'
  | 'VENCIMIENTO_10'
  | 'TAREA_ENTREGADA'
  | 'TAREA_REENTREGADA';

export interface AssistNotification {
  id_notificacion: number;
  id_tarea: number;
  tipo: NotificationType;
  titulo_tarea: string;
  mensaje: string;
  fecha_programada: string;
  fecha_vencimiento: string;
  leida: boolean;
  fecha_lectura: string | null;
  fecha_creacion: string;
  estado: 'Disponible' | 'Leida';
}

export interface NotificationListResponse {
  total_no_leidas: number;
  notificaciones: AssistNotification[];
}

export const getNotificationSummary = () =>
  apiRequest<{ total_no_leidas: number }>('/api/notificaciones/resumen');

export const listNotifications = () =>
  apiRequest<NotificationListResponse>('/api/notificaciones');

export const markNotificationRead = (id: number) =>
  apiRequest<{ mensaje: string }>(`/api/notificaciones/${id}/leida`, { method: 'PATCH' });

export const markAllNotificationsRead = () =>
  apiRequest<{ mensaje: string; total_actualizadas: number }>('/api/notificaciones/leer-todas', { method: 'PATCH' });

