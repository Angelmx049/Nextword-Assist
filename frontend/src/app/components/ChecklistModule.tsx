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
