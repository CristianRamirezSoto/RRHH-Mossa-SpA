import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/AppLayout';
import { insertRow, subscribeRows, updateRow } from '../services/supabaseData';
import { notifyRequestByWhatsApp, whatsappConfigured, whatsappModeLabel } from '../services/whatsapp';

const requestTypes = ['Vacaciones', 'Permiso', 'Licencia', 'Horas extra', 'Ausencia'];
const emptyForm = { employeeId: '', type: 'Vacaciones', fromDate: '', toDate: '', detail: '' };

export function Requests() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('Pendiente');
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return subscribeRows('employees', (rows) => {
      setEmployees(rows);
      if (!isAdmin) {
        const own = rows.find((item) => item.email?.toLowerCase() === user.email?.toLowerCase());
        setForm((current) => ({ ...current, employeeId: own?.id || '' }));
      }
    }, {
      filters: isAdmin ? [] : [['email', user.email.toLowerCase()]],
      orderBy: 'name',
      ascending: true,
    });
  }, [isAdmin, user.email]);

  useEffect(() => {
    return subscribeRows('hrRequests', setRequests, {
      filters: isAdmin ? [] : [['ownerEmail', user.email.toLowerCase()]],
      orderBy: 'createdAt',
      ascending: false,
    });
  }, [isAdmin, user.email]);

  const visible = useMemo(() => requests.filter((item) => filter === 'Todas' || item.status === filter), [requests, filter]);
  const selectedEmployee = employees.find((item) => item.id === form.employeeId);

  async function submitRequest(event) {
    event.preventDefault();
    if (!selectedEmployee) {
      setMessage('Selecciona un colaborador valido.');
      setMessageTone('error');
      return;
    }
    if (!form.fromDate || !form.toDate) {
      setMessage('Indica fecha de inicio y termino.');
      setMessageTone('error');
      return;
    }
    setSaving(true);
    setMessage('');
    setMessageTone('');
    try {
      const request = await insertRow('hrRequests', {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        ownerEmail: selectedEmployee.email.toLowerCase(),
        type: form.type,
        fromDate: form.fromDate,
        toDate: form.toDate,
        detail: form.detail.trim(),
        status: 'Pendiente',
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const whatsappResult = await notifyRequestByWhatsApp(request);
      setForm({ ...emptyForm, employeeId: isAdmin ? '' : selectedEmployee.id });
      setMessage(whatsappResult.message);
      setMessageTone(whatsappResult.ok ? 'success' : 'warning');
    } catch (error) {
      setMessage(`No se pudo enviar la solicitud: ${error.message}`);
      setMessageTone('error');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(request, status) {
    await updateRow('hrRequests', request.id, {
      status,
      reviewedBy: user.id,
      updatedAt: new Date().toISOString(),
    });
  }

  async function notifyRequest(request) {
    const result = await notifyRequestByWhatsApp(request);
    setMessage(result.message);
    setMessageTone(result.ok ? 'success' : 'warning');
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Autogestion</p>
          <h1>Solicitudes</h1>
          <p className="page-subtitle">Vacaciones, permisos, licencias, ausencias y horas extra en un solo flujo.</p>
        </div>
      </header>

      <section className="hr-workflow-grid">
        <form className="panel request-form-panel" onSubmit={submitRequest}>
          <div className="panel-heading">
            <div>
              <h2>Nueva solicitud</h2>
              <p>{isAdmin ? 'Registra solicitudes del equipo.' : 'Envia tu solicitud a RRHH.'}</p>
            </div>
          </div>
          <div className="form-grid compact-form">
            <div className={`field-wide whatsapp-test-card ${whatsappConfigured() ? 'ready' : 'warning'}`}>
              <Icon name={whatsappConfigured() ? 'check' : 'alert'} size={17} />
              <span>
                <strong>{whatsappConfigured() ? `${whatsappModeLabel()} configurado` : 'WhatsApp Empresa pendiente'}</strong>
                <small>{whatsappConfigured() ? 'Al enviar una solicitud se notificara al canal de RRHH configurado.' : 'Configura la funcion segura de Supabase con las credenciales de WhatsApp Business Cloud API.'}</small>
              </span>
            </div>
            <label className="field field-wide">
              <span>Colaborador</span>
              <select value={form.employeeId} disabled={!isAdmin} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}>
                <option value="">Seleccionar</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Tipo</span>
              <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                {requestTypes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="field"><span>Desde</span><input type="date" value={form.fromDate} onChange={(event) => setForm((current) => ({ ...current, fromDate: event.target.value }))} /></label>
            <label className="field"><span>Hasta</span><input type="date" value={form.toDate} onChange={(event) => setForm((current) => ({ ...current, toDate: event.target.value }))} /></label>
            <label className="field field-wide"><span>Detalle</span><textarea rows="3" value={form.detail} maxLength="360" onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} /></label>
          </div>
          {message && <p className={`form-message ${messageTone}`}>{message}</p>}
          <div className="modal-actions">
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enviando...' : 'Enviar solicitud'}</button>
          </div>
        </form>

        <section className="panel request-list-panel">
          <div className="panel-heading attendance-records-heading">
            <div>
              <h2>Bandeja de solicitudes</h2>
              <p>{visible.length} registros visibles</p>
            </div>
            <div className="filter-tabs">
              {['Pendiente', 'Aprobada', 'Rechazada', 'Todas'].map((item) => (
                <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>
              ))}
            </div>
          </div>
          <div className="request-list">
            {visible.map((item) => (
              <article className="request-card" key={item.id}>
                <span className={`request-state request-${slug(item.status)}`}>{item.status}</span>
                <div>
                  <strong>{item.type}</strong>
                  <p>{item.employeeName} - {formatDate(item.fromDate)} al {formatDate(item.toDate)}</p>
                  {item.detail && <small>{item.detail}</small>}
                </div>
                {isAdmin && item.status === 'Pendiente' && (
                  <div className="request-actions">
                    {whatsappConfigured() && <button type="button" onClick={() => notifyRequest(item)} title="Notificar por WhatsApp Empresa"><Icon name="bell" size={16} /></button>}
                    <button type="button" onClick={() => updateStatus(item, 'Aprobada')} title="Aprobar"><Icon name="check" size={16} /></button>
                    <button type="button" onClick={() => updateStatus(item, 'Rechazada')} title="Rechazar"><Icon name="close" size={16} /></button>
                  </div>
                )}
              </article>
            ))}
            {!visible.length && <div className="empty-state large"><Icon name="calendar" size={30} /><p>No hay solicitudes para este filtro.</p></div>}
          </div>
        </section>
      </section>
    </div>
  );
}

function formatDate(value) { return value ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`)) : 'Sin fecha'; }
function slug(value = '') { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'); }
