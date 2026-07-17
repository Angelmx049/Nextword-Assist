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
