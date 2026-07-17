# Auditoría y eliminación de simulaciones del frontend

## 1. Simulaciones encontradas

| Archivo | Componente o función | Hallazgo | Riesgo al retirarlo | Endpoint real | Acción |
|---|---|---|---|---|---|
| `frontend/src/app/components/ChangePasswordModule.tsx` | Cambio de contraseña | Confirmaba éxito sin petición HTTP ni persistencia real. | Bajo: la función no estaba respaldada por backend y quedó fuera de esta versión. | No disponible. | Componente eliminado y ruta retirada. |
| `frontend/src/app/components/Login.tsx` | Recuperación de contraseña | Botón sin operación real. | Bajo: no existía flujo ni endpoint. | No disponible. | Acción ficticia retirada. |
| `frontend/src/app/components/Dashboard.tsx` | Resumen de notificaciones | El cero inicial podía mostrarse como estadística real antes de una respuesta o después de un error. | Medio: podía comunicar una cifra no confirmada. | `GET /api/notificaciones/resumen`. | Estado inicial desconocido; ahora muestra `Sin datos` hasta recibir una respuesta válida. |
| `frontend/src/app/components/NotificationPanel.tsx` | Contador del panel | Mostraba `0 sin leer` durante carga o error. | Bajo. | `GET /api/notificaciones`. | Encabezado condicionado a carga, error o éxito. |
| `frontend/src/app/components/EMCModule.tsx` | Listado MC | El vacío podía mostrarse junto con un error. | Bajo. | `GET /api/mc`. | Se limpia al iniciar la consulta y el vacío sólo aparece tras éxito. |
| `frontend/src/app/components/GembaModule.tsx` | Listado y conteo | Podía mostrar cero o vacío tras error. | Bajo. | `GET /api/gemba`. | Conteo y vacío condicionados a respuesta exitosa. |
| `frontend/src/app/components/ChecklistModule.tsx` | Contadores y listado | Podía presentar cero tareas y estado vacío durante error. | Medio. | `GET /api/checklist`. | Contadores pasan a `Sin datos`; vacío sólo después de éxito. |
| `frontend/src/app/components/SlamModule.tsx` | Conteos e historial | `reports.length` aparentaba cero tras fallo de carga. | Medio. | `GET /api/slam`. | Conteos distinguen carga, error y vacío confirmado. |
| `frontend/src/services/SafetyModuleImpl.tsx` | Áreas, recientes e historial | Podía conservar datos de una consulta anterior o mostrar paginación cero tras error. | Medio. | Endpoints existentes de `/api/safety`. | Se limpian resultados antes de consultar; carga, error, vacío y paginación quedan separados. |

No se clasificaron como simulación los catálogos de estados, riesgos, evaluaciones, pasos SLAM, meses, columnas, rutas o etiquetas. Son constantes válidas de interfaz y contratos existentes.

## 2. Archivos modificados

- `frontend/src/app/App.tsx`
- `frontend/src/app/components/Dashboard.tsx`
- `frontend/src/app/components/Login.tsx`
- `frontend/src/app/components/NotificationPanel.tsx`
- `frontend/src/app/components/EMCModule.tsx`
- `frontend/src/app/components/GembaModule.tsx`
- `frontend/src/app/components/ChecklistModule.tsx`
- `frontend/src/app/components/SlamModule.tsx`
- `frontend/src/services/SafetyModuleImpl.tsx`
- Eliminado: `frontend/src/app/components/ChangePasswordModule.tsx`.

## 3. Simulaciones eliminadas

- Confirmación ficticia de cambio de contraseña.
- Botón inactivo de recuperación de contraseña.
- Ceros y estados vacíos presentados sin una respuesta confirmada del backend.
- Presentación de datos anteriores mientras se cargaba otra consulta Safety.

## 4. Funciones conectadas a endpoints reales

- MC: listado, alta, edición, eliminación y exportación.
- Gemba Ride: couriers, listado, alta, edición, eliminación y exportación.
- Checklist: tareas, administradores, detalle, inicio, entrega, aceptación, rechazo, cancelación y exportación.
- SLAM: listado, alta, edición, eliminación y exportación.
- Safety: áreas, recientes, historial, detalle, evidencia, alta y exportación.
- Notificaciones: resumen, listado, marcar una y marcar todas como leídas.

Todas estas funciones ya usaban `apiRequest()` mediante sus servicios y se conservaron.

## 5. Funciones conservadas pero deshabilitadas o vacías

- Ninguna función prevista quedó simulada o deshabilitada.
- Cambio y recuperación de contraseña fueron retirados porque no están contemplados en esta versión.
- Los listados muestran carga, error o vacío real según corresponda.

## 6. Endpoints faltantes

No falta ningún endpoint para las funciones que permanecen visibles. No se propone endpoint de contraseña porque esa función fue excluida expresamente del alcance de esta versión.

## 7. Riesgos o decisiones técnicas

- El `setTimeout()` de 300 ms en MC se conserva: es un debounce de filtro que termina ejecutando `GET /api/mc`; no genera datos ni simula latencia.
- El `setInterval()` del Dashboard se conserva: actualiza el resumen real de notificaciones cada 60 segundos.
- `localStorage` permanece únicamente en `services/session.ts`, como estaba requerido para la sesión.
- El fallback SVG de `ImageWithFallback` es un indicador visual de error, no información operativa ficticia.
- Las mutaciones locales de notificaciones ocurren sólo después de que el backend confirma la operación.
- No se modificó el backend.

## 8. Resultado de `npm run build`

Correcto. Vite transformó 1,628 módulos y generó el paquete de producción sin errores.

## 9. Resultado de lint

No ejecutado: `frontend/package.json` no define un script `lint`. Tampoco existe un script independiente de typecheck; la validación disponible es la compilación de Vite.

## 10. Confirmación de contratos

No se modificaron autenticación, JWT, React Router salvo la eliminación de la ruta fuera de alcance `/password`, `services/api.ts`, `services/session.ts`, contratos HTTP, DTO, nombres de campos, permisos ni endpoints existentes.

## Anexo: contenido completo de archivos modificados

### `frontend/src/app/App.tsx`

```tsx
import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import EMCModule from './components/EMCModule';
import GembaModule from './components/GembaModule';
import ChecklistModule from './components/ChecklistModule';
import SlamModule from './components/SlamModule';
import SafetyModule from '../services/SafetyModuleImpl';
import { getSession, logout } from '../services/auth';
import type { AuthSession } from '../services/session';

const MODULE_PATHS: Record<string, string> = {
  emc: '/mc',
  gemba: '/gemba-ride',
  checklist: '/checklist',
  slam: '/slam',
  safety: '/safety',
};

function ProtectedRoute({ session }: { session: AuthSession | null }) {
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSession | null>(() => getSession());

  const handleLogin = (authenticatedSession: AuthSession) => {
    setSession(authenticatedSession);
    navigate('/dashboard', { replace: true });
  };

  const handleLogout = () => {
    logout();
    setSession(null);
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const handleExpiredSession = () => {
      logout();
      setSession(null);
      navigate('/login', { replace: true });
    };
    window.addEventListener('assist:session-expired', handleExpiredSession);
    return () => window.removeEventListener('assist:session-expired', handleExpiredSession);
  }, [navigate]);

  const handleModuleSelect = (module: string) => {
    navigate(MODULE_PATHS[module] || '/dashboard');
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const username = session?.usuario.usuario ?? '';
  const role = session?.usuario.rol ?? '';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
      <Route
        path="/login"
        element={session ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />}
      />

      <Route element={<ProtectedRoute session={session} />}>
        <Route
          path="/dashboard"
          element={
            <Dashboard
              username={username}
              role={role}
              onModuleSelect={handleModuleSelect}
              onLogout={handleLogout}
            />
          }
        />
        <Route path="/mc" element={<EMCModule onBack={handleBackToDashboard} username={username} />} />
        <Route path="/gemba-ride" element={<GembaModule onBack={handleBackToDashboard} role={role} />} />
        <Route
          path="/checklist"
          element={<ChecklistModule onBack={handleBackToDashboard} role={role} username={username} />}
        />
        <Route path="/slam" element={<SlamModule onBack={handleBackToDashboard} username={username} />} />
        <Route path="/safety" element={<SafetyModule onBack={handleBackToDashboard} username={username} />} />
      </Route>

      <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
```

### `frontend/src/app/components/Dashboard.tsx`

```tsx
import {
  ClipboardList,
  Car,
  CheckSquare,
  AlertTriangle,
  Shield,
  LogOut,
  Bell
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import NotificationPanel from './NotificationPanel';
import logoImg from '../../imports/Captura_de_pantalla_2026-05-27_211047.png';
import { ApiError } from '../../services/api';
import {
  getNotificationSummary, listNotifications, markAllNotificationsRead,
  markNotificationRead, type AssistNotification,
} from '../../services/notificaciones';

interface DashboardProps {
  username: string;
  role: string;
  onModuleSelect: (module: string) => void;
  onLogout: () => void;
}

export default function Dashboard({ username, role, onModuleSelect, onLogout }: DashboardProps) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<AssistNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [pendingId, setPendingId] = useState<number | null>(null);

  const errorMessage = (error: unknown) => error instanceof ApiError
    ? error.message
    : 'No fue posible obtener las notificaciones';

  const refreshSummary = useCallback(async () => {
    try {
      const response = await getNotificationSummary();
      setUnreadCount(response.total_no_leidas);
    } catch (error) {
      setUnreadCount(null);
      setNotificationError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void refreshSummary();
    const interval = window.setInterval(() => void refreshSummary(), 60000);
    return () => window.clearInterval(interval);
  }, [refreshSummary]);

  const openNotifications = async () => {
    setPanelOpen(true);
    setLoadingNotifications(true);
    setNotificationError('');
    try {
      const response = await listNotifications();
      setNotifications(response.notificaciones);
      setUnreadCount(response.total_no_leidas);
    } catch (error) {
      setNotificationError(errorMessage(error));
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markRead = async (id: number) => {
    setPendingId(id);
    try {
      await markNotificationRead(id);
      setNotifications(items => items.map(item => item.id_notificacion === id
        ? { ...item, leida: true, estado: 'Leida' }
        : item));
      await refreshSummary();
    } catch (error) {
      setNotificationError(errorMessage(error));
    } finally {
      setPendingId(null);
    }
  };

  const markAllRead = async () => {
    setPendingId(0);
    try {
      await markAllNotificationsRead();
      setNotifications(items => items.map(item => ({ ...item, leida: true, estado: 'Leida' })));
      await refreshSummary();
    } catch (error) {
      setNotificationError(errorMessage(error));
    } finally {
      setPendingId(null);
    }
  };
  const displayRole = role === 'ADMINISTRADOR'
    ? 'Administrador'
    : role === 'SUPERVISOR'
      ? 'Supervisor'
      : role;
  const currentDate = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const currentTime = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const modules = [
    { id: 'emc', name: 'MC', icon: ClipboardList, description: 'Eventos y Marcaciones' },
    { id: 'gemba', name: 'GEMBA RIDE', icon: Car, description: 'Evaluación de Couriers' },
    { id: 'checklist', name: 'CHECKLIST', icon: CheckSquare, description: 'Tareas y Seguimiento' },
    { id: 'slam', name: 'SLAM', icon: AlertTriangle, description: 'Reporte de Incidentes' },
    { id: 'safety', name: 'SAFETY', icon: Shield, description: 'Hallazgos de Seguridad' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-foreground shadow-md">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ImageWithFallback
                src={logoImg}
                alt="ASSIST Logo"
                className="h-12 w-auto"
              />
              <p className="text-sm text-foreground">Sistema de Operaciones Logísticas</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => void openNotifications()} aria-label="Abrir notificaciones" className="relative p-2 border-2 border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <Bell className="w-5 h-5" />
                {unreadCount !== null && unreadCount > 0 && <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-destructive text-destructive-foreground text-xs flex items-center justify-center rounded-full font-bold">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
              <button
                onClick={onLogout}
                className="bg-secondary text-secondary-foreground px-6 py-2 border-2 border-secondary hover:bg-secondary/90 flex items-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                CERRAR SESIÓN
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-4 bg-card border-b-2 border-border shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg">
              <span className="opacity-70">Usuario:</span>{' '}
              <span className="font-semibold">{username}</span>
            </p>
            <p className="text-lg">
              <span className="opacity-70">Rol:</span>{' '}
              <span className="font-semibold">{displayRole}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg capitalize">{currentDate}</p>
            <p className="text-2xl font-semibold">{currentTime}</p>
          </div>
        </div>
      </div>

      <main className="p-6">
        <div className="mb-8">
          <h2 className="text-2xl mb-3">MÓDULOS DEL SISTEMA</h2>
          <div className="h-1 w-24 bg-primary shadow-sm"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => onModuleSelect(module.id)}
              className="bg-card border-2 border-border p-8 hover:border-primary hover:shadow-lg transition-all text-left group"
            >
              <div className="flex flex-col items-center text-center">
                <module.icon className="w-16 h-16 mb-4 text-foreground group-hover:text-primary group-hover:scale-110 transition-all" />
                <h3 className="text-xl mb-2">{module.name}</h3>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 max-w-sm">
          <div className="bg-card border-2 border-warning p-6 hover:shadow-lg transition-all">
            <p className="text-sm text-muted-foreground mb-2">Notificaciones sin leer</p>
            <p className={unreadCount === null ? 'text-base text-muted-foreground' : 'text-4xl'}>
              {unreadCount === null ? 'Sin datos' : unreadCount}
            </p>
          </div>
        </div>
      </main>
      {panelOpen && <NotificationPanel notifications={notifications} loading={loadingNotifications} error={notificationError} pendingId={pendingId} onClose={() => setPanelOpen(false)} onRead={id => void markRead(id)} onReadAll={() => void markAllRead()} />}
    </div>
  );
}
```

### `frontend/src/app/components/Login.tsx`

```tsx
import { useState } from 'react';
import { User, Eye, EyeOff, Lock } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import logoImg from '../../imports/Captura_de_pantalla_2026-05-27_211047.png';
import { login } from '../../services/auth';
import { ApiError } from '../../services/api';
import type { AuthSession } from '../../services/session';

interface LoginProps {
  onLogin: (session: AuthSession) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || isSubmitting) return;

    setError('');
    setIsSubmitting(true);

    try {
      const session = await login(username, password);
      onLogin(session);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'No fue posible iniciar sesión'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border-2 border-border p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="mb-6 px-8">
            <ImageWithFallback
              src={logoImg}
              alt="ASSIST Logo"
              className="w-full max-w-[280px] mx-auto h-auto"
            />
          </div>
          <p className="text-foreground">Sistema de Operaciones Logísticas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block mb-2 text-foreground">
              Usuario
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <User className="w-5 h-5" />
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-border bg-input-background text-foreground focus:outline-none focus:border-primary"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block mb-2 text-foreground">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Lock className="w-5 h-5" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border-2 border-border bg-input-background text-foreground focus:outline-none focus:border-primary"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors shadow-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-primary-foreground py-4 px-6 border-2 border-primary hover:bg-primary/90 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'INICIANDO SESIÓN...' : 'INICIAR SESIÓN'}
          </button>

        </form>
      </div>
    </div>
  );
}
```

### `frontend/src/app/components/NotificationPanel.tsx`

```tsx
import { Check, LoaderCircle, X } from 'lucide-react';
import type { AssistNotification } from '../../services/notificaciones';

interface NotificationPanelProps {
  notifications: AssistNotification[];
  loading: boolean;
  error: string;
  pendingId: number | null;
  onClose: () => void;
  onRead: (id: number) => void;
  onReadAll: () => void;
}

function formatDate(value: string) {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

export default function NotificationPanel({
  notifications,
  loading,
  error,
  pendingId,
  onClose,
  onRead,
  onReadAll,
}: NotificationPanelProps) {
  const unreadCount = notifications.filter(item => !item.leida).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-title"
        className="h-full w-full max-w-md bg-card text-foreground shadow-2xl flex flex-col"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="p-4 border-b-2 border-border flex items-center justify-between gap-3">
          <div>
            <h2 id="notification-title" className="text-lg font-bold">NOTIFICACIONES</h2>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Cargando...' : error ? 'Sin datos' : `${unreadCount} sin leer`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar notificaciones" className="p-2 hover:bg-secondary rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!loading && !error && unreadCount > 0 && (
          <button onClick={onReadAll} disabled={pendingId !== null} className="m-4 mb-0 border-2 border-primary text-primary px-3 py-2 text-sm font-bold hover:bg-primary/10 disabled:opacity-50">
            Marcar todas como leídas
          </button>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && <div className="py-10 flex justify-center"><LoaderCircle className="w-6 h-6 animate-spin" aria-label="Cargando notificaciones" /></div>}
          {!loading && error && <div className="border-2 border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          {!loading && !error && notifications.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">Sin notificaciones</div>
          )}
          {!loading && !error && notifications.map(item => (
            <article key={item.id_notificacion} className={`border-2 p-3 ${item.leida ? 'border-border opacity-70' : 'border-primary bg-primary/5'}`}>
              <p className="text-sm">{item.mensaje}</p>
              <p className="text-xs text-muted-foreground mt-2">{formatDate(item.fecha_programada)}</p>
              {!item.leida && (
                <button
                  onClick={() => onRead(item.id_notificacion)}
                  disabled={pendingId !== null}
                  className="mt-3 flex items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {pendingId === item.id_notificacion ? 'Marcando...' : 'Marcar como leída'}
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
```

### `frontend/src/app/components/EMCModule.tsx`

```tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Search, Edit, Trash2, Download, CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { ApiError } from '../../services/api';
import { createMC, deleteMC, exportMC, listMC, updateMC, type MCInput, type MCRecord } from '../../services/mc';

const DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [viewYear, setViewYear] = useState(value ? parseInt(value.split('-')[0]) : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value ? parseInt(value.split('-')[1]) - 1 : today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const displayValue = value
    ? value.split('-').reverse().join('/')
    : 'dd/mm/aaaa';

  const selectedDay = value && parseInt(value.split('-')[0]) === viewYear && parseInt(value.split('-')[1]) - 1 === viewMonth
    ? parseInt(value.split('-')[2])
    : null;

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full px-4 py-3 border-2 bg-input-background text-left flex items-center justify-between transition-colors ${open ? 'border-primary' : 'border-border hover:border-primary/60'}`}
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{displayValue}</span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="w-4 h-4" />
            </span>
          )}
          <CalendarDays className="w-5 h-5 text-muted-foreground" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-card border-2 border-border shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border bg-muted">
            <button type="button" onClick={prevMonth} className="p-1 hover:text-primary transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-bold tracking-wide text-sm uppercase">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 hover:text-primary transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map(d => (
              <div key={d} className="text-center py-2 text-xs font-bold text-muted-foreground">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 p-2 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = day === selectedDay;
              const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`w-full aspect-square flex items-center justify-center text-sm transition-colors
                    ${isSelected ? 'bg-primary text-primary-foreground font-bold' : ''}
                    ${!isSelected && isToday ? 'border-2 border-primary font-semibold' : ''}
                    ${!isSelected ? 'hover:bg-muted' : ''}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2 flex justify-between items-center">
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                const mm = String(t.getMonth() + 1).padStart(2, '0');
                const dd = String(t.getDate()).padStart(2, '0');
                onChange(`${t.getFullYear()}-${mm}-${dd}`);
                setViewYear(t.getFullYear());
                setViewMonth(t.getMonth());
                setOpen(false);
              }}
              className="text-xs font-bold text-primary hover:underline"
            >
              HOY
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
              CERRAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface EMCModuleProps {
  onBack: () => void;
  username: string;
}

export default function EMCModule({ onBack, username }: EMCModuleProps) {
  const [records, setRecords] = useState<MCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<'save' | 'delete' | 'export' | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
    evento: '',
    operador: username,
    observaciones: ''
  });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    setRecords([]);
    try {
      setRecords(await listMC({ operador: searchTerm, fecha: filterDate }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No fue posible cargar los registros MC');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterDate]);

  useEffect(() => {
    const timeout = window.setTimeout(loadRecords, 300);
    return () => window.clearTimeout(timeout);
  }, [loadRecords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (operation) return;
    setOperation('save');
    setError('');
    try {
      const input: MCInput = formData;
      if (editingId !== null) await updateMC(editingId, input);
      else await createMC(input);
      resetForm();
      await loadRecords();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No fue posible guardar el registro MC');
    } finally {
      setOperation(null);
    }
  };

  const handleEdit = (record: MCRecord) => {
    setFormData({
      fecha: record.fecha,
      hora: record.hora,
      evento: record.evento,
      operador: record.operador,
      observaciones: record.observaciones
    });
    setEditingId(record.id);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (deleteId === null || operation) return;
    setOperation('delete');
    setError('');
    try {
      await deleteMC(deleteId);
      setShowConfirm(false);
      setDeleteId(null);
      await loadRecords();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No fue posible eliminar el registro MC');
    } finally {
      setOperation(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirm(false);
    setDeleteId(null);
  };

  const resetForm = () => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toTimeString().slice(0, 5),
      evento: '',
      operador: username,
      observaciones: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleExport = async () => {
    if (operation) return;
    setOperation('export');
    setError('');
    try {
      const blob = await exportMC({ operador: searchTerm, fecha: filterDate });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_mc_${Date.now()}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No fue posible exportar los registros MC');
    } finally {
      setOperation(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-foreground px-6 py-4 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="hover:opacity-70">
            <ArrowLeft className="w-8 h-8" />
          </button>
          <div>
            <h1 className="text-3xl tracking-wider">MC</h1>
            <p className="text-sm">Eventos y Marcaciones</p>
          </div>
        </div>
      </header>

      <main className="p-6">
        {!showForm ? (
          <>
            <div className="mb-6 flex flex-wrap gap-4">
              <button
                onClick={() => setShowForm(true)}
                className="bg-primary text-primary-foreground px-6 py-3 border-2 border-primary hover:bg-primary/90 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                NUEVO REGISTRO
              </button>
              <button onClick={handleExport} disabled={operation !== null} className="bg-card text-foreground px-6 py-3 border-2 border-border hover:border-primary flex items-center gap-2 disabled:opacity-50">
                <Download className="w-5 h-5" />
                {operation === 'export' ? 'EXPORTANDO...' : 'EXPORTAR'}
              </button>
            </div>

            <div className="bg-card border-2 border-border p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filtrar por operador..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-border bg-input-background focus:outline-none focus:border-primary"
                  />
                </div>
                <DatePicker value={filterDate} onChange={setFilterDate} />
              </div>
            </div>

            {error && <div className="mb-6 border-2 border-destructive p-4 text-destructive">{error}</div>}

            <div className="bg-card border-2 border-border overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left border-b-2 border-border">FECHA</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border">HORA</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border">MC</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border">OPERADOR</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border">OBSERVACIONES</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, idx) => (
                    <tr key={record.id} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                      <td className="px-4 py-3 border-b border-border">{record.fecha}</td>
                      <td className="px-4 py-3 border-b border-border">{record.hora}</td>
                      <td className="px-4 py-3 border-b border-border">{record.evento}</td>
                      <td className="px-4 py-3 border-b border-border">{record.operador}</td>
                      <td className="px-4 py-3 border-b border-border">{record.observaciones}</td>
                      <td className="px-4 py-3 border-b border-border">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(record)}
                            className="p-2 bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="p-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <div className="text-center py-8 text-muted-foreground">Cargando registros...</div>}
              {!loading && !error && records.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron registros
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-card border-2 border-border p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl mb-6">
              {editingId ? 'EDITAR REGISTRO' : 'NUEVO REGISTRO'}
            </h2>
            {error && <div className="mb-4 border-2 border-destructive p-4 text-destructive">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2">Fecha</label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-border bg-input-background focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-2">Hora</label>
                  <input
                    type="time"
                    value={formData.hora}
                    onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-border bg-input-background focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block mb-2">MC</label>
                <input
                  type="text"
                  value={formData.evento}
                  onChange={(e) => setFormData({ ...formData, evento: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-border bg-input-background focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block mb-2">Operador</label>
                <input
                  type="text"
                  value={formData.operador}
                  onChange={(e) => setFormData({ ...formData, operador: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-border bg-input-background focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block mb-2">Observaciones</label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-border bg-input-background focus:outline-none focus:border-primary"
                  rows={4}
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={operation !== null}
                  className="flex-1 bg-primary text-primary-foreground py-3 border-2 border-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {operation === 'save' ? 'GUARDANDO...' : 'GUARDAR'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-secondary text-secondary-foreground py-3 border-2 border-secondary hover:bg-secondary/90"
                >
                  CANCELAR
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <ConfirmDialog
        isOpen={showConfirm}
        title="CONFIRMAR ELIMINACIÓN"
        message="¿Está seguro de que desea eliminar este registro? Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
```

### `frontend/src/app/components/GembaModule.tsx`

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, Download, Eye, Edit, Trash2, X, ChevronLeft, User, Car, Clock, MapPin, Star } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { ApiError } from '../../services/api';
import { createGemba, deleteGemba, exportGemba, listCouriers, listGemba, updateGemba, type Courier, type EvaluacionView, type GembaFilters, type GembaRecord } from '../../services/gemba';

interface GembaModuleProps {
  onBack: () => void;
  role: string;
}

const EVALUACION_STYLES: Record<string, string> = {
  'Excelente': 'bg-primary text-primary-foreground',
  'Bueno': 'bg-secondary text-secondary-foreground',
  'Regular': 'bg-warning text-warning-foreground',
  'Necesita Mejora': 'bg-destructive text-destructive-foreground',
};

export default function GembaModule({ onBack, role }: GembaModuleProps) {
  const [selectedCourier, setSelectedCourier] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewRecord, setViewRecord] = useState<GembaRecord | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // History filters
  const [filterCourier, setFilterCourier] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [filterEval, setFilterEval] = useState('');

  const [records, setRecords] = useState<GembaRecord[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operationPending, setOperationPending] = useState(false);
  const submitPendingRef = useRef(false);

  const emptyForm = {
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
    numeroEconomico: '',
    numeroParadas: 0,
    tiempoTotal: '',
    observaciones: '',
    evaluacion: 'Bueno'
  };
  const [formData, setFormData] = useState(emptyForm);

  const currentFilters = useCallback((): GembaFilters => ({
    idCourier: filterCourier ? Number(filterCourier) : undefined,
    fecha: filterFecha || undefined,
    evaluacion: (filterEval || undefined) as EvaluacionView | undefined,
  }), [filterCourier, filterFecha, filterEval]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    setRecords([]);
    try { setRecords(await listGemba(currentFilters())); }
    catch (err) { setError(err instanceof ApiError || err instanceof TypeError ? err.message : 'No fue posible cargar Gemba Ride'); }
    finally { setLoading(false); }
  }, [currentFilters]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);
  useEffect(() => {
    listCouriers().then(setCouriers).catch(err => setError(err instanceof Error ? err.message : 'No fue posible cargar los couriers'));
  }, []);

  const handleCourierSelect = (courier: Courier) => {
    setSelectedCourier(courier.id);
    setShowForm(true);
    setShowHistory(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleEdit = (record: GembaRecord) => {
    setSelectedCourier(record.idCourier);
    setEditingId(record.id);
    setFormData({
      fecha: record.fecha,
      hora: record.hora,
      numeroEconomico: record.numeroEconomico,
      numeroParadas: record.numeroParadas,
      tiempoTotal: record.tiempoTotal,
      observaciones: record.observaciones,
      evaluacion: record.evaluacion,
    });
    setShowHistory(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourier || submitPendingRef.current) return;
    submitPendingRef.current = true;
    setOperationPending(true);
    setError('');
    try {
      const input = { ...formData, idCourier: selectedCourier, evaluacion: formData.evaluacion as EvaluacionView };
      if (editingId) await updateGemba(editingId, input); else await createGemba(input);
      resetForm();
      await loadRecords();
    } catch (err) { setError(err instanceof ApiError || err instanceof TypeError ? err.message : 'No fue posible guardar la evaluación'); }
    finally {
      submitPendingRef.current = false;
      setOperationPending(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setSelectedCourier(null);
    setShowForm(false);
    setEditingId(null);
  };

  const handleDeleteRequest = (id: number) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteId || operationPending) return;
    setOperationPending(true);
    setError('');
    try { await deleteGemba(deleteId); setShowConfirm(false); setDeleteId(null); await loadRecords(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No fue posible eliminar la evaluación'); }
    finally { setOperationPending(false); }
  };

  const handleExport = async () => {
    if (operationPending) return;
    setOperationPending(true);
    setError('');
    try {
      const blob = await exportGemba(currentFilters());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `gemba-ride-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No fue posible exportar el archivo Excel'); }
    finally { setOperationPending(false); }
  };

  const filteredRecords = records;
  const selectedCourierName = couriers.find(courier => courier.id === selectedCourier)?.nombre ?? '';

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-foreground px-6 py-4 shadow-md">
        <div className="flex items-center gap-4">
          <button
            onClick={showForm || showHistory ? () => { setShowForm(false); setShowHistory(false); setSelectedCourier(null); setEditingId(null); } : onBack}
            className="hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="w-8 h-8" />
          </button>
          <div>
            <h1 className="text-3xl tracking-wider font-bold">GEMBA RIDE</h1>
            <p className="text-sm opacity-80">Evaluación de Couriers</p>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6">
        {error && <div className="mb-4 border-2 border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {loading && <div className="mb-4 text-sm text-muted-foreground">Cargando datos de Gemba Ride...</div>}

        {/* Main menu */}
        {!showForm && !showHistory && (
          <>
            <h2 className="text-xl font-bold tracking-wide mb-2">SELECCIONE COURIER</h2>
            <p className="text-sm text-muted-foreground mb-6">Elige al courier para iniciar una nueva evaluación de recorrido</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              {couriers.map((courier) => {
                const count = records.filter(r => r.idCourier === courier.id).length;
                return (
                  <button
                    key={courier.id}
                    onClick={() => handleCourierSelect(courier)}
                    className="bg-card border-2 border-border p-8 hover:border-primary hover:shadow-md transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-muted group-hover:bg-primary transition-colors p-2">
                        <User className="w-6 h-6 group-hover:text-primary-foreground" />
                      </div>
                      <h3 className="text-2xl font-bold">{courier.nombre}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{count} evaluación{count !== 1 ? 'es' : ''} registrada{count !== 1 ? 's' : ''}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowHistory(true)}
                className="bg-secondary text-secondary-foreground px-5 py-3 border-2 border-secondary hover:bg-secondary/90 transition-colors flex items-center gap-2 font-bold tracking-wide"
              >
                <FileText className="w-5 h-5" />
                VER HISTORIAL
              </button>
              {role === 'ADMINISTRADOR' && (
                <button
                  onClick={handleExport}
                  className="bg-card text-foreground px-5 py-3 border-2 border-border hover:border-primary transition-colors flex items-center gap-2 font-bold tracking-wide"
                >
                  <Download className="w-5 h-5" />
                  EXPORTAR A EXCEL
                </button>
              )}
            </div>
          </>
        )}

        {/* Form */}
        {showForm && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={resetForm} className="hover:opacity-70 transition-opacity">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold tracking-wide">
                {editingId ? 'EDITAR EVALUACIÓN' : 'NUEVA EVALUACIÓN'} — {selectedCourierName}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-card border-2 border-border p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Fecha</label>
                    <input type="date" value={formData.fecha}
                      onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Hora</label>
                    <input type="time" value={formData.hora}
                      onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Número Económico</label>
                    <input type="text" value={formData.numeroEconomico} placeholder="VH-XXXX"
                      onChange={(e) => setFormData({ ...formData, numeroEconomico: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Número de Paradas</label>
                    <input type="number" value={formData.numeroParadas}
                      onChange={(e) => setFormData({ ...formData, numeroParadas: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Tiempo Total</label>
                    <input type="text" value={formData.tiempoTotal} placeholder="4:30"
                      onChange={(e) => setFormData({ ...formData, tiempoTotal: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Evaluación</label>
                    <select value={formData.evaluacion}
                      onChange={(e) => setFormData({ ...formData, evaluacion: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary">
                      <option value="Excelente">Excelente</option>
                      <option value="Bueno">Bueno</option>
                      <option value="Regular">Regular</option>
                      <option value="Necesita Mejora">Necesita Mejora</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Observaciones</label>
                  <textarea value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary resize-none"
                    rows={4} required />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="submit" disabled={operationPending} className="flex-1 bg-primary text-primary-foreground py-3 border-2 border-primary hover:bg-primary/90 transition-colors font-bold tracking-wide disabled:opacity-50">
                  {operationPending ? 'GUARDANDO...' : 'GUARDAR'}
                </button>
                <button type="button" onClick={resetForm} className="flex-1 bg-secondary text-secondary-foreground py-3 border-2 border-secondary hover:bg-secondary/90 transition-colors font-bold tracking-wide">
                  CANCELAR
                </button>
              </div>
            </form>
          </div>
        )}

        {/* History */}
        {showHistory && (
          <>
            <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowHistory(false)} className="hover:opacity-70 transition-opacity">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold tracking-wide">HISTORIAL DE EVALUACIONES</h2>
              </div>
              {role === 'ADMINISTRADOR' && (
                <button
                  onClick={handleExport}
                  disabled={operationPending}
                  className="bg-card text-foreground px-5 py-2 border-2 border-border hover:border-primary transition-colors flex items-center gap-2 font-bold tracking-wide text-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  EXPORTAR A EXCEL
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="bg-card border-2 border-border p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Courier</label>
                <select value={filterCourier} onChange={(e) => setFilterCourier(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary text-sm">
                  <option value="">Todos</option>
                  {couriers.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Fecha</label>
                <input type="date" value={filterFecha} onChange={(e) => setFilterFecha(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Evaluación</label>
                <select value={filterEval} onChange={(e) => setFilterEval(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary text-sm">
                  <option value="">Todas</option>
                  <option value="Excelente">Excelente</option>
                  <option value="Bueno">Bueno</option>
                  <option value="Regular">Regular</option>
                  <option value="Necesita Mejora">Necesita Mejora</option>
                </select>
              </div>
              {(filterCourier || filterFecha || filterEval) && (
                <div className="md:col-span-3 flex justify-end">
                  <button
                    onClick={() => { setFilterCourier(''); setFilterFecha(''); setFilterEval(''); }}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3 h-3" /> Limpiar filtros
                  </button>
                </div>
              )}
            </div>

            <div className="bg-card border-2 border-border overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left border-b-2 border-border text-sm">COURIER</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border text-sm">FECHA</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border text-sm">HORA</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border text-sm">N° ECONÓMICO</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border text-sm">PARADAS</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border text-sm">TIEMPO</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border text-sm">EVALUACIÓN</th>
                    <th className="px-4 py-3 text-left border-b-2 border-border text-sm">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && !error && filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">No se encontraron registros</td>
                    </tr>
                  ) : filteredRecords.map((record, idx) => (
                    <tr key={record.id} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                      <td className="px-4 py-3 border-b border-border font-medium">{record.courier}</td>
                      <td className="px-4 py-3 border-b border-border text-sm">{record.fecha}</td>
                      <td className="px-4 py-3 border-b border-border text-sm">{record.hora}</td>
                      <td className="px-4 py-3 border-b border-border text-sm">{record.numeroEconomico}</td>
                      <td className="px-4 py-3 border-b border-border text-sm">{record.numeroParadas}</td>
                      <td className="px-4 py-3 border-b border-border text-sm">{record.tiempoTotal}</td>
                      <td className="px-4 py-3 border-b border-border">
                        <span className={`px-2 py-1 text-xs font-bold ${EVALUACION_STYLES[record.evaluacion] ?? 'bg-muted'}`}>
                          {record.evaluacion}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-border">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setViewRecord(record)}
                            title="Ver"
                            className="p-2 bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(record)}
                            title="Editar"
                            className="p-2 bg-muted hover:bg-secondary hover:text-secondary-foreground transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {role === 'ADMINISTRADOR' && (
                            <button
                              onClick={() => handleDeleteRequest(record.id)}
                              title="Eliminar"
                              className="p-2 bg-muted hover:bg-destructive hover:text-destructive-foreground transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && !error && (
              <p className="text-xs text-muted-foreground mt-2">{filteredRecords.length} registro(s) encontrado(s)</p>
            )}
          </>
        )}
      </main>

      {/* View modal */}
      {viewRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border-2 border-border w-full max-w-md shadow-2xl">
            <div className="bg-muted px-5 py-4 flex items-center justify-between border-b-2 border-border">
              <h3 className="font-bold text-lg tracking-wide">DETALLE — {viewRecord.courier}</h3>
              <button onClick={() => setViewRecord(null)} className="hover:text-destructive transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha / Hora</p>
                    <p className="text-sm font-medium">{viewRecord.fecha} {viewRecord.hora}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">N° Económico</p>
                    <p className="text-sm font-medium">{viewRecord.numeroEconomico}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Paradas</p>
                    <p className="text-sm font-medium">{viewRecord.numeroParadas}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tiempo Total</p>
                    <p className="text-sm font-medium">{viewRecord.tiempoTotal}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Star className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Evaluación</p>
                  <span className={`px-3 py-1 text-sm font-bold ${EVALUACION_STYLES[viewRecord.evaluacion] ?? 'bg-muted'}`}>
                    {viewRecord.evaluacion}
                  </span>
                </div>
              </div>
              <div className="pt-1">
                <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                <p className="text-sm bg-muted p-3 border border-border">{viewRecord.observaciones}</p>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => setViewRecord(null)}
                className="w-full bg-secondary text-secondary-foreground py-2 border-2 border-secondary hover:bg-secondary/90 transition-colors font-bold tracking-wide">
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        title="CONFIRMAR ELIMINACIÓN"
        message="¿Está seguro de que desea eliminar esta evaluación? Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        onCancel={() => { setShowConfirm(false); setDeleteId(null); }}
      />
    </div>
  );
}
```

### `frontend/src/app/components/ChecklistModule.tsx`

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Plus, Download, Edit, Clock, Bell, Eye, CheckCircle, XCircle,
  RotateCcw, X, Search, Filter, ChevronDown, FileText, AlertCircle
} from 'lucide-react';
import { ApiError } from '../../services/api';
import {
  acceptChecklistTask, cancelChecklistTask, createChecklistTask, deliverChecklistTask,
  exportChecklist, getChecklistTaskDetails, listChecklist, listChecklistAdministrators,
  rejectChecklistTask, startChecklistTask, updateChecklistTask,
  type ChecklistAdministrator, type ChecklistFilters, type ChecklistPriority,
  type ChecklistStatus, type ChecklistTask, type ChecklistTaskInput,
} from '../../services/checklist';

type TaskStatus = ChecklistStatus;
type Priority = ChecklistPriority;
type Task = ChecklistTask;

interface ChecklistModuleProps {
  onBack: () => void;
  role: string;
  username: string;
}

const ESTADO_COLORS: Record<TaskStatus, string> = {
  pendiente: 'bg-blue-100 text-blue-800 border border-blue-300',
  en_proceso: 'bg-orange-100 text-orange-800 border border-orange-300',
  entregada: 'bg-purple-100 text-purple-800 border border-purple-300',
  completada: 'bg-green-100 text-green-800 border border-green-300',
  rechazada: 'bg-red-100 text-red-800 border border-red-300',
  vencida: 'bg-gray-100 text-gray-700 border border-gray-400',
  cancelada: 'bg-gray-100 text-gray-500 border border-gray-300',
};

const ESTADO_LABELS: Record<TaskStatus, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En Proceso',
  entregada: 'Entregada',
  completada: 'Completada',
  rechazada: 'Rechazada',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  alta: 'text-red-700 bg-red-50 border border-red-300',
  media: 'text-yellow-700 bg-yellow-50 border border-yellow-300',
  baja: 'text-green-700 bg-green-50 border border-green-300',
};

const HISTORY_STATES: TaskStatus[] = ['completada', 'rechazada', 'vencida', 'cancelada'];
const ACTIVE_STATES: TaskStatus[] = ['pendiente', 'en_proceso', 'entregada'];

function getMinutesRemaining(task: Task): number {
  const deadline = new Date(`${task.fechaLimite}T${task.horaLimite}`).getTime();
  return Math.floor((deadline - Date.now()) / 60000);
}

function getCardBorder(task: Task): string {
  if (!ACTIVE_STATES.includes(task.estado)) return 'border-border';
  const mins = getMinutesRemaining(task);
  if (mins <= 0) return 'border-red-500';
  if (mins <= 10) return 'border-red-400';
  if (mins <= 20) return 'border-orange-400';
  if (mins <= 30) return 'border-yellow-400';
  return 'border-border';
}

function getCardBg(task: Task): string {
  if (!ACTIVE_STATES.includes(task.estado)) return 'bg-card';
  const mins = getMinutesRemaining(task);
  if (mins <= 0) return 'bg-red-50';
  if (mins <= 10) return 'bg-red-50';
  if (mins <= 20) return 'bg-orange-50';
  if (mins <= 30) return 'bg-yellow-50';
  return 'bg-card';
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Modal Base ──────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border-2 border-border w-full max-w-lg mx-4 shadow-xl rounded">
        <div className="bg-primary px-5 py-3 flex items-center justify-between rounded-t">
          <h3 className="text-primary-foreground font-bold tracking-wide text-sm">{title}</h3>
          <button onClick={onClose} className="text-primary-foreground hover:opacity-70"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Task Form Modal ──────────────────────────────────────────────────────────
interface TaskFormProps {
  initial?: Partial<Task>;
  administrators: ChecklistAdministrator[];
  onSave: (data: ChecklistTaskInput) => void;
  onClose: () => void;
  isEdit?: boolean;
}
function TaskFormModal({ initial, administrators, onSave, onClose, isEdit }: TaskFormProps) {
  const [form, setForm] = useState({
    titulo: initial?.titulo || '',
    descripcion: initial?.descripcion || '',
    responsableId: initial?.responsableId || 0,
    fechaLimite: initial?.fechaLimite || '',
    horaLimite: initial?.horaLimite || '',
    prioridad: (initial?.prioridad || 'media') as Priority,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal title={isEdit ? 'EDITAR TAREA' : 'NUEVA TAREA'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold mb-1">TÍTULO <span className="text-red-600">*</span></label>
          <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
            className="w-full px-3 py-2 border-2 border-border bg-background focus:outline-none focus:border-primary text-sm rounded" required />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">DESCRIPCIÓN</label>
          <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
            className="w-full px-3 py-2 border-2 border-border bg-background focus:outline-none focus:border-primary text-sm rounded" rows={2} />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">RESPONSABLE <span className="text-red-600">*</span></label>
          <select value={form.responsableId || ''} onChange={e => setForm({ ...form, responsableId: Number(e.target.value) })}
            className="w-full px-3 py-2 border-2 border-border bg-background focus:outline-none focus:border-primary text-sm rounded" required>
            <option value="">Seleccione un administrador</option>
            {administrators.map(item => <option key={item.id} value={item.id}>{item.usuario}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold mb-1">FECHA LÍMITE <span className="text-red-600">*</span></label>
            <input type="date" value={form.fechaLimite} onChange={e => setForm({ ...form, fechaLimite: e.target.value })}
              className="w-full px-3 py-2 border-2 border-border bg-background focus:outline-none focus:border-primary text-sm rounded" required />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">HORA LÍMITE <span className="text-red-600">*</span></label>
            <input type="time" value={form.horaLimite} onChange={e => setForm({ ...form, horaLimite: e.target.value })}
              className="w-full px-3 py-2 border-2 border-border bg-background focus:outline-none focus:border-primary text-sm rounded" required />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">PRIORIDAD</label>
          <select value={form.prioridad} onChange={e => setForm({ ...form, prioridad: e.target.value as Priority })}
            className="w-full px-3 py-2 border-2 border-border bg-background focus:outline-none focus:border-primary text-sm rounded">
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="flex-1 bg-primary text-primary-foreground py-2 text-sm font-bold hover:bg-primary/90 rounded">
            GUARDAR
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-secondary text-secondary-foreground py-2 text-sm font-bold hover:bg-secondary/90 rounded">
            CANCELAR
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delivery Modal ───────────────────────────────────────────────────────────
function DeliveryModal({ task, onDeliver, onClose }: { task: Task; onDeliver: (comentario: string, obs: string) => void; onClose: () => void }) {
  const [comentario, setComentario] = useState('');
  const [obs, setObs] = useState('');
  return (
    <Modal title="ENTREGAR TAREA" onClose={onClose}>
      <p className="text-sm font-bold mb-3 text-foreground">{task.titulo}</p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold mb-1">COMENTARIO DE ENTREGA <span className="text-red-600">*</span></label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)}
            className="w-full px-3 py-2 border-2 border-border bg-background focus:outline-none focus:border-primary text-sm rounded" rows={3} required />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">OBSERVACIONES</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)}
            className="w-full px-3 py-2 border-2 border-border bg-background focus:outline-none focus:border-primary text-sm rounded" rows={2} />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={() => { if (comentario.trim()) onDeliver(comentario, obs); }}
            className="flex-1 bg-primary text-primary-foreground py-2 text-sm font-bold hover:bg-primary/90 rounded">ENTREGAR</button>
          <button onClick={onClose} className="flex-1 bg-secondary text-secondary-foreground py-2 text-sm font-bold hover:bg-secondary/90 rounded">CANCELAR</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Review Modal (Supervisor) ────────────────────────────────────────────────
function ReviewModal({ task, onAccept, onReject, onClose }: {
  task: Task; onAccept: () => void; onReject: (motivo: string) => void; onClose: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [motivo, setMotivo] = useState('');
  return (
    <Modal title="REVISAR ENTREGA" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="bg-background border border-border p-3 rounded space-y-1">
          <p><span className="font-bold">Tarea:</span> {task.titulo}</p>
          <p><span className="font-bold">Responsable:</span> {task.responsable}</p>
          <p><span className="font-bold">Entregada el:</span> {task.entrega ? formatDateTime(task.entrega.fecha) : '-'}</p>
        </div>
        {task.entrega && (
          <div className="bg-background border border-border p-3 rounded space-y-1">
            <p className="font-bold text-xs uppercase mb-1">Comentario de entrega</p>
            <p>{task.entrega.comentario}</p>
            {task.entrega.observaciones && <p className="text-muted-foreground">{task.entrega.observaciones}</p>}
          </div>
        )}
        {!rejecting ? (
          <div className="flex gap-3 pt-1">
            <button onClick={onAccept} className="flex-1 bg-green-600 text-white py-2 font-bold hover:bg-green-700 rounded flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" /> ACEPTAR
            </button>
            <button onClick={() => setRejecting(true)} className="flex-1 bg-destructive text-destructive-foreground py-2 font-bold hover:bg-destructive/90 rounded flex items-center justify-center gap-2">
              <XCircle className="w-4 h-4" /> RECHAZAR
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-bold">MOTIVO DEL RECHAZO <span className="text-red-600">*</span></label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
              className="w-full px-3 py-2 border-2 border-border bg-background focus:outline-none focus:border-destructive text-sm rounded" rows={3} placeholder="Describa el motivo..." />
            <div className="flex gap-3">
              <button onClick={() => { if (motivo.trim()) onReject(motivo); }}
                className="flex-1 bg-destructive text-destructive-foreground py-2 font-bold hover:bg-destructive/90 rounded">CONFIRMAR RECHAZO</button>
              <button onClick={() => setRejecting(false)} className="flex-1 bg-secondary text-secondary-foreground py-2 font-bold hover:bg-secondary/90 rounded">VOLVER</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Cancel Confirm Modal ─────────────────────────────────────────────────────
function CancelModal({ task, onConfirm, onClose }: { task: Task; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title="CANCELAR TAREA" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 p-3 rounded">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-red-800">¿Está seguro de cancelar esta tarea?</p>
            <p className="text-red-700 mt-1">"{task.titulo}"</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 bg-destructive text-destructive-foreground py-2 font-bold hover:bg-destructive/90 rounded">CONFIRMAR</button>
          <button onClick={onClose} className="flex-1 bg-secondary text-secondary-foreground py-2 font-bold hover:bg-secondary/90 rounded">CANCELAR</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── View Detail Modal ────────────────────────────────────────────────────────
function DetailModal({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <Modal title="DETALLES DE TAREA" onClose={onClose}>
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-background border border-border p-2 rounded">
            <p className="text-xs text-muted-foreground">TÍTULO</p>
            <p className="font-bold">{task.titulo}</p>
          </div>
          <div className="bg-background border border-border p-2 rounded">
            <p className="text-xs text-muted-foreground">ESTADO</p>
            <span className={`text-xs px-2 py-0.5 rounded font-bold ${ESTADO_COLORS[task.estado]}`}>{ESTADO_LABELS[task.estado]}</span>
          </div>
          <div className="bg-background border border-border p-2 rounded">
            <p className="text-xs text-muted-foreground">RESPONSABLE</p>
            <p>{task.responsable}</p>
          </div>
          <div className="bg-background border border-border p-2 rounded">
            <p className="text-xs text-muted-foreground">PRIORIDAD</p>
            <span className={`text-xs px-2 py-0.5 rounded font-bold capitalize ${PRIORITY_COLORS[task.prioridad]}`}>{task.prioridad}</span>
          </div>
          <div className="bg-background border border-border p-2 rounded">
            <p className="text-xs text-muted-foreground">FECHA LÍMITE</p>
            <p>{task.fechaLimite} {task.horaLimite}</p>
          </div>
          <div className="bg-background border border-border p-2 rounded">
            <p className="text-xs text-muted-foreground">SUPERVISOR</p>
            <p>{task.supervisorAsignador}</p>
          </div>
        </div>
        {task.descripcion && (
          <div className="bg-background border border-border p-2 rounded">
            <p className="text-xs text-muted-foreground">DESCRIPCIÓN</p>
            <p>{task.descripcion}</p>
          </div>
        )}
        {task.observaciones && (
          <div className="bg-background border border-border p-2 rounded">
            <p className="text-xs text-muted-foreground">OBSERVACIONES</p>
            <p>{task.observaciones}</p>
          </div>
        )}
        {task.entrega && (
          <div className="bg-purple-50 border border-purple-200 p-2 rounded">
            <p className="text-xs text-purple-700 font-bold mb-1">ENTREGA</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(task.entrega.fecha)}</p>
            <p>{task.entrega.comentario}</p>
          </div>
        )}
        {task.motivoRechazo && (
          <div className="bg-red-50 border border-red-200 p-2 rounded">
            <p className="text-xs text-red-700 font-bold mb-1">MOTIVO DE RECHAZO</p>
            <p>{task.motivoRechazo}</p>
          </div>
        )}
        <button onClick={onClose} className="w-full bg-secondary text-secondary-foreground py-2 font-bold hover:bg-secondary/90 rounded mt-2">CERRAR</button>
      </div>
    </Modal>
  );
}

// ─── Time Display ─────────────────────────────────────────────────────────────
function TimeRemaining({ task }: { task: Task }) {
  const [mins, setMins] = useState(() => getMinutesRemaining(task));

  useEffect(() => {
    if (!ACTIVE_STATES.includes(task.estado)) return;
    const interval = setInterval(() => setMins(getMinutesRemaining(task)), 30000);
    return () => clearInterval(interval);
  }, [task]);

  if (!ACTIVE_STATES.includes(task.estado)) return null;

  const showBell = mins >= 0 && mins <= 30;
  const color = mins <= 0 ? 'text-red-700' : mins <= 10 ? 'text-red-600' : mins <= 20 ? 'text-orange-600' : mins <= 30 ? 'text-yellow-600' : 'text-muted-foreground';

  return (
    <span className={`flex items-center gap-1 text-xs font-bold ${color}`}>
      {showBell && <Bell className="w-3 h-3 animate-pulse" />}
      <Clock className="w-3 h-3" />
      {mins <= 0 ? 'VENCIDA' : `${mins} min restantes`}
    </span>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────
interface TaskCardProps {
  task: Task;
  isSupervisor: boolean;
  onAction: (action: string, task: Task) => void;
}
function TaskCard({ task, isSupervisor, onAction }: TaskCardProps) {
  const borderClass = getCardBorder(task);
  const bgClass = getCardBg(task);

  const supervisorActions = () => {
    switch (task.estado) {
      case 'pendiente':
      case 'en_proceso':
        return (
          <>
            <ActionBtn icon={<Eye className="w-3 h-3" />} label="VER" onClick={() => onAction('view', task)} />
            <ActionBtn icon={<Edit className="w-3 h-3" />} label="EDITAR" onClick={() => onAction('edit', task)} color="yellow" />
            <ActionBtn icon={<X className="w-3 h-3" />} label="CANCELAR" onClick={() => onAction('cancel', task)} color="red" />
          </>
        );
      case 'entregada':
        return (
          <>
            <ActionBtn icon={<Eye className="w-3 h-3" />} label="VER ENTREGA" onClick={() => onAction('review', task)} />
            <ActionBtn icon={<CheckCircle className="w-3 h-3" />} label="ACEPTAR" onClick={() => onAction('accept', task)} color="green" />
            <ActionBtn icon={<XCircle className="w-3 h-3" />} label="RECHAZAR" onClick={() => onAction('reject', task)} color="red" />
          </>
        );
      case 'completada':
      case 'rechazada':
      case 'vencida':
      case 'cancelada':
        return (
          <>
            <ActionBtn icon={<Eye className="w-3 h-3" />} label="VER DETALLES" onClick={() => onAction('view', task)} />
            {task.estado === 'rechazada' && (
              <ActionBtn icon={<FileText className="w-3 h-3" />} label="VER RECHAZO" onClick={() => onAction('view', task)} color="red" />
            )}
          </>
        );
      default: return null;
    }
  };

  const adminActions = () => {
    switch (task.estado) {
      case 'pendiente':
        return (
          <>
            <ActionBtn icon={<Eye className="w-3 h-3" />} label="VER" onClick={() => onAction('view', task)} />
            <ActionBtn icon={<CheckCircle className="w-3 h-3" />} label="INICIAR" onClick={() => onAction('start', task)} color="green" />
          </>
        );
      case 'en_proceso':
        return (
          <>
            <ActionBtn icon={<Eye className="w-3 h-3" />} label="VER" onClick={() => onAction('view', task)} />
            <ActionBtn icon={<FileText className="w-3 h-3" />} label="ENTREGAR" onClick={() => onAction('deliver', task)} color="yellow" />
          </>
        );
      case 'entregada':
        return (
          <>
            <ActionBtn icon={<Eye className="w-3 h-3" />} label="VER" onClick={() => onAction('view', task)} />
            <span className="text-xs text-purple-700 font-bold px-2 py-1 bg-purple-50 border border-purple-200 rounded">ESPERANDO REVISIÓN</span>
          </>
        );
      case 'rechazada':
        return (
          <>
            <ActionBtn icon={<FileText className="w-3 h-3" />} label="VER MOTIVO" onClick={() => onAction('view', task)} color="red" />
            <ActionBtn icon={<RotateCcw className="w-3 h-3" />} label="VOLVER A ENTREGAR" onClick={() => onAction('redeliver', task)} color="yellow" />
          </>
        );
      case 'completada':
      case 'vencida':
        return <ActionBtn icon={<Eye className="w-3 h-3" />} label="VER DETALLES" onClick={() => onAction('view', task)} />;
      default: return null;
    }
  };

  return (
    <div className={`border-2 ${borderClass} ${bgClass} p-5 rounded shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="font-bold text-lg truncate">{task.titulo}</h3>
            <span className={`text-sm px-2.5 py-0.5 rounded font-bold shrink-0 ${ESTADO_COLORS[task.estado]}`}>
              {ESTADO_LABELS[task.estado]}
            </span>
            <span className={`text-sm px-2.5 py-0.5 rounded font-bold capitalize shrink-0 ${PRIORITY_COLORS[task.prioridad]}`}>
              {task.prioridad}
            </span>
          </div>
          {task.descripcion && <p className="text-base text-muted-foreground mb-2 line-clamp-2">{task.descripcion}</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span><strong className="text-foreground">Responsable:</strong> {task.responsable}</span>
            {!isSupervisor && <span><strong className="text-foreground">Supervisor:</strong> {task.supervisorAsignador}</span>}
            <span><strong className="text-foreground">Límite:</strong> {task.fechaLimite} {task.horaLimite}</span>
            <TimeRemaining task={task} />
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {isSupervisor ? supervisorActions() : adminActions()}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, color = 'default' }: {
  icon: React.ReactNode; label: string; onClick: () => void; color?: 'default' | 'yellow' | 'red' | 'green';
}) {
  const colors = {
    default: 'bg-background text-foreground border-border hover:border-primary',
    yellow: 'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
    red: 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90',
    green: 'bg-green-600 text-white border-green-600 hover:bg-green-700',
  };
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 border text-sm font-bold rounded whitespace-nowrap ${colors[color]}`}>
      {icon}{label}
    </button>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────
interface Filters {
  search: string;
  responsable: string;
  estado: string;
  fecha: string;
}

function FilterBar({ filters, onChange, onClear, isSupervisor }: {
  filters: Filters; onChange: (f: Filters) => void; onClear: () => void; isSupervisor: boolean;
}) {
  return (
    <div className="bg-card border border-border p-3 rounded mb-4 flex flex-wrap gap-2 items-end">
      <div className="flex items-center gap-1 flex-1 min-w-32">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input placeholder="Buscar tarea..." value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          className="w-full px-2 py-1.5 border border-border bg-background text-xs focus:outline-none focus:border-primary rounded" />
      </div>
      <select value={filters.estado} onChange={e => onChange({ ...filters, estado: e.target.value })}
        className="px-2 py-1.5 border border-border bg-background text-xs focus:outline-none focus:border-primary rounded">
        <option value="">Todos los estados</option>
        {(Object.keys(ESTADO_LABELS) as TaskStatus[]).map(s => (
          <option key={s} value={s}>{ESTADO_LABELS[s]}</option>
        ))}
      </select>
      <input type="date" value={filters.fecha} onChange={e => onChange({ ...filters, fecha: e.target.value })}
        className="px-2 py-1.5 border border-border bg-background text-xs focus:outline-none focus:border-primary rounded" />
      <button onClick={onClear}
        className="px-3 py-1.5 border border-border text-xs font-bold hover:border-primary bg-background rounded flex items-center gap-1">
        <X className="w-3 h-3" /> LIMPIAR
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ChecklistModule({ onBack, role, username }: ChecklistModuleProps) {
  const isSupervisor = role === 'SUPERVISOR';
  const displayRole = isSupervisor ? 'Supervisor' : 'Administrador';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [administrators, setAdministrators] = useState<ChecklistAdministrator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operationPending, setOperationPending] = useState(false);
  const mutationPendingRef = useRef(false);
  const [tab, setTab] = useState<'activas' | 'historial'>('activas');
  const [filters, setFilters] = useState<Filters>({ search: '', responsable: '', estado: '', fecha: '' });

  // Modals
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deliverTask, setDeliverTask] = useState<Task | null>(null);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [cancelTask, setCancelTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);

  const backendFilters = useCallback((): ChecklistFilters => ({
    search: filters.search,
    estado: filters.estado ? filters.estado as TaskStatus : undefined,
    fecha: filters.fecha || undefined,
  }), [filters]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    setTasks([]);
    try { setTasks(await listChecklist(backendFilters())); }
    catch (err) { setError(err instanceof ApiError || err instanceof TypeError ? err.message : 'No fue posible cargar Checklist'); }
    finally { setLoading(false); }
  }, [backendFilters]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);
  useEffect(() => {
    if (!isSupervisor) return;
    listChecklistAdministrators().then(setAdministrators)
      .catch(err => setError(err instanceof Error ? err.message : 'No fue posible cargar los administradores'));
  }, [isSupervisor]);

  const runMutation = async (mutation: () => Promise<unknown>, close: () => void) => {
    if (mutationPendingRef.current) return;
    mutationPendingRef.current = true;
    setOperationPending(true);
    setError('');
    try { await mutation(); close(); await loadTasks(); }
    catch (err) { setError(err instanceof ApiError || err instanceof TypeError ? err.message : 'No fue posible completar la acción'); }
    finally { mutationPendingRef.current = false; setOperationPending(false); }
  };

  const loadDetails = async (task: Task): Promise<Task> => {
    try { return await getChecklistTaskDetails(task); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No fue posible cargar la entrega'); return task; }
  };

  const handleAction = async (action: string, task: Task) => {
    switch (action) {
      case 'view': setViewTask(await loadDetails(task)); break;
      case 'edit': setEditingTask(task); setShowTaskForm(true); break;
      case 'cancel': setCancelTask(task); break;
      case 'start': await runMutation(() => startChecklistTask(task.id), () => {}); break;
      case 'deliver': setDeliverTask(task); break;
      case 'redeliver': setDeliverTask(task); break;
      case 'review': setReviewTask(await loadDetails(task)); break;
      case 'accept': setReviewTask(await loadDetails(task)); break;
      case 'reject': setReviewTask(await loadDetails(task)); break;
    }
  };

  const handleSaveTask = async (data: ChecklistTaskInput) => {
    await runMutation(
      () => editingTask ? updateChecklistTask(editingTask.id, data) : createChecklistTask(data),
      () => { setShowTaskForm(false); setEditingTask(null); },
    );
  };

  const handleDeliver = async (comentario: string, obs: string) => {
    if (!deliverTask) return;
    const texto = obs.trim() ? `${comentario.trim()}\n\nObservaciones: ${obs.trim()}` : comentario.trim();
    await runMutation(() => deliverChecklistTask(deliverTask.id, texto), () => setDeliverTask(null));
  };

  const handleAccept = async () => {
    if (!reviewTask) return;
    await runMutation(() => acceptChecklistTask(reviewTask.id), () => setReviewTask(null));
  };

  const handleReject = async (motivo: string) => {
    if (!reviewTask) return;
    await runMutation(() => rejectChecklistTask(reviewTask.id, motivo), () => setReviewTask(null));
  };

  const handleCancel = async () => {
    if (!cancelTask) return;
    await runMutation(() => cancelChecklistTask(cancelTask.id), () => setCancelTask(null));
  };

  const handleExport = async () => {
    if (mutationPendingRef.current) return;
    mutationPendingRef.current = true;
    setOperationPending(true);
    setError('');
    try {
      const blob = await exportChecklist(backendFilters());
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `checklist-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No fue posible exportar el archivo Excel');
    } finally {
      mutationPendingRef.current = false;
      setOperationPending(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    // Tab filter
    const inHistory = HISTORY_STATES.includes(t.estado);
    if (tab === 'activas' && inHistory) return false;
    if (tab === 'historial' && !inHistory) return false;
    return true;
  });

  const activeCount = tasks.filter(t => ACTIVE_STATES.includes(t.estado)).length;
  const nearExpiry = tasks.filter(t => {
    if (!ACTIVE_STATES.includes(t.estado)) return false;
    const m = getMinutesRemaining(t);
    return m >= 0 && m <= 30;
  }).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-foreground px-6 py-4 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="hover:opacity-70">
            <ArrowLeft className="w-8 h-8" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl tracking-wider">CHECKLIST</h1>
              {!loading && !error && nearExpiry > 0 && (
                <span className="flex items-center gap-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded font-bold">
                  <Bell className="w-3 h-3" /> {nearExpiry} próxima{nearExpiry > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-sm">{isSupervisor ? 'Administración de Tareas' : 'Mis Tareas'}</p>
          </div>
          <div className="text-right text-xs opacity-80">
            <p className="font-bold">{username}</p>
            <p>{displayRole}</p>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        {error && <div className="mb-4 border-2 border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {loading && <div className="mb-4 text-sm text-muted-foreground">Cargando Checklist...</div>}
        {/* Action bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          {isSupervisor && (
            <button onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
              className="bg-primary text-primary-foreground px-4 py-2 font-bold text-sm hover:bg-primary/90 flex items-center gap-2 rounded border-2 border-primary">
              <Plus className="w-4 h-4" /> NUEVA TAREA
            </button>
          )}
          <button onClick={handleExport} disabled={operationPending} className="bg-card text-foreground px-4 py-2 font-bold text-sm border-2 border-border hover:border-primary flex items-center gap-2 rounded disabled:opacity-50">
            <Download className="w-4 h-4" /> EXPORTAR EXCEL
          </button>
        </div>

        {/* Color legend */}
        <div className="mb-4 flex flex-wrap gap-3 text-xs bg-card border border-border px-3 py-2 rounded">
          <span className="font-bold text-muted-foreground">ALERTA:</span>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-sm"></div><span>≤ 10 min</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-orange-400 rounded-sm"></div><span>≤ 20 min</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-400 rounded-sm"></div><span>≤ 30 min</span></div>
        </div>

        {/* Tabs */}
        <div className="flex border-b-2 border-border mb-4">
          {(['activas', 'historial'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-bold border-b-2 -mb-0.5 transition-colors ${tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t === 'activas' ? `ACTIVAS (${loading || error ? 'Sin datos' : activeCount})` : 'HISTORIAL'}
            </button>
          ))}
        </div>

        {/* Filters */}
        <FilterBar filters={filters} onChange={setFilters} onClear={() => setFilters({ search: '', responsable: '', estado: '', fecha: '' })} isSupervisor={isSupervisor} />

        {/* Task list */}
        <div className="space-y-3">
          {!loading && !error && filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card border-2 border-border rounded">
              {tab === 'activas' ? 'No hay tareas activas' : 'No hay tareas en el historial'}
            </div>
          ) : (
            filteredTasks.map(task => (
              <TaskCard key={task.id} task={task} isSupervisor={isSupervisor} onAction={handleAction} />
            ))
          )}
        </div>
      </main>

      {/* Modals */}
      {showTaskForm && (
        <TaskFormModal
          initial={editingTask || undefined}
          administrators={administrators}
          isEdit={!!editingTask}
          onSave={handleSaveTask}
          onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
        />
      )}
      {deliverTask && (
        <DeliveryModal task={deliverTask} onDeliver={handleDeliver} onClose={() => setDeliverTask(null)} />
      )}
      {reviewTask && (
        <ReviewModal task={reviewTask} onAccept={handleAccept} onReject={handleReject} onClose={() => setReviewTask(null)} />
      )}
      {cancelTask && (
        <CancelModal task={cancelTask} onConfirm={handleCancel} onClose={() => setCancelTask(null)} />
      )}
      {viewTask && (
        <DetailModal task={viewTask} onClose={() => setViewTask(null)} />
      )}
    </div>
  );
}
```

### `frontend/src/app/components/SlamModule.tsx`

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ClipboardCheck, Download, Edit, Eye, FileText, OctagonX, Paperclip, Plus, Settings, Trash2, X } from 'lucide-react';
import { ApiError } from '../../services/api';
import { createSlam, deleteSlam, exportSlam, listSlam, updateSlam, type SlamInput, type SlamRecord } from '../../services/slam';

interface SlamModuleProps { onBack: () => void; username: string }
type StepKey = 'stop' | 'look' | 'assess' | 'manage';

const SLAM_STEPS = [
  { key: 'stop' as const, label: 'STOP', sublabel: 'DETENTE', description: 'Detente antes de comenzar la tarea. Piensa en lo que estás a punto de hacer.', icon: OctagonX, color: 'border-destructive', iconBg: 'bg-destructive' },
  { key: 'look' as const, label: 'LOOK', sublabel: 'OBSERVA', description: 'Observa el entorno y los riesgos potenciales alrededor de ti y tu área de trabajo.', icon: Eye, color: 'border-primary', iconBg: 'bg-primary' },
  { key: 'assess' as const, label: 'ASSESS', sublabel: 'EVALÚA', description: 'Evalúa los riesgos identificados. Determina qué podría salir mal y el nivel de riesgo.', icon: ClipboardCheck, color: 'border-secondary', iconBg: 'bg-secondary' },
  { key: 'manage' as const, label: 'MANAGE', sublabel: 'GESTIONA', description: 'Gestiona los riesgos tomando las medidas de control necesarias antes de proceder.', icon: Settings, color: 'border-foreground', iconBg: 'bg-foreground' },
];

const emptySteps = (): Record<StepKey, string> => ({ stop: '', look: '', assess: '', manage: '' });

export default function SlamModule({ onBack, username }: SlamModuleProps) {
  const [reports, setReports] = useState<SlamRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState<SlamRecord | null>(null);
  const [formData, setFormData] = useState(emptySteps);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<Record<number, 'detalle' | 'archivo'>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operationPending, setOperationPending] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const pendingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReports = useCallback(async () => {
    setLoading(true); setError('');
    setReports([]);
    try { setReports(await listSlam()); }
    catch (err) { setError(err instanceof ApiError || err instanceof TypeError ? err.message : 'No fue posible cargar SLAM'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadReports(); }, [loadReports]);

  const resetForm = () => {
    setFormData(emptySteps()); setArchivo(null); setEditing(null); setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true; setOperationPending(true); setError('');
    try {
      const input: SlamInput = { ...formData, foto: archivo };
      if (editing) await updateSlam(editing.id, input); else await createSlam(input);
      resetForm(); await loadReports();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof TypeError ? err.message : 'No fue posible guardar la práctica SLAM');
    } finally { pendingRef.current = false; setOperationPending(false); }
  };

  const startEdit = (report: SlamRecord) => {
    setFormData({ stop: report.stop, look: report.look, assess: report.assess, manage: report.manage });
    setArchivo(null); setEditing(report); setShowHistory(false); setShowForm(true);
  };

  const handleDelete = async (report: SlamRecord) => {
    if (pendingRef.current || !window.confirm('¿Eliminar esta práctica SLAM?')) return;
    pendingRef.current = true; setOperationPending(true); setError('');
    try { await deleteSlam(report.id); await loadReports(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No fue posible eliminar la práctica SLAM'); }
    finally { pendingRef.current = false; setOperationPending(false); }
  };

  const handleExport = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true; setOperationPending(true); setError('');
    try {
      const blob = await exportSlam();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `slam-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No fue posible exportar el archivo Excel');
    } finally { pendingRef.current = false; setOperationPending(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-foreground px-6 py-4 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={showForm || showHistory ? () => { resetForm(); setShowHistory(false); } : onBack} className="hover:opacity-70 transition-opacity"><ArrowLeft className="w-8 h-8" /></button>
          <div><h1 className="text-3xl tracking-wider font-bold">SLAM</h1><p className="text-sm opacity-80">Stop · Look · Assess · Manage</p></div>
        </div>
      </header>

      <main className="p-4 md:p-6">
        {error && <div className="mb-4 border-2 border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {loading && <div className="mb-4 text-sm text-muted-foreground">Cargando prácticas SLAM...</div>}

        {!showForm && !showHistory && <>
          <div className="mb-6 flex flex-wrap gap-3">
            <button onClick={() => setShowForm(true)} className="bg-destructive text-destructive-foreground px-5 py-3 border-2 border-destructive hover:bg-destructive/90 transition-colors flex items-center gap-2 font-bold tracking-wide"><Plus className="w-5 h-5" />NUEVA PRÁCTICA</button>
            <button onClick={() => setShowHistory(true)} className="bg-secondary text-secondary-foreground px-5 py-3 border-2 border-secondary hover:bg-secondary/90 transition-colors flex items-center gap-2 font-bold tracking-wide"><FileText className="w-5 h-5" />HISTORIAL</button>
            <button onClick={() => void handleExport()} disabled={operationPending} className="bg-card text-foreground px-5 py-3 border-2 border-border hover:border-primary transition-colors flex items-center gap-2 font-bold tracking-wide disabled:opacity-50"><Download className="w-5 h-5" />EXPORTAR A EXCEL</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SLAM_STEPS.map(step => { const Icon = step.icon; return <div key={step.key} className={`bg-card border-2 ${step.color} p-5 flex gap-4 items-start hover:shadow-md transition-shadow`}><div className={`${step.iconBg} text-background p-3 shrink-0`}><Icon className="w-8 h-8" /></div><div><div className="flex items-baseline gap-2"><span className="text-2xl font-bold tracking-widest">{step.label}</span><span className="text-sm text-muted-foreground font-semibold">({step.sublabel})</span></div><p className="text-sm text-muted-foreground mt-1 leading-snug">{step.description}</p></div></div>; })}
          </div>
          <div className="mt-6 bg-card border-2 border-border p-4"><p className="text-sm text-muted-foreground">PRÁCTICAS REGISTRADAS</p><p className={loading || error ? 'text-base text-muted-foreground' : 'text-3xl font-bold'}>{loading ? 'Cargando...' : error ? 'Sin datos' : reports.length}</p></div>
        </>}

        {showForm && <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6"><button onClick={resetForm} className="hover:opacity-70"><ArrowLeft className="w-6 h-6" /></button><h2 className="text-2xl font-bold tracking-wide">PRÁCTICA DE SLAM</h2></div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-card border-2 border-border p-4 grid grid-cols-1 md:grid-cols-2 gap-4"><div><p className="text-xs font-bold uppercase text-muted-foreground mb-1">Nombre</p><p className="px-3 py-2 border-2 border-border bg-input-background">{editing?.nombre || username}</p></div><div><p className="text-xs font-bold uppercase text-muted-foreground mb-1">Fotografía</p><p className="px-3 py-2 border-2 border-border bg-input-background">{editing ? 'Opcional al editar' : 'Obligatoria'}</p></div></div>
            {SLAM_STEPS.map(step => { const Icon = step.icon; return <div key={step.key} className={`bg-card border-2 ${step.color} overflow-hidden`}><div className="flex"><div className={`${step.iconBg} text-background flex flex-col items-center justify-center px-4 py-4 min-w-[72px] shrink-0`}><Icon className="w-7 h-7 mb-1" /><span className="text-xs font-bold tracking-widest writing-vertical">{step.label}</span></div><div className="flex-1 p-4"><div className="flex items-baseline gap-2 mb-1"><span className="font-bold tracking-wider text-lg">{step.label}</span><span className="text-xs text-muted-foreground font-semibold uppercase">({step.sublabel})</span></div><p className="text-xs text-muted-foreground mb-3 leading-snug">{step.description}</p><label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Observaciones</label><textarea value={formData[step.key]} onChange={e => setFormData(prev => ({ ...prev, [step.key]: e.target.value }))} className="w-full px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary resize-none" rows={3} placeholder={`Registra tus observaciones de ${step.sublabel.toLowerCase()}...`} required /></div></div></div>; })}
            <div className="bg-card border-2 border-border p-4">
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-3">Adjuntar Archivo</label>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
              {archivo ? <div className="flex items-center gap-3 px-4 py-3 border-2 border-primary bg-primary/5"><Paperclip className="w-5 h-5 text-primary" /><span className="text-sm flex-1 truncate font-medium">{archivo.name}</span><span className="text-xs text-muted-foreground">{(archivo.size / 1024).toFixed(0)} KB</span><button type="button" onClick={() => { setArchivo(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}><X className="w-4 h-4" /></button></div> : <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-border hover:border-primary bg-input-background py-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground font-bold tracking-wide"><Paperclip className="w-5 h-5" />SELECCIONAR ARCHIVO</button>}
              {editing && !archivo && <div className="mt-3 space-y-2"><p className="text-xs text-muted-foreground">Imagen existente: {editing.archivo || 'Sin fotografía'}</p>{editing.archivoUrl && !failedImages[editing.id] ? <img src={editing.archivoUrl} alt={editing.archivo} onError={() => setFailedImages(prev => ({ ...prev, [editing.id]: true }))} className="w-full max-h-48 object-contain border-2 border-border bg-muted" /> : <div className="border-2 border-dashed border-border bg-muted p-6 text-center text-sm text-muted-foreground">La imagen no está disponible</div>}</div>}
            </div>
            <div className="flex gap-4 pt-2"><button type="submit" disabled={operationPending} className="flex-1 bg-destructive text-destructive-foreground py-3 border-2 border-destructive hover:bg-destructive/90 font-bold tracking-wide disabled:opacity-50">GUARDAR PRÁCTICA</button><button type="button" onClick={resetForm} className="flex-1 bg-secondary text-secondary-foreground py-3 border-2 border-secondary hover:bg-secondary/90 font-bold tracking-wide">CANCELAR</button></div>
          </form>
        </div>}

        {showHistory && <>
          <div className="mb-6 flex items-center justify-between"><div className="flex items-center gap-3"><button onClick={() => setShowHistory(false)} className="hover:opacity-70"><ArrowLeft className="w-6 h-6" /></button><h2 className="text-2xl font-bold tracking-wide">HISTORIAL DE PRÁCTICAS</h2></div><span className="text-muted-foreground text-sm">{loading ? 'Cargando...' : error ? 'Sin datos' : `${reports.length} registro(s)`}</span></div>
          {!loading && !error && reports.length === 0 && <div className="py-12 text-center text-muted-foreground">Sin prácticas registradas</div>}
          <div className="space-y-4">{!loading && !error && reports.map(report => { const tab = activeTab[report.id] ?? 'detalle'; return <div key={report.id} className="bg-card border-2 border-border overflow-hidden">
            <div className="bg-muted px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b-2 border-border"><div className="font-bold text-lg tracking-wide">{report.nombre}</div><div className="flex items-center gap-3 text-sm text-muted-foreground"><span>{report.fecha}</span><span>{report.hora}</span><button onClick={() => startEdit(report)} disabled={operationPending} className="p-1 hover:text-primary" title="Editar"><Edit className="w-4 h-4" /></button><button onClick={() => void handleDelete(report)} disabled={operationPending} className="p-1 hover:text-destructive" title="Eliminar"><Trash2 className="w-4 h-4" /></button></div></div>
            <div className="flex border-b-2 border-border"><button onClick={() => setActiveTab(prev => ({ ...prev, [report.id]: 'detalle' }))} className={`flex-1 py-2 text-sm font-bold tracking-wide ${tab === 'detalle' ? 'bg-card border-b-2 border-primary' : 'bg-muted text-muted-foreground'}`}>DETALLE</button><button onClick={() => setActiveTab(prev => ({ ...prev, [report.id]: 'archivo' }))} className={`flex-1 py-2 text-sm font-bold tracking-wide flex items-center justify-center gap-2 ${tab === 'archivo' ? 'bg-card border-b-2 border-primary' : 'bg-muted text-muted-foreground'}`}><Paperclip className="w-4 h-4" />ARCHIVO<span className="w-2 h-2 rounded-full bg-primary" /></button></div>
            {tab === 'detalle' ? <div className="grid grid-cols-1 md:grid-cols-2">{SLAM_STEPS.map((step, index) => { const Icon = step.icon; return <div key={step.key} className={`p-4 border-border ${index < 2 ? 'border-b-2' : ''} ${index % 2 === 0 ? 'md:border-r-2' : ''}`}><div className="flex items-center gap-2 mb-2"><div className={`${step.iconBg} text-background p-1`}><Icon className="w-4 h-4" /></div><span className="font-bold text-sm tracking-wider">{step.label}</span><span className="text-xs text-muted-foreground">({step.sublabel})</span></div><p className="text-sm text-muted-foreground leading-snug">{report[step.key]}</p></div>; })}</div> : report.archivoUrl && !failedImages[report.id] ? <div className="p-5 space-y-3"><div className="flex items-center gap-2 text-sm font-medium"><Paperclip className="w-4 h-4 text-primary" /><span className="truncate">{report.archivo}</span></div><img src={report.archivoUrl} alt={report.archivo} onError={() => setFailedImages(prev => ({ ...prev, [report.id]: true }))} className="w-full max-h-72 object-contain border-2 border-border bg-muted" /><a href={report.archivoUrl} download={report.archivo} className="flex items-center justify-center gap-2 w-full py-2 border-2 border-border hover:border-primary bg-card text-sm font-bold tracking-wide"><Download className="w-4 h-4" />DESCARGAR</a></div> : <div className="p-8 text-center text-sm text-muted-foreground">{report.archivoUrl ? 'La imagen no está disponible' : 'No se adjuntó ningún archivo en esta práctica'}</div>}
          </div>; })}</div>
        </>}
      </main>
    </div>
  );
}
```

### `frontend/src/services/SafetyModuleImpl.tsx`

```tsx
import { useEffect,useMemo,useRef,useState } from 'react';
import { ArrowLeft,Download,ImageIcon,Plus,X } from 'lucide-react';
import { ApiError } from './api';
import { createSafetyFinding,exportSafetyHistory,getSafetyFinding,listRecentSafetyFindings,listSafetyAreas,listSafetyHistory,loadSafetyEvidence,type SafetyArea,type SafetyFilters,type SafetyFinding,type SafetyPagination,type SafetyRisk } from './safety';
type View='areas'|'area'|'new'|'history'|'detail';
const empty:SafetyPagination={page:1,limit:20,total:0,total_pages:0,has_previous_page:false,has_next_page:false};
const colors:Record<SafetyRisk,string>={Bajo:'bg-green-600 text-white',Medio:'bg-yellow-400',Alto:'bg-orange-500 text-white',Critico:'bg-red-600 text-white'};
const label=(r:SafetyRisk)=>r==='Critico'?'Crítico':r;
const err=(e:unknown)=>e instanceof ApiError||e instanceof TypeError?e.message:'No fue posible completar la solicitud';
const dt=(v:string)=>{const [d='',t='']=String(v).replace(' ','T').split('T'),[y,m,day]=d.slice(0,10).split('-');return{d:y&&m&&day?`${day}/${m}/${y}`:d,t:t.slice(0,5)}};
function usePhotos(rows:SafetyFinding[]){const [urls,setUrls]=useState<Record<number,string>>({});useEffect(()=>{let live=true;const made:string[]=[];setUrls({});rows.forEach(async r=>{try{const u=URL.createObjectURL(await loadSafetyEvidence(r.ruta_foto));made.push(u);if(live)setUrls(x=>({...x,[r.id_hallazgo]:u}))}catch{}});return()=>{live=false;made.forEach(URL.revokeObjectURL)}},[rows]);return urls}
function Photo({src,onOpen}:{src?:string;onOpen:()=>void}){return src?<img onClick={e=>{e.stopPropagation();onOpen()}} src={src} alt="Evidencia" className="w-24 h-16 object-cover border cursor-zoom-in"/>:<div className="w-24 h-16 bg-muted border flex items-center justify-center"><ImageIcon/></div>}
function Box({name,value}:{name:string;value:string}){return <div><small className="font-bold uppercase">{name}</small><div className="border-2 bg-muted p-3">{value}</div></div>}
export default function SafetyModule({onBack}:{onBack:()=>void;username:string}){
 const [view,setView]=useState<View>('areas'),[areas,setAreas]=useState<SafetyArea[]>([]),[area,setArea]=useState<SafetyArea|null>(null),[rows,setRows]=useState<SafetyFinding[]>([]),[detail,setDetail]=useState<SafetyFinding|null>(null),[page,setPage]=useState(empty),[draft,setDraft]=useState<SafetyFilters>({}),[filters,setFilters]=useState<SafetyFilters>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[viewer,setViewer]=useState<string|null>(null);
 const [description,setDescription]=useState(''),[risk,setRisk]=useState<SafetyRisk|''>(''),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<string|null>(null);const input=useRef<HTMLInputElement>(null),photos=usePhotos(rows),detailRows=useMemo(()=>detail?[detail]:[],[detail]),detailPhoto=usePhotos(detailRows);
 const loadAreas=async()=>{setBusy(true);setError('');setAreas([]);try{setAreas(await listSafetyAreas())}catch(e){setError(err(e))}finally{setBusy(false)}},loadRecent=async(a:SafetyArea)=>{setBusy(true);setError('');setRows([]);try{setRows(await listRecentSafetyFindings(a.id_area))}catch(e){setError(err(e))}finally{setBusy(false)}},loadHistory=async(p:number,f:SafetyFilters)=>{if(!area)return;setBusy(true);setError('');setRows([]);setPage({...empty,page:p});try{const r=await listSafetyHistory(area.id_area,f,p,page.limit);setRows(r.hallazgos);setPage(r.paginacion)}catch(e){setError(err(e))}finally{setBusy(false)}};
 useEffect(()=>{loadAreas()},[]);useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
 const openDetail=async(id:number)=>{setBusy(true);setError('');setDetail(null);try{setDetail(await getSafetyFinding(id));setView('detail')}catch(e){setError(err(e))}finally{setBusy(false)}},pick=(f?:File)=>{if(!f)return;if(preview)URL.revokeObjectURL(preview);setFile(f);setPreview(URL.createObjectURL(f))},clearPhoto=()=>{if(preview)URL.revokeObjectURL(preview);setFile(null);setPreview(null);if(input.current)input.current.value=''};
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(!area||!file||!risk||!description.trim())return;setBusy(true);setError('');try{await createSafetyFinding(area.id_area,description,risk,file);setDescription('');setRisk('');clearPhoto();await Promise.all([loadRecent(area),loadAreas()]);setView('area')}catch(x){setError(err(x))}finally{setBusy(false)}};
 const exportFile=async()=>{if(!area)return;setBusy(true);setError('');try{const b=await exportSafetyHistory(area.id_area,filters),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`safety-${area.id_area}-${new Date().toISOString().slice(0,10)}.xlsx`;a.click();URL.revokeObjectURL(u)}catch(e){setError(err(e))}finally{setBusy(false)}};
 return <div className="min-h-screen bg-background [&_button.bg-secondary]:!text-white"><header className="bg-primary text-foreground px-6 py-4 shadow-md"><div className="flex items-center gap-4"><button type="button" onClick={onBack} aria-label="Regresar al menú principal" className="hover:opacity-70"><ArrowLeft className="w-8 h-8"/></button><div><h1 className="text-3xl font-bold tracking-wider">SAFETY</h1><p className="text-sm opacity-80">Hallazgos de Seguridad</p></div></div></header><main className="p-4 md:p-6">{error&&<div className="border-2 border-destructive bg-destructive/10 text-destructive p-3 mb-4">{error}</div>}
 {view==='areas'&&<><h2 className="text-2xl font-bold mb-6">SELECCIONE ÁREA</h2>{busy&&<p>Cargando áreas...</p>}{!busy&&!error&&areas.length===0&&<p className="text-muted-foreground">Sin datos disponibles</p>}<div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">{!busy&&!error&&areas.map(a=><button key={a.id_area} onClick={async()=>{setArea(a);setView('area');await loadRecent(a)}} className="border-2 bg-card p-6 hover:border-primary"><b>{a.nombre_area.toUpperCase()}</b><p className="text-sm text-muted-foreground">{a.total_hallazgos} hallazgo{a.total_hallazgos===1?'':'s'}</p></button>)}</div></>}
 {view==='area'&&<><div className="flex justify-between mb-5"><h2 className="text-2xl font-bold">SAFETY - {area?.nombre_area.toUpperCase()}</h2><button onClick={()=>setView('areas')} className="border-2 px-4">CAMBIAR ÁREA</button></div><div className="grid md:grid-cols-2 gap-4 mb-5"><button onClick={()=>setView('new')} className="bg-primary p-5 flex justify-center gap-2"><Plus/>AGREGAR HALLAZGO</button><button onClick={async()=>{setDraft({});setFilters({});setView('history');await loadHistory(1,{})}} className="bg-secondary p-5">HISTORIAL</button></div><h3 className="font-bold mb-3">ÚLTIMOS 10 HALLAZGOS</h3><div className="space-y-3">{!busy&&!error&&rows.map(r=>{const p=dt(r.fecha_hallazgo);return <button key={r.id_hallazgo} onClick={()=>openDetail(r.id_hallazgo)} className="w-full border-2 p-4 text-left flex gap-4"><Photo src={photos[r.id_hallazgo]} onOpen={()=>setViewer(photos[r.id_hallazgo])}/><div><p>{r.descripcion}</p><small>{p.d} · {p.t} · {r.nombre_usuario}</small><br/><span className={`px-2 text-xs ${colors[r.nivel_riesgo]}`}>{label(r.nivel_riesgo)}</span></div></button>})}{busy&&<p>Cargando...</p>}{!busy&&!error&&rows.length===0&&<p className="text-muted-foreground">Sin datos disponibles</p>}</div></>}
 {view==='new'&&<form onSubmit={save} className="max-w-2xl mx-auto border-2 p-6 space-y-4"><h2 className="text-2xl font-bold">NUEVO HALLAZGO</h2><Box name="Área" value={area?.nombre_area||''}/><div className="grid grid-cols-2 gap-3"><Box name="Fecha" value={new Date().toLocaleDateString('es-MX')}/><Box name="Hora" value={new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}/></div><textarea required value={description} onChange={e=>setDescription(e.target.value)} placeholder="Descripción obligatoria" className="w-full border-2 p-3"/><select required value={risk} onChange={e=>setRisk(e.target.value as SafetyRisk)} className="w-full border-2 p-3"><option value="">Seleccione riesgo</option>{(['Bajo','Medio','Alto','Critico'] as SafetyRisk[]).map(r=><option key={r} value={r}>{label(r)}</option>)}</select><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>pick(e.target.files?.[0])}/>{preview?<><img src={preview} alt="Vista previa" className="max-h-64 w-full object-cover"/><div className="flex gap-2"><button type="button" onClick={()=>input.current?.click()} className="border-2 p-2 flex-1">CAMBIAR</button><button type="button" onClick={clearPhoto} className="border-2 p-2 flex-1">QUITAR</button></div></>:<button type="button" onClick={()=>input.current?.click()} className="w-full border-2 border-dashed p-8">AGREGAR FOTO *</button>}<div className="flex gap-2"><button disabled={busy||!file||!risk||!description.trim()} className="bg-primary p-3 flex-1 disabled:opacity-50">GUARDAR</button><button type="button" onClick={()=>setView('area')} className="bg-secondary p-3 flex-1">CANCELAR</button></div></form>}
 {view==='history'&&<section className="mx-auto max-w-7xl"><div className="mb-5"><h2 className="text-2xl font-bold tracking-wide">HISTORIAL</h2><p className="text-sm text-muted-foreground">{area?.nombre_area}</p></div><div className="mb-5 rounded border-2 border-border bg-card p-4 shadow-sm md:p-5"><h3 className="mb-4 text-sm font-bold tracking-wide">FILTRAR REGISTROS</h3><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><label className="block text-xs font-bold uppercase text-muted-foreground">Fecha desde<input type="date" value={draft.fecha_desde||''} onChange={e=>setDraft(x=>({...x,fecha_desde:e.target.value||undefined}))} className="mt-1.5 h-11 w-full rounded border-2 border-border bg-background px-3 text-foreground outline-none focus:border-primary"/></label><label className="block text-xs font-bold uppercase text-muted-foreground">Fecha hasta<input type="date" value={draft.fecha_hasta||''} onChange={e=>setDraft(x=>({...x,fecha_hasta:e.target.value||undefined}))} className="mt-1.5 h-11 w-full rounded border-2 border-border bg-background px-3 text-foreground outline-none focus:border-primary"/></label><label className="block text-xs font-bold uppercase text-muted-foreground">Nivel de riesgo<select value={draft.nivel_riesgo||''} onChange={e=>setDraft(x=>({...x,nivel_riesgo:(e.target.value||undefined) as SafetyRisk|undefined}))} className="mt-1.5 h-11 w-full rounded border-2 border-border bg-background px-3 text-foreground outline-none focus:border-primary"><option value="">Todos</option><option>Bajo</option><option>Medio</option><option>Alto</option><option value="Critico">Crítico</option></select></label><label className="block text-xs font-bold uppercase text-muted-foreground">Búsqueda<input type="search" placeholder="Descripción o usuario" value={draft.busqueda||''} onChange={e=>setDraft(x=>({...x,busqueda:e.target.value||undefined}))} className="mt-1.5 h-11 w-full rounded border-2 border-border bg-background px-3 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"/></label></div><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><button type="button" onClick={async()=>{setFilters(draft);await loadHistory(1,draft)}} className="min-h-11 rounded border-2 border-primary bg-primary px-5 py-2 font-bold tracking-wide hover:bg-primary/90 sm:w-auto">FILTRAR</button><button type="button" onClick={async()=>{setDraft({});setFilters({});await loadHistory(1,{})}} className="min-h-11 rounded border-2 border-border bg-background px-5 py-2 font-bold tracking-wide hover:border-primary sm:w-auto">LIMPIAR FILTROS</button><button type="button" onClick={exportFile} className="flex min-h-11 items-center justify-center gap-2 rounded border-2 border-secondary bg-secondary px-5 py-2 font-bold tracking-wide hover:bg-secondary/90 sm:ml-auto sm:w-auto"><Download className="h-5 w-5"/>EXPORTAR</button></div></div><div className="overflow-hidden rounded border-2 border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead className="border-b-2 border-primary bg-muted"><tr>{['FECHA','HORA','USUARIO','DESCRIPCIÓN','RIESGO','EVIDENCIA'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-wide text-foreground">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{!busy&&!error&&rows.map(r=>{const p=dt(r.fecha_hallazgo);return <tr key={r.id_hallazgo} onClick={()=>openDetail(r.id_hallazgo)} className="cursor-pointer bg-card transition-colors hover:bg-muted/60"><td className="whitespace-nowrap px-4 py-3">{p.d}</td><td className="whitespace-nowrap px-4 py-3">{p.t}</td><td className="px-4 py-3">{r.nombre_usuario}</td><td className="max-w-md px-4 py-3">{r.descripcion}</td><td className="px-4 py-3"><span className={`inline-flex rounded px-2.5 py-1 text-xs font-bold ${colors[r.nivel_riesgo]}`}>{label(r.nivel_riesgo)}</span></td><td className="px-4 py-3"><Photo src={photos[r.id_hallazgo]} onOpen={()=>setViewer(photos[r.id_hallazgo])}/></td></tr>})}</tbody></table>{!busy&&!error&&rows.length===0&&<div className="px-4 py-12 text-center text-muted-foreground">No hay registros que coincidan con los filtros.</div>}</div></div>{!busy&&!error&&<nav aria-label="Paginación del historial" className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-between"><p className="text-center text-sm text-muted-foreground">{page.total} registro{page.total===1?'':'s'}</p><div className="flex max-w-full items-center justify-center gap-2"><button type="button" disabled={!page.has_previous_page} onClick={()=>loadHistory(page.page-1,filters)} className="min-h-10 rounded border-2 border-border bg-card px-3 py-2 text-sm font-bold transition-colors hover:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60">ANTERIOR</button><span aria-current="page" className="min-w-10 rounded border-2 border-primary bg-primary px-3 py-2 text-center text-sm font-bold">{page.total_pages?page.page:0}<span className="sr-only"> de {page.total_pages}</span></span><span className="hidden text-sm text-muted-foreground sm:inline">de {page.total_pages}</span><button type="button" disabled={!page.has_next_page} onClick={()=>loadHistory(page.page+1,filters)} className="min-h-10 rounded border-2 border-border bg-card px-3 py-2 text-sm font-bold transition-colors hover:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60">SIGUIENTE</button></div></nav>}</section>}
 {view==='detail'&&detail&&<div className="max-w-3xl mx-auto border-2 p-6"><h2 className="text-2xl font-bold mb-4">DETALLE DEL HALLAZGO</h2><div className="grid md:grid-cols-2 gap-3"><Box name="Área" value={detail.nombre_area}/><Box name="Usuario" value={detail.nombre_usuario}/><Box name="Fecha" value={dt(detail.fecha_hallazgo).d}/><Box name="Hora" value={dt(detail.fecha_hallazgo).t}/><div className="md:col-span-2"><Box name="Descripción" value={detail.descripcion}/></div><Box name="Riesgo" value={label(detail.nivel_riesgo)}/>{detailPhoto[detail.id_hallazgo]&&<img onClick={()=>setViewer(detailPhoto[detail.id_hallazgo])} src={detailPhoto[detail.id_hallazgo]} alt="Evidencia" className="max-h-96 cursor-zoom-in"/>}</div><button onClick={()=>setView('area')} className="w-full bg-secondary p-3 mt-4">CERRAR</button></div>}
 </main>{viewer&&<div onClick={()=>setViewer(null)} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"><X className="absolute top-6 right-6 text-white"/><img src={viewer} alt="Evidencia ampliada" className="max-w-full max-h-full"/></div>}</div>
}
```

### `frontend/src/app/components/ChangePasswordModule.tsx`

Archivo eliminado. No existe contenido final que anexar.
