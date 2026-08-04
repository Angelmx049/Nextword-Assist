import { useState, useRef, useEffect, useCallback } from 'react';
import { ModulePagination, DEFAULT_PAGE_SIZE } from './ConfirmDialog';
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
        className={`module-control w-full text-left flex items-center justify-between transition-colors ${open ? 'border-primary' : 'border-border hover:border-primary/60'}`}
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
  const [page, setPage] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const loadRequestIdRef = useRef(0);
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
    evento: '',
    operador: username,
    observaciones: ''
  });
  useEffect(() => { setPage(1); }, [searchTerm, filterDate]);
  const pagedRecords = records.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE);

  const loadRecords = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const nextRecords = await listMC({ operador: searchTerm, fecha: filterDate });
      if (requestId === loadRequestIdRef.current) setRecords(nextRecords);
    } catch (err) {
      if (requestId === loadRequestIdRef.current) {
        setError(err instanceof ApiError ? err.message : 'No fue posible cargar los registros MC');
      }
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
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
      link.download = `reporte_mc_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      <header className="module-header bg-primary text-foreground py-4 shadow-md">
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

      <main className="module-page">
        {!showForm ? (
          <>
            <div className="module-actions">
              <button
                onClick={() => setShowForm(true)}
                className="module-button bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              >
                <Plus className="w-5 h-5" />
                NUEVO REGISTRO
              </button>
              <button onClick={handleExport} disabled={operation !== null} className="module-button bg-card text-foreground border-border hover:border-primary">
                <Download className="w-5 h-5" />
                {operation === 'export' ? 'EXPORTANDO...' : 'EXPORTAR'}
              </button>
            </div>

            <div className="module-filter-panel">
              <div className="module-filter-grid">
                <div className="w-full">
                  <label className="module-field-label">Operador</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Filtrar por operador..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="module-control module-search-control"
                    />
                  </div>
                </div>
                <div className="w-full">
                  <label className="module-field-label">Fecha</label>
                  <DatePicker value={filterDate} onChange={setFilterDate} />
                </div>
              </div>
            </div>

            {error && <div className="mb-6 border-2 border-destructive p-4 text-destructive">{error}</div>}

            <div className="module-table-shell"><div className="module-table-scroll">
              <table className="module-table">
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
                  {pagedRecords.map((record, idx) => (
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
            </div></div>
            {!loading && !error && <ModulePagination page={page} totalItems={records.length} onPageChange={setPage} />}
          </>
        ) : (
          <div className="w-[calc(100%_-_32px)] max-w-[700px] mx-auto mt-6">
            <form onSubmit={handleSubmit}>
              <div className="bg-card border border-border shadow-sm p-5 md:p-6 space-y-4">
                <h2 className="text-2xl mb-6">
                  {editingId ? 'EDITAR REGISTRO' : 'NUEVO REGISTRO'}
                </h2>
                {error && <div className="mb-4 border-2 border-destructive p-4 text-destructive">{error}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="w-full h-[120px] px-4 py-3 border-2 border-border bg-input-background focus:outline-none focus:border-primary resize-none"
                    rows={4}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <button
                  type="submit"
                  disabled={operation !== null}
                  className="w-full bg-primary text-primary-foreground py-3 border-2 border-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {operation === 'save' ? 'GUARDANDO...' : 'GUARDAR'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full bg-secondary text-secondary-foreground py-3 border-2 border-secondary hover:bg-secondary/90"
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
