import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { subscribeRows } from '../../services/supabaseData';
import { buildAdminTasks, taskSummary } from './operationalTasks';
import './Dashboard.css';

export function Dashboard() {
  const { profile, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [payroll, setPayroll] = useState([]);

  useEffect(() => subscribeRows('employees', setEmployees, { orderBy: 'name', ascending: true }), []);
  useEffect(() => subscribeRows('hrRequests', setRequests, { orderBy: 'createdAt', ascending: false }), []);
  useEffect(() => subscribeRows('documents', setDocuments, { orderBy: 'uploadedAt', ascending: false }), []);
  useEffect(() => subscribeRows('payroll', setPayroll, { orderBy: 'updatedAt', ascending: false }), []);

  const stats = useMemo(() => {
    const active = employees.filter((item) => item.status === 'Activo').length;
    const areas = new Set(employees.map((item) => item.area).filter(Boolean)).size;
    const pendingRequests = requests.filter((item) => item.status === 'Pendiente');
    const documentAlerts = documents.filter((item) => {
      if (!item.expiryDate) return false;
      const days = Math.ceil((new Date(`${item.expiryDate}T23:59:59`) - new Date()) / 86400000);
      return days <= 30;
    });
    return { active, areas, pendingRequests, documentAlerts };
  }, [employees, requests, documents]);

  const tasks = useMemo(
    () => buildAdminTasks({ employees, documents, requests, payroll }),
    [documents, employees, payroll, requests],
  );
  const operations = useMemo(() => taskSummary(tasks), [tasks]);

  const firstName = (profile?.displayName || user?.email || 'equipo').split(/[\s@]/)[0];

  return (
    <div className="page admin-dashboard-page">
      <section className="admin-hero">
        <div>
          <span className="portal-kicker"><Icon name="sparkles" size={16} /> Centro de personas</span>
          <h1>Hola, {firstName}</h1>
          <p>Tu operación de personas, documentos y solicitudes en una sola vista.</p>
        </div>
        <div className="admin-hero-date">
          <span>Hoy</span>
          <strong>{new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric' }).format(new Date())}</strong>
          <small>{new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date())}</small>
        </div>
      </section>

      <section className="portal-metrics admin-portal-metrics">
        <AdminMetric icon="users" label="Dotación activa" value={stats.active} detail={`${stats.areas} áreas registradas`} to="/colaboradores" tone="green" />
        <AdminMetric icon="calendar" label="Solicitudes pendientes" value={stats.pendingRequests.length} detail="Esperando revisión" to="/solicitudes" tone="amber" />
        <AdminMetric icon="alert" label="Alertas documentales" value={stats.documentAlerts.length} detail="Vencidos o por vencer" to="/expedientes" tone="red" />
        <AdminMetric
          icon="alert"
          label="Bandeja operativa"
          value={operations.total}
          detail={operations.critical ? `${operations.critical} críticos primero` : 'Sin tareas críticas'}
          to="/notificaciones"
          tone={operations.critical ? 'red' : 'blue'}
        />
      </section>

      <section className="admin-quick-strip" aria-label="Acciones administrativas rápidas">
        <div><strong>Acciones rápidas</strong><span>Atajos para la operación diaria</span></div>
        <Link to="/colaboradores"><Icon name="plus" size={16} /> Nuevo colaborador</Link>
        <Link to="/expedientes"><Icon name="upload" size={16} /> Subir documento</Link>
        <Link to="/remuneraciones"><Icon name="wallet" size={16} /> Preparar remuneraciones</Link>
        <Link to="/marcaje"><Icon name="camera" size={16} /> Abrir marcaje</Link>
      </section>

      <section className="admin-operations-summary" aria-label="Salud operativa de recursos humanos">
        <div className="admin-health-score">
          <span>
            <Icon name={operations.critical ? 'alert' : 'shield'} size={19} />
          </span>
          <div>
            <small>Salud operativa</small>
            <strong>{operations.health}%</strong>
          </div>
        </div>
        <div className="admin-health-progress" aria-label={`${operations.health}% de salud operativa`}>
          <i style={{ width: `${operations.health}%` }} />
        </div>
        <div className="admin-health-legend">
          <span className="critical"><i /> {operations.critical} críticas</span>
          <span className="high"><i /> {operations.high} prioritarias</span>
          <span className="medium"><i /> {operations.medium} preventivas</span>
        </div>
        <p>La bandeja ordena primero lo vencido y lo que lleva más tiempo esperando.</p>
      </section>

      <section className="admin-dashboard-grid">
        <article className="portal-panel admin-operation-panel">
          <div className="portal-panel-heading">
            <div><p className="eyebrow">Prioridades unificadas</p><h2>Bandeja operativa</h2></div>
            <Link to="/notificaciones">Ver centro de avisos</Link>
          </div>
          <div className="admin-task-list">
            {tasks.slice(0, 6).map((task) => (
              <Link className="admin-task-row" key={task.id} to={task.to}>
                <span className={`portal-activity-icon tone-${priorityTone(task.priority)}`}>
                  <Icon name={task.icon} size={18} />
                </span>
                <div>
                  <span className="admin-task-heading">
                    <strong>{task.title}</strong>
                    <small>{task.category}</small>
                  </span>
                  <p>{task.detail}</p>
                  <em>{task.reason}</em>
                </div>
                <span className={`admin-task-priority ${task.priority}`}>
                  {priorityLabel(task.priority)}
                </span>
                <span className="admin-task-action">{task.action} <Icon name="arrow" size={14} /></span>
              </Link>
            ))}
            {!tasks.length && <DashboardEmpty icon="check" text="No hay acciones pendientes. La operación está al día." />}
          </div>
        </article>

        <article className="portal-panel">
          <div className="portal-panel-heading">
            <div><p className="eyebrow">Equipo</p><h2>Colaboradores recientes</h2></div>
            <Link to="/colaboradores">Ver equipo</Link>
          </div>
          <div className="people-list admin-people-list">
            {employees.slice(0, 5).map((employee) => (
              <div className="person-row" key={employee.id}>
                <span className="avatar avatar-soft">{getInitials(employee.name)}</span>
                <span className="person-main">
                  <strong>{employee.name}</strong>
                  <small>{employee.position || 'Cargo por definir'} · {employee.area || 'Sin área'}</small>
                </span>
                <span className={`status-pill status-${slug(employee.status)}`}>{employee.status || 'Pendiente'}</span>
              </div>
            ))}
            {!employees.length && <DashboardEmpty icon="users" text="Aún no hay colaboradores registrados." />}
          </div>
        </article>
      </section>

      <section className="admin-insight-banner">
        <span><Icon name="shield" size={24} /></span>
        <div>
          <p className="eyebrow">Portal del trabajador</p>
          <h2>Más autonomía para el equipo, menos trabajo manual para RRHH.</h2>
          <p>Los colaboradores ahora pueden consultar documentos, liquidaciones, solicitudes y el directorio interno desde su propio espacio.</p>
        </div>
        <Link to="/expedientes">Revisar expedientes <Icon name="arrow" size={16} /></Link>
      </section>
    </div>
  );
}

function AdminMetric({ icon, label, value, detail, to, tone, compact = false }) {
  return (
    <Link className={`portal-metric-card portal-tone-${tone}`} to={to}>
      <span className="portal-metric-icon"><Icon name={icon} /></span>
      <div><p>{label}</p><strong className={compact ? 'compact' : ''}>{value}</strong><small>{detail}</small></div>
      <Icon name="arrow" size={16} />
    </Link>
  );
}

function DashboardEmpty({ icon, text }) {
  return <div className="portal-empty"><Icon name={icon} size={24} /><p>{text}</p></div>;
}

function getInitials(name = '') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—';
}

function slug(value = '') {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
}

function priorityTone(priority) {
  return { critical: 'red', high: 'amber', medium: 'blue' }[priority] || 'blue';
}

function priorityLabel(priority) {
  return { critical: 'Crítica', high: 'Prioritaria', medium: 'Preventiva' }[priority] || 'Revisar';
}
