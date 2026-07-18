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
        className="h-full w-full max-w-lg bg-card text-foreground shadow-2xl flex flex-col"
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
