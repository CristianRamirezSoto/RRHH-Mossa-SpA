import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';

const Login = lazyNamed(() => import('./features/auth/Login'), 'Login');
const Dashboard = lazyNamed(() => import('./features/dashboard/Dashboard'), 'Dashboard');
const Employees = lazyNamed(() => import('./features/employees/Employees'), 'Employees');
const DigitalFile = lazyNamed(() => import('./features/documents/DigitalFile'), 'DigitalFile');
const Profile = lazyNamed(() => import('./features/profile/Profile'), 'Profile');
const Notifications = lazyNamed(() => import('./features/notifications/Notifications'), 'Notifications');
const Attendance = lazyNamed(() => import('./features/attendance/pages/Attendance'), 'Attendance');
const AttendanceRecords = lazyNamed(
  () => import('./features/attendance/pages/AttendanceRecords'),
  'AttendanceRecords',
);
const BiometricEnrollment = lazyNamed(
  () => import('./features/attendance/pages/BiometricEnrollment'),
  'BiometricEnrollment',
);
const Requests = lazyNamed(() => import('./features/requests/Requests'), 'Requests');
const Payroll = lazyNamed(() => import('./features/payroll/Payroll'), 'Payroll');
const WorkerHome = lazyNamed(() => import('./features/employee-portal/WorkerHome'), 'WorkerHome');
const EmployeeDirectory = lazyNamed(
  () => import('./features/employee-portal/EmployeeDirectory'),
  'EmployeeDirectory',
);
const WorkerPayments = lazyNamed(
  () => import('./features/employee-portal/WorkerPayments'),
  'WorkerPayments',
);
const AccountManagement = lazyNamed(
  () => import('./features/account-management/AccountManagement'),
  'AccountManagement',
);

function lazyNamed(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<div className="screen-center">Cargando…</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={(
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              )}
            >
              <Route path="/panel" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/colaboradores" element={<AdminRoute><Employees /></AdminRoute>} />
              <Route path="/marcaje" element={<AdminRoute><Attendance /></AdminRoute>} />
              <Route path="/terminal/marcaje" element={<AdminRoute><Attendance terminalMode /></AdminRoute>} />
              <Route path="/asistencia" element={<AdminRoute><AttendanceRecords /></AdminRoute>} />
              <Route path="/biometria" element={<AdminRoute><BiometricEnrollment /></AdminRoute>} />
              <Route path="/biometria/:employeeId" element={<AdminRoute><BiometricEnrollment /></AdminRoute>} />
              <Route path="/remuneraciones" element={<AdminRoute><Payroll /></AdminRoute>} />
              <Route path="/expedientes" element={<AdminRoute><DigitalFile /></AdminRoute>} />
              <Route path="/expedientes/:employeeId" element={<AdminRoute><DigitalFile /></AdminRoute>} />
              <Route path="/cuentas" element={<AdminRoute><AccountManagement /></AdminRoute>} />

              <Route path="/inicio" element={<EmployeeRoute><WorkerHome /></EmployeeRoute>} />
              <Route path="/personas" element={<EmployeeRoute><EmployeeDirectory /></EmployeeRoute>} />
              <Route path="/mis-pagos" element={<EmployeeRoute><WorkerPayments /></EmployeeRoute>} />
              <Route path="/expediente" element={<DigitalFile />} />

              <Route path="/solicitudes" element={<Requests />} />
              <Route path="/notificaciones" element={<Notifications />} />
              <Route path="/perfil" element={<Profile />} />
            </Route>
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

function AdminRoute({ children }) {
  const { profile } = useAuth();
  if (!profile) return <div className="screen-center">Verificando permisos…</div>;
  return profile.role === 'admin' ? children : <Navigate to="/inicio" replace />;
}

function EmployeeRoute({ children }) {
  const { profile } = useAuth();
  if (!profile) return <div className="screen-center">Verificando permisos…</div>;
  return profile.role === 'admin' ? <Navigate to="/panel" replace /> : children;
}

function HomeRedirect() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="screen-center">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <div className="screen-center">Cargando…</div>;
  return <Navigate to={profile.role === 'admin' ? '/panel' : '/inicio'} replace />;
}
