import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/AppLayout';
import { documentTypes } from './DigitalFile';
import { subscribeRows, updateRow } from '../services/supabaseData';

const filters = ['Accion requerida', 'Documentos', 'Solicitudes', 'Remuneraciones', 'Biometria', 'Sistema', 'Leidas'];
const severityRank = { danger: 0, warning: 1, info: 2, success: 3 };

export function Notifications() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin';
  const [storedNotifications, setStoredNotifications] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [filter, setFilter] = useState('Accion requerida');
  const [pushStatus, setPushStatus] = useState('');

  useEffect(() => {
    return subscribeRows('notifications', setStoredNotifications, {
      filters: isAdmin ? [] : [['ownerEmail', user.email.toLowerCase()]],
      orderBy: 'createdAt',
      ascending: false,
    });
  }, [isAdmin, user.email]);

  useEffect(() => {
    return subscribeRows('employees', setEmployees, {
      filters: isAdmin ? [] : [['email', user.email.toLowerCase()]],
      orderBy: 'name',
      ascending: true,
    });
  }, [isAdmin, user.email]);

  useEffect(() => {
    return subscribeRows('documents', setDocuments, {
      filters: isAdmin ? [] : [['ownerEmail', user.email.toLowerCase()]],
      orderBy: 'uploadedAt',
      ascending: false,
    });
  }, [isAdmin, user.email]);

  useEffect(() => {
    return subscribeRows('hrRequests', setRequests, {
      filters: isAdmin ? [] : [['ownerEmail', user.email.toLowerCase()]],
      orderBy: 'createdAt',
      ascending: false,
    });
  }, [isAdmin, user.email]);

  useEffect(() => {
    return subscribeRows('payroll', setPayroll, {
      filters: isAdmin ? [] : [['ownerEmail', user.email.toLowerCase()]],
      orderBy: 'updatedAt',
      ascending: false,
    });
  }, [isAdmin, user.email]);

  const items = useMemo(() => {
    const generated = [
      ...documentAlerts(employees, documents, isAdmin),
      ...requestAlerts(requests, isAdmin),
      ...payrollAlerts(payroll, isAdmin),
      ...biometricAlerts(employees, isAdmin),
    ];
    const stored = storedNotifications.map((item) => ({
      ...item,
      source: 'Sistema',
      actionLabel: item.link ? 'Abrir' : 'Revisar',
      generated: false,
      createdAt: item.createdAt || new Date().toISOString(),
    }));
    return [...generated, ...stored].sort((a, b) => {
      const severity = (severityRank[a.severity || 'info'] ?? 2) - (severityRank[b.severity || 'info'] ?? 2);
      if (severity) return severity;
      return timestampValue(b.createdAt) - timestampValue(a.createdAt);
    });
  }, [employees, documents, isAdmin, payroll, requests, storedNotifications]);

  const visibleItems = useMemo(() => items.filter((item) => {
    if (filter === 'Leidas') return item.read;
    if (filter === 'Accion requerida') return !item.read && item.requiresAction;
    return item.source === filter && !item.read;
  }), [items, filter]);

  const totals = useMemo(() => ({
    action: items.filter((item) => !item.read && item.requiresAction).length,
    danger: items.filter((item) => !item.read && item.severity === 'danger').length,
    warning: items.filter((item) => !item.read && item.severity === 'warning').length,
    allUnread: items.filter((item) => !item.read).length,
  }), [items]);

  async function openNotification(item) {
    if (!item.generated && !item.read) await updateRow('notifications', item.id, { read: true });
    if (item.link) navigate(item.link);
  }

  async function markStoredAsRead() {
    const pending = storedNotifications.filter((item) => !item.read);
    await Promise.all(pending.map((item) => updateRow('notifications', item.id, { read: true }).catch(() => null)));
  }

  function enablePushNotifications() {
    setPushStatus('Por ahora la app prioriza alertas internas en tiempo real. Cuando tengamos WhatsApp Business oficial, podemos enviar avisos por supervisor o RRHH.');
  }

  return (
    <div className="page notifications-page">
      <header className="page-header notifications-header">
        <div>
          <p className="eyebrow">Centro de avisos</p>
          <h1>Notificaciones</h1>
          <p className="page-subtitle">Prioriza documentos, solicitudes, pagos y biometria sin entrar modulo por modulo.</p>
        </div>
        <div className="notification-header-actions">
          <button className="secondary-button" type="button" onClick={markStoredAsRead} disabled={!storedNotifications.some((item) => !item.read)}>
            <Icon name="check" /> Marcar sistema leido
          </button>
          <button className="secondary-button" type="button" onClick={enablePushNotifications}><Icon name="bell" /> Canales externos</button>
        </div>
      </header>
      {pushStatus && <p className="push-status">{pushStatus}</p>}

      <section className="notification-summary-grid">
        <NotificationStat label="Accion requerida" value={totals.action} icon="alert" tone="danger" />
        <NotificationStat label="Criticas" value={totals.danger} icon="shield" tone="danger" />
        <NotificationStat label="Preventivas" value={totals.warning} icon="clock" tone="warning" />
        <NotificationStat label="Sin leer" value={totals.allUnread} icon="bell" />
      </section>

      <section className="notification-workbench">
        <aside className="panel notification-filter-panel">
          {filters.map((item) => (
            <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              <span>{item}</span>
              <strong>{countForFilter(items, item)}</strong>
            </button>
          ))}
        </aside>

        <section className="notification-list">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`notification-card notification-${item.severity || 'info'}${item.read ? '' : ' unread'}`}
              onClick={() => openNotification(item)}
            >
              <span className={`notification-icon ${item.severity || 'info'}`}><Icon name={iconForSource(item.source)} /></span>
              <span className="notification-copy">
                <span className="notification-card-top">
                  <strong>{item.title}</strong>
                  <small>{item.source}</small>
                </span>
                <span>{item.message}</span>
                <span className="notification-next-step">{item.nextStep}</span>
                <small>{formatTimestamp(item.createdAt)}</small>
              </span>
              <span className="notification-action">{item.actionLabel}</span>
              {!item.read && <span className="unread-dot" />}
            </button>
          ))}

          {!visibleItems.length && (
            <section className="panel document-empty">
              <div className="empty-folder"><Icon name="bell" size={30} /></div>
              <h2>No hay alertas en este filtro</h2>
              <p>Cuando aparezcan pendientes reales, quedaran agrupados aqui con su accion directa.</p>
            </section>
          )}
        </section>
      </section>
    </div>
  );
}

function NotificationStat({ label, value, icon, tone = '' }) {
  return (
    <article className={`notification-stat ${tone}`}>
      <span><Icon name={icon} /></span>
      <div><strong>{value}</strong><p>{label}</p></div>
    </article>
  );
}

function documentAlerts(employees, documents, isAdmin) {
  const rows = [];
  employees.filter((item) => item.status !== 'Inactivo').forEach((employee) => {
    const employeeDocs = documents.filter((item) => item.employeeId === employee.id);
    const present = new Set(employeeDocs.map((doc) => documentTypeFor(doc.category)?.id).filter(Boolean));
    const missing = documentTypes.filter((type) => type.required && !present.has(type.id));
    if (missing.length) {
      rows.push({
        id: `doc-missing-${employee.id}`,
        source: 'Documentos',
        severity: missing.length >= 4 ? 'danger' : 'warning',
        title: `${employee.name}: expediente incompleto`,
        message: `Faltan ${missing.length} documento${missing.length === 1 ? '' : 's'} obligatorio${missing.length === 1 ? '' : 's'}.`,
        nextStep: isAdmin ? 'Abrir expediente y cargar los documentos pendientes.' : 'Solicita a RRHH cargar o regularizar tu carpeta.',
        actionLabel: isAdmin ? 'Abrir expediente' : 'Ver mi expediente',
        link: isAdmin ? `/expedientes/${employee.id}` : '/expediente',
        createdAt: employee.updatedAt || employee.createdAt || new Date().toISOString(),
        requiresAction: true,
        generated: true,
      });
    }
  });

  documents.forEach((doc) => {
    const expiry = expiryState(doc.expiryDate);
    if (!['expired', 'soon'].includes(expiry.type)) return;
    rows.push({
      id: `doc-expiry-${doc.id}`,
      source: 'Documentos',
      severity: expiry.type === 'expired' ? 'danger' : 'warning',
      title: `${doc.employeeName}: ${doc.category}`,
      message: expiry.type === 'expired' ? `Documento vencido desde ${formatDate(doc.expiryDate)}.` : `Documento vence ${expiry.label.toLowerCase()}.`,
      nextStep: 'Subir una version vigente y mantener el historial anterior si corresponde.',
      actionLabel: isAdmin ? 'Actualizar' : 'Revisar',
      link: isAdmin ? `/expedientes/${doc.employeeId}` : '/expediente',
      createdAt: doc.expiryDate ? `${doc.expiryDate}T12:00:00` : doc.uploadedAt,
      requiresAction: true,
      generated: true,
    });
  });
  return rows;
}

function requestAlerts(requests, isAdmin) {
  return requests.filter((item) => item.status === 'Pendiente').map((item) => ({
    id: `request-${item.id}`,
    source: 'Solicitudes',
    severity: isOlderThan(item.createdAt, 2) ? 'danger' : 'warning',
    title: `${item.type} pendiente`,
    message: `${item.employeeName} solicito desde ${formatDate(item.fromDate)} hasta ${formatDate(item.toDate)}.`,
    nextStep: isAdmin ? 'Aprobar, rechazar o notificar al supervisor por WhatsApp.' : 'Queda pendiente de revision por RRHH.',
    actionLabel: 'Abrir solicitudes',
    link: '/solicitudes',
    createdAt: item.createdAt,
    requiresAction: isAdmin,
    generated: true,
  }));
}

function payrollAlerts(payroll, isAdmin) {
  if (!isAdmin) return [];

  const actionable = payroll.filter((item) => ['Listo para pago', 'Pendiente pago'].includes(item.status));
  const byPeriod = actionable.reduce((acc, item) => {
    acc[item.period] = acc[item.period] || { count: 0, amount: 0, date: item.updatedAt };
    acc[item.period].count += 1;
    acc[item.period].amount += Number(item.netPay || 0);
    acc[item.period].date = latestDate(acc[item.period].date, item.updatedAt);
    return acc;
  }, {});
  return Object.entries(byPeriod).map(([period, info]) => ({
    id: `payroll-${period}`,
    source: 'Remuneraciones',
    severity: info.count >= 3 ? 'danger' : 'warning',
    title: `${info.count} pago${info.count === 1 ? '' : 's'} pendiente${info.count === 1 ? '' : 's'} en ${formatPeriod(period)}`,
    message: `Monto por cerrar: ${formatMoney(info.amount)}.`,
    nextStep: 'Revisar referencias, adjuntar comprobantes y cerrar pagos.',
    actionLabel: 'Ir a pagos',
    link: '/remuneraciones',
    createdAt: info.date,
    requiresAction: true,
    generated: true,
  }));
}

function biometricAlerts(employees, isAdmin) {
  if (!isAdmin) return [];
  return employees
    .filter((item) => item.status === 'Activo' && item.biometricConsent && !item.biometricEnrolled)
    .map((employee) => ({
      id: `bio-${employee.id}`,
      source: 'Biometria',
      severity: 'warning',
      title: `${employee.name} listo para enrolar`,
      message: 'Tiene consentimiento biometrico, pero aun no tiene plantilla facial registrada.',
      nextStep: 'Abrir biometria y completar el enrolamiento antes de permitir marcaje facial.',
      actionLabel: 'Enrolar',
      link: '/biometria',
      createdAt: employee.updatedAt || employee.createdAt,
      requiresAction: true,
      generated: true,
    }));
}

function countForFilter(items, filter) {
  if (filter === 'Leidas') return items.filter((item) => item.read).length;
  if (filter === 'Accion requerida') return items.filter((item) => !item.read && item.requiresAction).length;
  return items.filter((item) => !item.read && item.source === filter).length;
}

function documentTypeFor(category) {
  return documentTypes.find((item) => item.id === category || item.label === category || item.aliases?.includes(category));
}

function expiryState(value) {
  if (!value) return { type: 'none', label: 'Sin vencimiento' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${value}T00:00:00`);
  const days = Math.ceil((expiry - today) / 86400000);
  if (days < 0) return { type: 'expired', label: 'Vencido' };
  if (days <= 30) return { type: 'soon', label: days === 0 ? 'hoy' : `en ${days} dias` };
  return { type: 'ok', label: 'Vigente' };
}

function iconForSource(source) {
  return {
    Documentos: 'folder',
    Solicitudes: 'calendar',
    Remuneraciones: 'wallet',
    Biometria: 'face',
    Sistema: 'bell',
  }[source] || 'alert';
}

function isOlderThan(value, days) {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() > days * 86400000;
}

function latestDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() > new Date(b).getTime() ? a : b;
}

function timestampValue(value) {
  return value ? new Date(value).getTime() : 0;
}

function formatTimestamp(value) {
  return value
    ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    : 'Ahora';
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'Sin fecha';
}

function formatPeriod(period = '') {
  if (!period) return 'periodo actual';
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
}
