import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { subscribeRows } from '../../services/supabaseData';
import { requiredDocumentStatus } from '../documents/documentCatalog';
import './WorkerHome.css';

export function WorkerHome() {
  const { user, profile } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const email = user.email.toLowerCase();

  useEffect(() => subscribeRows('employees', (rows) => setEmployee(rows[0] || null), {
    filters: [['email', email]],
    orderBy: 'name',
    ascending: true,
  }), [email]);

  useEffect(() => subscribeRows('documents', setDocuments, {
    filters: [['ownerEmail', email]],
    orderBy: 'uploadedAt',
    ascending: false,
  }), [email]);

  useEffect(() => subscribeRows('hrRequests', setRequests, {
    filters: [['ownerEmail', email]],
    orderBy: 'createdAt',
    ascending: false,
  }), [email]);

  useEffect(() => subscribeRows('payroll', setPayroll, {
    filters: [['ownerEmail', email]],
    orderBy: 'updatedAt',
    ascending: false,
  }), [email]);

  useEffect(() => subscribeRows('notifications', setNotifications, {
    filters: [['ownerEmail', email]],
    orderBy: 'createdAt',
    ascending: false,
  }), [email]);

  const documentStatus = useMemo(() => requiredDocumentStatus(documents), [documents]);
  const documentProgress = documentStatus.completion;

  const pendingRequests = requests.filter((item) => item.status === 'Pendiente');
  const unreadNotifications = notifications.filter((item) => !item.read);
  const latestPayment = payroll.find((item) => ['Pendiente pago', 'Pagado'].includes(item.status));
  const firstName = (employee?.name || profile?.displayName || user.email).split(/[\s@]/)[0];
  const selfServiceSteps = useMemo(() => [
    {
      id: 'employee',
      title: 'Ficha laboral vinculada',
      detail: employee ? `${employee.position || 'Cargo por completar'} · ${employee.area || 'Área por completar'}` : 'Tu cuenta aún no está asociada a una ficha.',
      ready: Boolean(employee),
      to: '/ayuda',
      action: 'Cómo resolverlo',
    },
    {
      id: 'profile',
      title: 'Perfil personal actualizado',
      detail: profile?.displayName ? 'Tu nombre visible está configurado.' : 'Completa tu nombre y datos visibles.',
      ready: Boolean(profile?.displayName?.trim()),
      to: '/perfil',
      action: 'Completar perfil',
    },
    {
      id: 'documents',
      title: 'Carpeta documental completa',
      detail: documentStatus.missing.length
        ? `Faltan ${documentStatus.missing.length} documentos obligatorios.`
        : 'Todos tus documentos obligatorios están disponibles.',
      ready: documentStatus.missing.length === 0,
      to: '/expediente',
      action: 'Revisar carpeta',
    },
    {
      id: 'notifications',
      title: 'Novedades revisadas',
      detail: unreadNotifications.length
        ? `Tienes ${unreadNotifications.length} avisos pendientes de lectura.`
        : 'No tienes avisos pendientes.',
      ready: unreadNotifications.length === 0,
      to: '/notificaciones',
      action: 'Ver novedades',
    },
  ], [documentStatus.missing.length, employee, profile?.displayName, unreadNotifications.length]);
  const selfServiceProgress = Math.round(
    (selfServiceSteps.filter((step) => step.ready).length / selfServiceSteps.length) * 100,
  );

  const activity = useMemo(() => [
    ...documents.slice(0, 2).map((item) => ({
      id: `document-${item.id}`,
      icon: 'file',
      title: item.category,
      detail: item.fileName,
      date: item.uploadedAt,
      tone: 'green',
    })),
    ...requests.slice(0, 2).map((item) => ({
      id: `request-${item.id}`,
      icon: 'calendar',
      title: `${item.type} · ${item.status}`,
      detail: `${formatDate(item.fromDate)} al ${formatDate(item.toDate)}`,
      date: item.updatedAt || item.createdAt,
      tone: item.status === 'Aprobada' ? 'green' : item.status === 'Rechazada' ? 'red' : 'amber',
    })),
    ...notifications.slice(0, 2).map((item) => ({
      id: `notification-${item.id}`,
      icon: 'bell',
      title: item.title,
      detail: item.message,
      date: item.createdAt,
      tone: 'blue',
    })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5), [documents, requests, notifications]);

  return (
    <div className="page employee-portal-page">
      <section className="employee-welcome">
        <div className="employee-welcome-copy">
          <span className="portal-kicker"><Icon name="sparkles" size={16} /> Tu espacio personal</span>
          <h1>Hola, {firstName}</h1>
          <p>Todo lo importante de tu trabajo, ordenado y disponible cuando lo necesites.</p>
          <div className="employee-welcome-actions">
            <Link className="portal-primary-action" to="/solicitudes">
              <Icon name="plus" size={17} /> Nueva solicitud
            </Link>
            <Link className="portal-secondary-action" to="/expediente">
              Ver mis documentos <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
        <div className="employee-role-card">
          <span className="employee-role-avatar">{initials(employee?.name || profile?.displayName || user.email)}</span>
          <div>
            <span>Mi información laboral</span>
            <strong>{employee?.position || 'Cargo por confirmar'}</strong>
            <small>{employee?.area || 'Área por confirmar'}{employee?.workLocation ? ` · ${employee.workLocation}` : ''}</small>
          </div>
        </div>
      </section>

      {!employee && (
        <section className="portal-notice warning">
          <Icon name="alert" />
          <div>
            <strong>Falta vincular tu ficha laboral</strong>
            <p>La ficha debe usar el correo {user.email}. Revisa la guía antes de pedir asistencia.</p>
            <Link to="/ayuda">Ver cómo resolverlo <Icon name="arrow" size={13} /></Link>
          </div>
        </section>
      )}

      <section className="portal-metrics" aria-label="Resumen personal">
        <MetricCard
          icon="folder"
          label="Documentos"
          value={documents.length}
          detail={`${documentProgress}% de carpeta obligatoria`}
          progress={documentProgress}
          to="/expediente"
          tone="green"
        />
        <MetricCard
          icon="calendar"
          label="Solicitudes pendientes"
          value={pendingRequests.length}
          detail={pendingRequests.length ? 'En revisión por RRHH' : 'Todo está al día'}
          to="/solicitudes"
          tone="amber"
        />
        <MetricCard
          icon="wallet"
          label="Última liquidación"
          value={latestPayment ? formatPeriod(latestPayment.period) : '—'}
          detail={latestPayment?.status || 'Sin liquidaciones liberadas'}
          to="/mis-pagos"
          tone="blue"
          compact
        />
        <MetricCard
          icon="bell"
          label="Novedades"
          value={unreadNotifications.length}
          detail={unreadNotifications.length ? 'Notificaciones sin leer' : 'No tienes novedades'}
          to="/notificaciones"
          tone="purple"
        />
      </section>

      <section className="worker-self-service-grid" aria-label="Ruta de autoservicio">
        <article className="portal-panel worker-roadmap">
          <div className="portal-panel-heading worker-roadmap-heading">
            <div>
              <p className="eyebrow">Tu ruta al día</p>
              <h2>Completa lo necesario sin seguimientos por correo</h2>
            </div>
            <strong>{selfServiceProgress}%</strong>
          </div>
          <span className="worker-roadmap-progress" aria-label={`${selfServiceProgress}% completado`}>
            <i style={{ width: `${selfServiceProgress}%` }} />
          </span>
          <div className="worker-roadmap-list">
            {selfServiceSteps.map((step, index) => (
              <div className={`worker-roadmap-step${step.ready ? ' ready' : ''}`} key={step.id}>
                <span>{step.ready ? <Icon name="check" size={15} /> : index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </div>
                {!step.ready && <Link to={step.to}>{step.action} <Icon name="arrow" size={13} /></Link>}
              </div>
            ))}
          </div>
        </article>

        <article className="worker-help-card">
          <span><Icon name="help" size={22} /></span>
          <p className="eyebrow">Respuestas rápidas</p>
          <h2>Resuelve primero desde tu portal</h2>
          <p>Encuentra pasos para documentos, solicitudes, liquidaciones, acceso y datos de tu ficha.</p>
          <Link to="/ayuda">Ir al centro de ayuda <Icon name="arrow" size={15} /></Link>
        </article>
      </section>

      <section className="portal-section">
        <div className="portal-section-heading">
          <div>
            <p className="eyebrow">Autoservicio</p>
            <h2>¿Qué necesitas hacer?</h2>
          </div>
        </div>
        <div className="quick-actions-grid">
          <QuickAction to="/expediente" icon="folder" title="Mis documentos" text="Contratos, certificados y antecedentes laborales." />
          <QuickAction to="/solicitudes" icon="calendar" title="Pedir vacaciones o permiso" text="Crea una solicitud y revisa su estado." />
          <QuickAction to="/mis-pagos" icon="wallet" title="Mis liquidaciones" text="Consulta periodos liberados y comprobantes." />
          <QuickAction to="/personas" icon="users" title="Directorio del equipo" text="Encuentra personas por área, cargo o sede." />
        </div>
      </section>

      <section className="portal-content-grid">
        <article className="portal-panel">
          <div className="portal-panel-heading">
            <div>
              <p className="eyebrow">Actividad</p>
              <h2>Lo más reciente</h2>
            </div>
            <Link to="/notificaciones">Ver novedades</Link>
          </div>
          <div className="portal-activity-list">
            {activity.map((item) => (
              <div className="portal-activity-item" key={item.id}>
                <span className={`portal-activity-icon tone-${item.tone}`}><Icon name={item.icon} size={18} /></span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail || 'Sin detalle adicional'}</p>
                </div>
                <time>{formatRelativeDate(item.date)}</time>
              </div>
            ))}
            {!activity.length && <PortalEmpty icon="bell" text="Cuando tengas documentos, solicitudes o novedades aparecerán aquí." />}
          </div>
        </article>

        <article className="portal-panel portal-support-card">
          <span className="portal-support-icon"><Icon name="shield" size={24} /></span>
          <p className="eyebrow">Tu información</p>
          <h2>Privada y bajo tu control</h2>
          <p>Solo tú y las personas autorizadas de RRHH pueden acceder a tus documentos y liquidaciones.</p>
          <Link to="/perfil">Revisar mi perfil <Icon name="arrow" size={15} /></Link>
        </article>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, progress, to, tone, compact = false }) {
  return (
    <Link className={`portal-metric-card portal-tone-${tone}`} to={to}>
      <span className="portal-metric-icon"><Icon name={icon} /></span>
      <div>
        <p>{label}</p>
        <strong className={compact ? 'compact' : ''}>{value}</strong>
        <small>{detail}</small>
        {typeof progress === 'number' && <span className="portal-progress"><i style={{ width: `${progress}%` }} /></span>}
      </div>
      <Icon name="arrow" size={16} />
    </Link>
  );
}

function QuickAction({ to, icon, title, text }) {
  return (
    <Link className="quick-action-card" to={to}>
      <span><Icon name={icon} /></span>
      <div><strong>{title}</strong><p>{text}</p></div>
      <Icon name="arrow" size={17} />
    </Link>
  );
}

function PortalEmpty({ icon, text }) {
  return <div className="portal-empty"><Icon name={icon} size={24} /><p>{text}</p></div>;
}

function initials(name = '') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`));
}

function formatPeriod(value = '') {
  if (!/^\d{4}-\d{2}$/.test(value)) return value || '—';
  const [year, month] = value.split('-');
  return new Intl.DateTimeFormat('es-CL', { month: 'short', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1, 1));
}

function formatRelativeDate(value) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(date);
}
