import { Navigate, Outlet } from 'react-router-dom';
import { useLms } from '../lib/LmsContext';

export function ProtectedRoute() {
  const { session } = useLms();
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}
