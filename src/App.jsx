import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { DigitalFile } from './pages/DigitalFile';
import { Profile } from './pages/Profile';
import { Notifications } from './pages/Notifications';
import { Attendance } from './pages/Attendance';
import { AttendanceRecords } from './pages/AttendanceRecords';
import { BiometricEnrollment } from './pages/BiometricEnrollment';
import { Requests } from './pages/Requests';
import { Payroll } from './pages/Payroll';
import { useAuth } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/panel" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/colaboradores" element={<AdminRoute><Employees /></AdminRoute>} />
            <Route path="/marcaje" element={<AdminRoute><Attendance /></AdminRoute>} />
            <Route path="/terminal/marcaje" element={<AdminRoute><Attendance terminalMode /></AdminRoute>} />
            <Route path="/asistencia" element={<AdminRoute><AttendanceRecords /></AdminRoute>} />
            <Route path="/biometria" element={<AdminRoute><BiometricEnrollment /></AdminRoute>} />
            <Route path="/biometria/:employeeId" element={<AdminRoute><BiometricEnrollment /></AdminRoute>} />
            <Route path="/solicitudes" element={<Requests />} />
            <Route path="/remuneraciones" element={<AdminRoute><Payroll /></AdminRoute>} />
            <Route path="/expediente" element={<DigitalFile />} />
            <Route path="/expedientes" element={<AdminRoute><DigitalFile /></AdminRoute>} />
            <Route path="/expedientes/:employeeId" element={<AdminRoute><DigitalFile /></AdminRoute>} />
            <Route path="/notificaciones" element={<Notifications />} />
            <Route path="/perfil" element={<Profile />} />
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function AdminRoute({ children }) {
  const { profile } = useAuth();
  if (!profile) return <div className="screen-center">Verificando permisos…</div>;
  return profile?.role === 'admin' ? children : <Navigate to="/expediente" replace />;
}

function HomeRedirect() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="screen-center">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <div className="screen-center">Cargando…</div>;
  return <Navigate to={profile.role === 'admin' ? '/panel' : '/expediente'} replace />;
}
