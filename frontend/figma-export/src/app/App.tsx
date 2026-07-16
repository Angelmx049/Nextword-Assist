import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import EMCModule from './components/EMCModule';
import GembaModule from './components/GembaModule';
import ChecklistModule from './components/ChecklistModule';
import SlamModule from './components/SlamModule';
import SafetyModule from '../services/SafetyModuleImpl';
import ChangePasswordModule from './components/ChangePasswordModule';
import { getSession, logout } from '../services/auth';
import type { AuthSession } from '../services/session';

const MODULE_PATHS: Record<string, string> = {
  emc: '/mc',
  gemba: '/gemba-ride',
  checklist: '/checklist',
  slam: '/slam',
  safety: '/safety',
  password: '/password'
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
        <Route
          path="/password"
          element={<ChangePasswordModule onBack={handleBackToDashboard} username={username} />}
        />
      </Route>

      <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
