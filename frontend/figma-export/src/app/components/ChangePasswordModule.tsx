import { useState } from 'react';
import { ArrowLeft, KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface ChangePasswordModuleProps {
  onBack: () => void;
  username: string;
}

export default function ChangePasswordModule({ onBack, username }: ChangePasswordModuleProps) {
  const [formData, setFormData] = useState({
    current: '',
    newPass: '',
    confirm: '',
  });
  const [show, setShow] = useState({ current: false, newPass: false, confirm: false });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const toggleShow = (field: 'current' | 'newPass' | 'confirm') => {
    setShow(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const rules = [
    { label: 'Mínimo 8 caracteres', pass: formData.newPass.length >= 8 },
    { label: 'Al menos una mayúscula', pass: /[A-Z]/.test(formData.newPass) },
    { label: 'Al menos un número', pass: /[0-9]/.test(formData.newPass) },
    { label: 'Las contraseñas coinciden', pass: formData.newPass !== '' && formData.newPass === formData.confirm },
  ];

  const allValid = rules.every(r => r.pass) && formData.current !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    setError('');
    setSuccess(true);
    setFormData({ current: '', newPass: '', confirm: '' });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-foreground px-6 py-4 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-8 h-8" />
          </button>
          <div>
            <h1 className="text-3xl tracking-wider font-bold">CONTRASEÑA</h1>
            <p className="text-sm opacity-80">Cambio de contraseña de acceso</p>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 flex justify-center">
        <div className="w-full max-w-md">

          {/* User info */}
          <div className="bg-card border-2 border-border px-5 py-4 mb-6 flex items-center gap-4">
            <div className="bg-secondary text-secondary-foreground w-12 h-12 flex items-center justify-center shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Usuario</p>
              <p className="text-lg font-semibold tracking-wide">{username}</p>
            </div>
          </div>

          {success ? (
            <div className="bg-card border-2 border-primary p-8 text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-primary mx-auto" />
              <h2 className="text-2xl font-bold tracking-wide">CONTRASEÑA ACTUALIZADA</h2>
              <p className="text-muted-foreground">Tu contraseña ha sido cambiada exitosamente.</p>
              <button
                onClick={() => setSuccess(false)}
                className="mt-4 bg-secondary text-secondary-foreground px-8 py-3 border-2 border-secondary hover:bg-secondary/90 transition-colors font-bold tracking-wide"
              >
                CAMBIAR OTRA VEZ
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current password */}
              <div className="bg-card border-2 border-border p-5 space-y-4">
                <h2 className="text-sm font-bold uppercase text-muted-foreground tracking-widest border-b border-border pb-2">
                  Contraseña Actual
                </h2>
                <PasswordField
                  label="Contraseña actual"
                  value={formData.current}
                  onChange={(v) => setFormData({ ...formData, current: v })}
                  visible={show.current}
                  onToggle={() => toggleShow('current')}
                  placeholder="Ingresa tu contraseña actual"
                />
              </div>

              {/* New password */}
              <div className="bg-card border-2 border-border p-5 space-y-4">
                <h2 className="text-sm font-bold uppercase text-muted-foreground tracking-widest border-b border-border pb-2">
                  Nueva Contraseña
                </h2>
                <PasswordField
                  label="Nueva contraseña"
                  value={formData.newPass}
                  onChange={(v) => setFormData({ ...formData, newPass: v })}
                  visible={show.newPass}
                  onToggle={() => toggleShow('newPass')}
                  placeholder="Ingresa la nueva contraseña"
                />
                <PasswordField
                  label="Confirmar contraseña"
                  value={formData.confirm}
                  onChange={(v) => setFormData({ ...formData, confirm: v })}
                  visible={show.confirm}
                  onToggle={() => toggleShow('confirm')}
                  placeholder="Repite la nueva contraseña"
                />

                {/* Rules */}
                <div className="space-y-2 pt-1">
                  {rules.map((rule) => (
                    <div key={rule.label} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${rule.pass ? 'bg-primary' : 'bg-border'}`} />
                      <span className={`text-sm transition-colors ${rule.pass ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-destructive text-sm font-semibold px-1">{error}</p>
              )}

              <div className="flex gap-4 pt-1">
                <button
                  type="submit"
                  disabled={!allValid}
                  className="flex-1 bg-primary text-foreground py-3 border-2 border-primary hover:bg-primary/90 transition-colors font-bold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ACTUALIZAR CONTRASEÑA
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 bg-secondary text-secondary-foreground py-3 border-2 border-secondary hover:bg-secondary/90 transition-colors font-bold tracking-wide"
                >
                  CANCELAR
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-12 border-2 border-border bg-input-background focus:outline-none focus:border-primary transition-colors"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
