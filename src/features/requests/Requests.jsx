import { useRef, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/AppLayout';
import {
  insertRow,
  resolveEmployeeDataUpdate,
  subscribeRows,
  updateRow,
} from '../../services/supabaseData';
import { notifyRequestByWhatsApp, whatsappConfigured, whatsappModeLabel } from '../../services/whatsapp';
import {
  createRequestEvidencePath,
  deleteDocumentFile,
  getDocumentDownloadUrl,
  uploadDocumentFile,
} from '../../services/documentStorage';
import './Requests.css';

const requestTypes = [
  { value: 'Vacaciones', guidance: 'Indica el periodo completo y cualquier coordinación relevante.', targetDays: 3, requiresDates: true },
  { value: 'Permiso', guidance: 'Explica el motivo y las fechas u horas que necesitas.', targetDays: 2, requiresDates: true },
  { value: 'Licencia', guidance: 'Registra el periodo informado y agrega el detalle disponible.', targetDays: 2, requiresDates: true },
  { value: 'Horas extra', guidance: 'Indica jornada, motivo y responsable que solicitó el trabajo.', targetDays: 2, requiresDates: true },
  { value: 'Ausencia', guidance: 'Informa el periodo y el motivo para mantener la trazabilidad.', targetDays: 2, requiresDates: true },
  { value: 'Certificado laboral', guidance: 'Describe el certificado que necesitas y para qué trámite será usado.', targetDays: 2, requiresDates: false },
  { value: 'Regularización documental', guidance: 'Nombra el documento faltante, vencido o incorrecto de tu expediente.', targetDays: 3, requiresDates: false },
  { value: 'Actualización de datos', guidance: 'Propón teléfono y contacto de emergencia. Al aprobar, la ficha se actualiza automáticamente.', targetDays: 2, requiresDates: false },
  { value: 'Consulta de remuneración', guidance: 'Incluye el periodo y el concepto específico que necesitas revisar.', targetDays: 3, requiresDates: false },
];
const emptyForm = { employeeId: '', type: 'Vacaciones', fromDate: '', toDate: '', detail: '' };
const emptyDataChanges = { phone: '', emergencyContact: '', emergencyPhone: '' };

export function Requests() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('Pendiente');
  const [form, setForm] = useState(emptyForm);
  const [dataChanges, setDataChanges] = useState(emptyDataChanges);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('');
  const [saving, setSaving] = useState(false);
  const [resolution, setResolution] = useState(null);
  const [resolutionComment, setResolutionComment] = useState('');
  const [resolutionFile, setResolutionFile] = useState(null);
  const [resolving, setResolving] = useState(false);
  const fileInput = useRef(null);

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

  const visible = useMemo(() => {
    const filtered = requests.filter((item) => filter === 'Todas' || item.status === filter);
    return [...filtered].sort((left, right) => {
      const leftDate = new Date(left.createdAt || 0).getTime();
      const rightDate = new Date(right.createdAt || 0).getTime();
      return isAdmin && filter === 'Pendiente' ? leftDate - rightDate : rightDate - leftDate;
    });
  }, [filter, isAdmin, requests]);
  const selectedEmployee = employees.find((item) => item.id === form.employeeId);
  const selectedRequestType = requestTypes.find((item) => item.value === form.type) || requestTypes[0];

  async function submitRequest(event) {
    event.preventDefault();
    if (!selectedEmployee) {
      setMessage('Selecciona un colaborador valido.');
      setMessageTone('error');
      return;
    }
    if (selectedRequestType.requiresDates && (!form.fromDate || !form.toDate)) {
      setMessage('Indica fecha de inicio y termino.');
      setMessageTone('error');
      return;
    }
    const requestedChanges = form.type === 'Actualización de datos'
      ? cleanRequestedChanges(dataChanges)
      : {};
    if (form.type === 'Actualización de datos' && !Object.keys(requestedChanges).length) {
      setMessage('Indica al menos un dato nuevo para actualizar.');
      setMessageTone('error');
      return;
    }
    setSaving(true);
    setMessage('');
    setMessageTone('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const request = await insertRow('hrRequests', {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        ownerEmail: selectedEmployee.email.toLowerCase(),
        type: form.type,
        fromDate: selectedRequestType.requiresDates ? form.fromDate : today,
        toDate: selectedRequestType.requiresDates ? form.toDate : today,
        detail: form.detail.trim(),
        requestedChanges,
        status: 'Pendiente',
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const whatsappResult = await notifyRequestByWhatsApp(withSupervisor(request));
      setForm({ ...emptyForm, employeeId: isAdmin ? '' : selectedEmployee.id });
      setDataChanges(emptyDataChanges);
      setMessage(whatsappResult.message);
      setMessageTone(whatsappResult.ok ? 'success' : 'warning');
    } catch (error) {
      setMessage(`No se pudo enviar la solicitud: ${error.message}`);
      setMessageTone('error');
    } finally {
      setSaving(false);
    }
  }

  function openResolution(request, status) {
    setResolution({ request, status });
    setResolutionComment('');
    setResolutionFile(null);
  }

  async function updateStatus(event) {
    event.preventDefault();
    if (!resolution) return;
    const isDataUpdate = resolution.request.type === 'Actualización de datos';
    if (resolution.status === 'Aprobada' && !resolutionFile && !isDataUpdate) {
      setMessage('Para aprobar debes adjuntar el documento de respaldo.');
      setMessageTone('error');
      return;
    }

    setResolving(true);
    setMessage('');
    setMessageTone('');
    let storagePath = '';
    try {
      if (isDataUpdate) {
        await resolveEmployeeDataUpdate(resolution.request.id, {
          status: resolution.status,
          comment: resolutionComment,
        });
        setResolution(null);
        setResolutionComment('');
        setResolutionFile(null);
        setMessage(resolution.status === 'Aprobada'
          ? 'Solicitud aprobada y ficha laboral actualizada automáticamente.'
          : 'Solicitud de actualización rechazada.');
        setMessageTone('success');
        return;
      }

      const payload = {
        status: resolution.status,
        resolutionComment: resolutionComment.trim(),
        resolvedAt: new Date().toISOString(),
        reviewedBy: user.id,
        updatedAt: new Date().toISOString(),
      };

      if (resolutionFile) {
        storagePath = createRequestEvidencePath({
          employeeId: resolution.request.employeeId,
          requestId: resolution.request.id,
          fileName: resolutionFile.name,
        });
        await uploadDocumentFile(storagePath, resolutionFile);
        payload.evidenceFileName = resolutionFile.name;
        payload.evidenceStoragePath = storagePath;
        payload.evidenceContentType = resolutionFile.type || 'application/octet-stream';
        payload.evidenceSize = resolutionFile.size;
      }

      await updateRow('hrRequests', resolution.request.id, payload);
      setResolution(null);
      setResolutionComment('');
      setResolutionFile(null);
      setMessage(`Solicitud ${resolution.status.toLowerCase()} correctamente.`);
      setMessageTone('success');
    } catch (error) {
      if (storagePath) await deleteDocumentFile(storagePath).catch(() => {});
      setMessage(`No se pudo resolver la solicitud: ${error.message}`);
      setMessageTone('error');
    } finally {
      setResolving(false);
    }
  }

  async function notifyRequest(request) {
    const result = await notifyRequestByWhatsApp(withSupervisor(request));
    setMessage(result.message);
    setMessageTone(result.ok ? 'success' : 'warning');
  }

  async function downloadEvidence(request) {
    try {
      const url = await getDocumentDownloadUrl(request.evidenceStoragePath);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      setMessage(`No se pudo descargar el respaldo: ${error.message}`);
      setMessageTone('error');
    }
  }

  function withSupervisor(request) {
    const employee = employees.find((item) => item.id === request.employeeId);
    return {
      ...request,
      supervisor: employee?.supervisor || '',
      supervisorWhatsapp: employee?.supervisorWhatsapp || '',
    };
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{isAdmin ? 'Gestión del equipo' : 'Autoservicio'}</p>
          <h1>{isAdmin ? 'Solicitudes del equipo' : 'Mis solicitudes'}</h1>
          <p className="page-subtitle">{isAdmin
            ? 'Revisa, aprueba y mantén trazabilidad de cada solicitud.'
            : 'Solicita vacaciones, permisos o licencias y sigue su avance.'}</p>
        </div>
      </header>

      {!isAdmin && (
        <section className="request-process-strip" aria-label="Etapas de una solicitud">
          <div><span>1</span><strong>Registra</strong><small>Elige el tipo correcto</small></div>
          <Icon name="arrow" size={16} />
          <div><span>2</span><strong>Sigue</strong><small>Revisa el estado aquí</small></div>
          <Icon name="arrow" size={16} />
          <div><span>3</span><strong>Descarga</strong><small>Recibe el respaldo final</small></div>
        </section>
      )}

      <section className="hr-workflow-grid">
        <form className="panel request-form-panel" onSubmit={submitRequest}>
          <div className="panel-heading">
            <div>
              <h2>Nueva solicitud</h2>
              <p>{isAdmin ? 'Registra solicitudes del equipo.' : 'Envia tu solicitud a RRHH.'}</p>
            </div>
          </div>
          <div className="form-grid compact-form">
            {isAdmin && (
              <div className={`field-wide whatsapp-test-card ${whatsappConfigured() ? 'ready' : 'warning'}`}>
                <Icon name={whatsappConfigured() ? 'check' : 'alert'} size={17} />
                <span>
                  <strong>{whatsappConfigured() ? `${whatsappModeLabel()} configurado` : 'WhatsApp Empresa pendiente'}</strong>
                  <small>{whatsappConfigured() ? 'Al enviar una solicitud se notificará al canal de RRHH configurado.' : 'Configura la función segura de Supabase con las credenciales de WhatsApp Business Cloud API.'}</small>
                </span>
              </div>
            )}
            {isAdmin ? (
              <label className="field field-wide">
                <span>Colaborador</span>
                <select value={form.employeeId} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}>
                  <option value="">Seleccionar</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                </select>
              </label>
            ) : (
              <div className="field-wide request-owner-card">
                <span><Icon name="user" size={18} /></span>
                <div><strong>{selectedEmployee?.name || 'Ficha laboral pendiente'}</strong><small>{selectedEmployee?.position || user.email}</small></div>
              </div>
            )}
            <label className="field">
              <span>Tipo</span>
              <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                {requestTypes.map((item) => <option key={item.value} value={item.value}>{item.value}</option>)}
              </select>
            </label>
            <div className="field-wide request-type-guidance">
              <Icon name="help" size={17} />
              <span>
                <strong>{selectedRequestType.value}</strong>
                <small>{selectedRequestType.guidance} Atención sugerida: {selectedRequestType.targetDays} días.</small>
              </span>
            </div>
            {form.type === 'Actualización de datos' && (
              <div className="field-wide data-update-fields">
                <div className="data-update-heading">
                  <span><Icon name="edit" size={17} /></span>
                  <div>
                    <strong>Datos que quieres modificar</strong>
                    <small>Completa solamente los campos que deben cambiar. El administrador verá el valor actual y el propuesto.</small>
                  </div>
                </div>
                <label className="field">
                  <span>Nuevo teléfono</span>
                  <input
                    value={dataChanges.phone}
                    placeholder={selectedEmployee?.phone || '+56 9…'}
                    maxLength="40"
                    onChange={(event) => setDataChanges((current) => ({ ...current, phone: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Nuevo contacto de emergencia</span>
                  <input
                    value={dataChanges.emergencyContact}
                    placeholder={selectedEmployee?.emergencyContact || 'Nombre y relación'}
                    maxLength="100"
                    onChange={(event) => setDataChanges((current) => ({ ...current, emergencyContact: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Nuevo teléfono de emergencia</span>
                  <input
                    value={dataChanges.emergencyPhone}
                    placeholder={selectedEmployee?.emergencyPhone || '+56 9…'}
                    maxLength="40"
                    onChange={(event) => setDataChanges((current) => ({ ...current, emergencyPhone: event.target.value }))}
                  />
                </label>
              </div>
            )}
            {selectedRequestType.requiresDates && (
              <>
                <label className="field"><span>Desde</span><input type="date" value={form.fromDate} onChange={(event) => setForm((current) => ({ ...current, fromDate: event.target.value }))} /></label>
                <label className="field"><span>Hasta</span><input type="date" value={form.toDate} onChange={(event) => setForm((current) => ({ ...current, toDate: event.target.value }))} /></label>
              </>
            )}
            <label className="field field-wide"><span>Detalle</span><textarea rows="3" value={form.detail} maxLength="360" placeholder={selectedRequestType.guidance} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} /></label>
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
                  <p>{requestDescription(item)}</p>
                  {item.detail && <small>{item.detail}</small>}
                  {item.type === 'Actualización de datos' && (
                    <DataUpdatePreview
                      changes={item.requestedChanges}
                      employee={employees.find((employee) => employee.id === item.employeeId)}
                    />
                  )}
                  <div className="request-history">
                    <span>Creada {formatTimestamp(item.createdAt)}</span>
                    {item.status === 'Pendiente' && (
                      <span className={`request-sla ${requestSla(item).tone}`}>{requestSla(item).label}</span>
                    )}
                    {item.resolvedAt && <span>Resuelta {formatTimestamp(item.resolvedAt)}</span>}
                    {item.resolutionComment && <span>{item.resolutionComment}</span>}
                    {item.evidenceFileName && (
                      <button type="button" onClick={() => downloadEvidence(item)}>
                        <Icon name="download" size={14} /> {item.evidenceFileName}
                      </button>
                    )}
                  </div>
                </div>
                {isAdmin && item.status === 'Pendiente' && (
                  <div className="request-actions">
                    {whatsappConfigured() && <button type="button" onClick={() => notifyRequest(item)} title="Notificar por WhatsApp Empresa"><Icon name="bell" size={16} /></button>}
                    <button type="button" onClick={() => openResolution(item, 'Aprobada')} title="Aprobar"><Icon name="check" size={16} /></button>
                    <button type="button" onClick={() => openResolution(item, 'Rechazada')} title="Rechazar"><Icon name="close" size={16} /></button>
                  </div>
                )}
              </article>
            ))}
            {!visible.length && <div className="empty-state large"><Icon name="calendar" size={30} /><p>No hay solicitudes para este filtro.</p></div>}
          </div>
        </section>
      </section>

      {resolution && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setResolution(null)}>
          <form className="modal request-resolution-modal" onSubmit={updateStatus}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">{resolution.request.employeeName}</p>
                <h2>{resolution.status === 'Aprobada' ? 'Aprobar solicitud' : 'Rechazar solicitud'}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setResolution(null)}><Icon name="close" /></button>
            </div>
            <div className="request-resolution-summary">
              <strong>{resolution.request.type}</strong>
              <span>{requestDescription(resolution.request)}</span>
              {resolution.request.detail && <p>{resolution.request.detail}</p>}
              {resolution.request.type === 'Actualización de datos' && (
                <DataUpdatePreview
                  changes={resolution.request.requestedChanges}
                  employee={employees.find((employee) => employee.id === resolution.request.employeeId)}
                />
              )}
            </div>
            <div className="form-grid">
              <label className="field field-wide">
                <span>Comentario de resolucion</span>
                <textarea rows="3" maxLength="360" value={resolutionComment} onChange={(event) => setResolutionComment(event.target.value)} placeholder="Ej: aprobado por disponibilidad operacional" />
              </label>
              {resolution.request.type !== 'Actualización de datos' && (
                <label className="upload-zone field-wide" onClick={() => fileInput.current?.click()}>
                  <input ref={fileInput} type="file" hidden onChange={(event) => setResolutionFile(event.target.files?.[0] || null)} />
                  <Icon name="upload" size={24} />
                  <strong>{resolutionFile ? resolutionFile.name : resolution.status === 'Aprobada' ? 'Adjuntar respaldo obligatorio' : 'Adjuntar respaldo opcional'}</strong>
                  <span>{resolutionFile ? formatBytes(resolutionFile.size) : 'PDF, imagen o documento'}</span>
                </label>
              )}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setResolution(null)}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={resolving}>{resolving ? 'Guardando...' : resolution.status}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function formatDate(value) { return value ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`)) : 'Sin fecha'; }
function formatTimestamp(value) { return value ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : ''; }
function formatBytes(bytes = 0) { if (!bytes) return '0 KB'; const units = ['B', 'KB', 'MB', 'GB']; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
function slug(value = '') { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'); }

function DataUpdatePreview({ changes = {}, employee }) {
  const fields = [
    { key: 'phone', label: 'Teléfono', current: employee?.phone },
    { key: 'emergencyContact', label: 'Contacto de emergencia', current: employee?.emergencyContact },
    { key: 'emergencyPhone', label: 'Teléfono de emergencia', current: employee?.emergencyPhone },
  ].filter((field) => Object.prototype.hasOwnProperty.call(changes || {}, field.key));

  if (!fields.length) return null;
  return (
    <div className="data-change-preview">
      {fields.map((field) => (
        <div key={field.key}>
          <strong>{field.label}</strong>
          <span><small>Actual</small>{field.current || 'Sin registrar'}</span>
          <Icon name="arrow" size={13} />
          <span className="proposed"><small>Propuesto</small>{changes[field.key]}</span>
        </div>
      ))}
    </div>
  );
}

function cleanRequestedChanges(changes) {
  return Object.fromEntries(
    Object.entries(changes)
      .map(([key, value]) => [key, String(value || '').trim()])
      .filter(([, value]) => value),
  );
}

function requestDescription(request) {
  const requiresDates = requestTypes.find((item) => item.value === request.type)?.requiresDates;
  return requiresDates
    ? `${request.employeeName} · ${formatDate(request.fromDate)} al ${formatDate(request.toDate)}`
    : `${request.employeeName} · registrada ${formatDate(request.fromDate)}`;
}

function requestSla(request) {
  const targetDays = requestTypes.find((item) => item.value === request.type)?.targetDays || 3;
  const createdAt = new Date(request.createdAt || 0);
  const age = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86400000));
  if (age > targetDays) return { tone: 'overdue', label: `${age} días esperando · priorizar` };
  if (age === targetDays) return { tone: 'warning', label: 'Revisión sugerida hoy' };
  return { tone: 'ontrack', label: `Atención sugerida: ${targetDays} días` };
}
