import { clearSession, getToken } from './session';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: HeadersInit;
  auth?: boolean;
  responseType?: 'json' | 'blob';
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 400: return 'Los datos enviados no son válidos';
    case 401: return 'La sesión no está autorizada';
    case 403: return 'No tienes permisos para realizar esta acción';
    case 404: return 'El recurso solicitado no fue encontrado';
    default: return status >= 500 ? 'Ocurrió un error interno del servidor' : 'No fue posible completar la solicitud';
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, headers: customHeaders, responseType = 'json' } = options;
  const headers = new Headers(customHeaders);
  const token = auth ? getToken() : null;

  if (token) headers.set('Authorization', `Bearer ${token}`);

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData) {
    requestBody = body;
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: requestBody });
  } catch {
    throw new ApiError(0, 'No fue posible conectar con el servidor');
  }

  if (response.ok && responseType === 'blob') {
    return await response.blob() as T;
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const backendMessage = data && typeof data === 'object' && 'mensaje' in data
      ? String((data as { mensaje: unknown }).mensaje)
      : null;

    if (response.status === 401 && auth) {
      clearSession();
      window.dispatchEvent(new Event('assist:session-expired'));
    }

    const safeMessage = response.status >= 500
      ? defaultMessage(response.status)
      : backendMessage || defaultMessage(response.status);

    throw new ApiError(response.status, safeMessage, data);
  }

  return data as T;
}

