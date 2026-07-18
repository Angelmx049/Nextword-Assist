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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-[calc(100%_-_32px)] max-w-[440px] bg-card border-2 border-border px-8 pt-8 pb-9 shadow-xl">
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

        <form onSubmit={handleSubmit} className="w-full space-y-6">
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
