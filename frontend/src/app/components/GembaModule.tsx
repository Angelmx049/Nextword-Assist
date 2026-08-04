import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, Download, Eye, Edit, Trash2, X, ChevronLeft, User, Car, Clock, MapPin, Star } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { ModulePagination, DEFAULT_PAGE_SIZE } from './ConfirmDialog';
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
  const [page, setPage] = useState(1);

  const [allRecords, setAllRecords] = useState<GembaRecord[]>([]);
  const [records, setRecords] = useState<GembaRecord[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [operationPending, setOperationPending] = useState(false);
  const submitPendingRef = useRef(false);
  const allRecordsRequestIdRef = useRef(0);
  const loadRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

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

  const loadAllRecords = useCallback(async () => {
    const requestId = ++allRecordsRequestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const nextRecords = await listGemba();
      if (isMountedRef.current && requestId === allRecordsRequestIdRef.current) setAllRecords(nextRecords);
    } catch (err) {
      if (!isMountedRef.current || requestId !== allRecordsRequestIdRef.current) return;
      setError(err instanceof ApiError || err instanceof TypeError ? err.message : 'No fue posible cargar Gemba Ride');
    } finally {
      if (isMountedRef.current && requestId === allRecordsRequestIdRef.current) setLoading(false);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setHistoryLoading(true);
    setError('');
    try {
      const nextRecords = await listGemba(currentFilters());
      if (isMountedRef.current && requestId === loadRequestIdRef.current) setRecords(nextRecords);
    }
    catch (err) {
      if (!isMountedRef.current || requestId !== loadRequestIdRef.current) return;
      setError(err instanceof ApiError || err instanceof TypeError ? err.message : 'No fue posible cargar Gemba Ride');
    }
    finally {
      if (isMountedRef.current && requestId === loadRequestIdRef.current) setHistoryLoading(false);
    }
  }, [currentFilters]);

  useEffect(() => { void loadAllRecords(); }, [loadAllRecords]);
  useEffect(() => { void loadRecords(); }, [loadRecords]);
  useEffect(() => () => { isMountedRef.current = false; }, []);
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
      await Promise.all([loadAllRecords(), loadRecords()]);
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
    try { await deleteGemba(deleteId); setShowConfirm(false); setDeleteId(null); await Promise.all([loadAllRecords(), loadRecords()]); }
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
  const pagedRecords = filteredRecords.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE);
  useEffect(() => { setPage(1); }, [filterCourier, filterFecha, filterEval]);
  const selectedCourierName = couriers.find(courier => courier.id === selectedCourier)?.nombre ?? '';

  return (
    <div className="min-h-screen bg-background">
      <header className="module-header bg-primary text-foreground py-4 shadow-md">
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

      <main className="module-page">
        {error && <div className="mb-4 border-2 border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {loading && !showHistory && <div className="mb-4 text-sm text-muted-foreground">Cargando datos de Gemba Ride...</div>}

        {/* Main menu */}
        {!showForm && !showHistory && (
          <>
            <h2 className="text-xl font-bold tracking-wide mb-2">SELECCIONE COURIER</h2>
            <p className="text-sm text-muted-foreground mb-6">Elige al courier para iniciar una nueva evaluación de recorrido</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              {couriers.map((courier) => {
                const count = allRecords.filter(r => r.idCourier === courier.id).length;
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
          <div className="w-[calc(100%_-_32px)] max-w-[680px] mx-auto mt-7">
            <div className="flex items-center mb-6">
              {editingId && (
                <button onClick={resetForm} className="mr-3 hover:opacity-70 transition-opacity">
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              <h2 className="text-2xl font-bold tracking-wide">
                {editingId ? 'EDITAR EVALUACIÓN' : 'NUEVA EVALUACIÓN'} — {selectedCourierName}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="w-full box-border bg-card border border-border shadow-sm p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Fecha</label>
                    <input type="date" value={formData.fecha}
                      onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                      className="w-full box-border px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Hora</label>
                    <input type="time" value={formData.hora}
                      onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                      className="w-full box-border px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary" required />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Número Económico</label>
                    <input type="text" value={formData.numeroEconomico} placeholder="VH-XXXX"
                      onChange={(e) => setFormData({ ...formData, numeroEconomico: e.target.value })}
                      className="w-full box-border px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Número de Paradas</label>
                    <input type="number" value={formData.numeroParadas}
                      onChange={(e) => setFormData({ ...formData, numeroParadas: parseInt(e.target.value) })}
                      className="w-full box-border px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary" required />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Tiempo Total</label>
                    <input type="text" value={formData.tiempoTotal} placeholder="4:30"
                      onChange={(e) => setFormData({ ...formData, tiempoTotal: e.target.value })}
                      className="w-full box-border px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Evaluación</label>
                    <select value={formData.evaluacion}
                      onChange={(e) => setFormData({ ...formData, evaluacion: e.target.value })}
                      className="w-full box-border px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary">
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
                    className="w-full h-[120px] box-border px-3 py-2 border-2 border-border bg-input-background focus:outline-none focus:border-primary resize-none"
                    rows={4} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button type="submit" disabled={operationPending} className="w-full bg-primary text-primary-foreground py-3 border-2 border-primary hover:bg-primary/90 transition-colors font-bold tracking-wide disabled:opacity-50">
                  {operationPending ? 'GUARDANDO...' : 'GUARDAR'}
                </button>
                <button type="button" onClick={resetForm} className="w-full bg-secondary text-secondary-foreground py-3 border-2 border-secondary hover:bg-secondary/90 transition-colors font-bold tracking-wide">
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
            <div className="mb-5 rounded border-2 border-border bg-card p-4 shadow-sm md:p-5">
              <h3 className="mb-4 text-sm font-bold tracking-wide">FILTRAR REGISTROS</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-xs font-bold uppercase text-muted-foreground">Courier
                  <select value={filterCourier} onChange={e => setFilterCourier(e.target.value)} className="mt-1.5 h-11 w-full rounded border-2 border-border bg-background px-3 text-foreground outline-none focus:border-primary">
                    <option value="">Todos</option>
                    {couriers.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold uppercase text-muted-foreground">Fecha
                  <input type="date" value={filterFecha} onChange={e => setFilterFecha(e.target.value)} className="mt-1.5 h-11 w-full rounded border-2 border-border bg-background px-3 text-foreground outline-none focus:border-primary" />
                </label>
                <label className="block text-xs font-bold uppercase text-muted-foreground">Evaluación
                  <select value={filterEval} onChange={e => setFilterEval(e.target.value)} className="mt-1.5 h-11 w-full rounded border-2 border-border bg-background px-3 text-foreground outline-none focus:border-primary">
                    <option value="">Todas</option>
                    <option value="Excelente">Excelente</option>
                    <option value="Bueno">Bueno</option>
                    <option value="Regular">Regular</option>
                    <option value="Necesita Mejora">Necesita Mejora</option>
                  </select>
                </label>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={() => setPage(1)} className="min-h-11 rounded border-2 border-primary bg-primary px-5 py-2 font-bold tracking-wide hover:bg-primary/90 sm:w-auto">FILTRAR</button>
                <button type="button" onClick={() => { setFilterCourier(''); setFilterFecha(''); setFilterEval(''); setPage(1); }} className="min-h-11 rounded border-2 border-border bg-background px-5 py-2 font-bold tracking-wide hover:border-primary sm:w-auto">LIMPIAR FILTROS</button>
              </div>
            </div>

            <div className="module-table-shell"><div className="module-table-scroll">
              <table className="module-table">
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
                  {!historyLoading && !error && filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">No se encontraron registros</td>
                    </tr>
                  ) : pagedRecords.map((record, idx) => (
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
            </div></div>
            {!historyLoading && !error && <ModulePagination page={page} totalItems={filteredRecords.length} onPageChange={setPage} />}
            {!historyLoading && !error && (
              <p className="text-xs text-muted-foreground mt-2">{filteredRecords.length} registro(s) encontrado(s)</p>
            )}
          </>
        )}
      </main>

      {/* View modal */}
      {viewRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border-2 border-border w-full max-w-2xl shadow-2xl">
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
