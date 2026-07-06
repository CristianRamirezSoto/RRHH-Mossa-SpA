import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="screen-center">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
