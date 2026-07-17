export type AuthRole = 'ADMINISTRADOR' | 'SUPERVISOR';

export interface AuthUser {
  id_usuario: number;
  usuario: string;
  id_rol: number;
  rol: AuthRole;
}

export interface AuthSession {
  token: string;
  usuario: AuthUser;
}

const SESSION_KEY = 'assist.auth.session';
const VALID_ROLES: AuthRole[] = ['ADMINISTRADOR', 'SUPERVISOR'];

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<AuthUser>;
  return (
    typeof user.id_usuario === 'number' &&
    typeof user.usuario === 'string' &&
    typeof user.id_rol === 'number' &&
    VALID_ROLES.includes(user.rol as AuthRole)
  );
}

export function saveSession(session: AuthSession): void {
  if (!session.token || !isAuthUser(session.usuario)) {
    throw new Error('La sesión recibida no es válida');
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getCurrentSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (typeof parsed.token !== 'string' || !parsed.token || !isAuthUser(parsed.usuario)) {
      clearSession();
      return null;
    }
    return parsed as AuthSession;
  } catch {
    clearSession();
    return null;
  }
}

export function getToken(): string | null {
  return getCurrentSession()?.token ?? null;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
