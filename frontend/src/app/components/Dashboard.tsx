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
