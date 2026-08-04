import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

export const DEFAULT_PAGE_SIZE = 8;

interface PaginationProps { page: number; totalItems: number; pageSize?: number; onPageChange: (page: number) => void }

export function ModulePagination({ page, totalItems, pageSize = DEFAULT_PAGE_SIZE, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalItems === 0 || totalPages <= 1) return null;
  return <nav className="module-pagination" aria-label="Paginación"><p>{totalItems} registro{totalItems === 1 ? '' : 's'}</p><div>
    <button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)}><ChevronLeft aria-hidden="true" /><span>ANTERIOR</span></button>
    <span className="module-pagination__status" aria-current="page">Página {page} de {totalPages}</span>
    <button type="button" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}><span>SIGUIENTE</span><ChevronRight aria-hidden="true" /></button>
  </div></nav>;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-card border-4 border-destructive max-w-xl w-full shadow-2xl">
        <div className="bg-destructive text-destructive-foreground px-6 py-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8" />
            <h2 className="text-2xl tracking-wide">{title}</h2>
          </div>
        </div>
        <div className="p-8 bg-card">
          <p className="text-lg mb-8 leading-relaxed">{message}</p>
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="flex-1 bg-muted text-foreground py-4 px-6 border-2 border-border hover:bg-border transition-colors"
            >
              CANCELAR
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 bg-destructive text-destructive-foreground py-4 px-6 border-2 border-destructive hover:bg-destructive/90 transition-colors"
            >
              ELIMINAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
