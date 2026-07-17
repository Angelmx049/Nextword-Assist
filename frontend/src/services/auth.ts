import { apiRequest } from './api';
import {
  clearSession,
  getCurrentSession,
  saveSession,
  type AuthSession,
  type AuthUser
} from './session';

interface LoginResponse {
  mensaje: string;
  token: string;
  usuario: AuthUser;
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const response = await apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: {
      usuario: username.trim(),
      password
    }
  });

  const session = {
    token: response.token,
    usuario: response.usuario
  };
  saveSession(session);
  return session;
}

export function logout(): void {
  clearSession();
}

export function getSession(): AuthSession | null {
  return getCurrentSession();
}
