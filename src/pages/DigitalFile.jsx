import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/AppLayout';
import { deleteRow, insertRow, subscribeRows } from '../services/supabaseData';
import {
  createDocumentStoragePath,
  deleteDocumentFile,
  getDocumentDownloadUrl,
  uploadDocumentFile,
} from '../services/documentStorage';

export const documentTypes = [
  { id: 'Curriculum vitae', label: 'Curriculum vitae', required: true, group: 'Ingreso', expires: false, aliases: ['Curriculum'] },
  { id: 'Cedula de identidad', label: 'Cedula de identidad por ambos lados', required: true, group: 'Identidad', expires: true, aliases: ['Carnet'] },
  { id: 'Certificado de antecedentes', label: 'Certificado de antecedentes vigente', required: true, group: 'Ingreso', expires: true, aliases: ['Certificados'] },
  { id: 'Certificado de estudios', label: 'Certificado de estudios o titulo', required: true, group: 'Ingreso', expires: false, aliases: ['Titulo profesional'] },
  { id: 'Ultimo finiquito', label: 'Ultimo finiquito', required: false, group: 'Laboral', expires: false },
  { id: 'Afiliacion AFP', label: 'Certificado de afiliacion AFP vigente', required: true, group: 'Prevision', expires: true },
  { id: 'Cotizaciones AFP', label: 'Certificado de cotizaciones AFP', required: true, group: 'Prevision', expires: true },
  { id: 'Afiliacion Salud', label: 'Certificado de afiliacion a salud vigente', required: true, group: 'Prevision', expires: true },
  { id: 'Certificado de residencia', label: 'Certificado de residencia', required: true, group: 'Ingreso', expires: true },
  { id: 'Carga familiar', label: 'Nacimiento carga familiar y estudios', required: false, group: 'Cargas', expires: true },
  { id: 'Contrato', label: 'Contrato de trabajo firmado', required: true, group: 'Contrato', expires: false },
  { id: 'Anexos', label: 'Anexos de contrato', required: false, group: 'Contrato', expires: false },
  { id: 'Licencias', label: 'Licencias medicas', required: false, group: 'Ausencias', expires: true },
  { id: 'Otros', label: 'Otros documentos', required: false, group: 'Otros', expires: false },
];

const emptyForm = { category: 'Curriculum vitae', expiryDate: '', observations: '' };
const documentGroups = ['Todos', 'Obligatorios', 'Faltantes', 'Vencidos', 'Por vencer', ...new Set(documentTypes.map((item) => item.group))];

export function DigitalFile() {
  const { employeeId } = useParams();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return isAdmin
    ? <AdminDigitalFiles selectedEmployeeId={employeeId} user={user} />
    : <WorkerDigitalFile user={user} />;
}

function AdminDigitalFiles({ selectedEmployeeId, user }) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');

  useEffect(() => subscribeRows('employees', setEmployees, { orderBy: 'name', ascending: true }), []);

  useEffect(() => subscribeRows('documents', setDocuments, { orderBy: 'uploadedAt', ascending: false }), []);

  const selectedEmployee = employees.find((item) => item.id === selectedEmployeeId);

  if (selectedEmployeeId) {
    if (!selectedEmployee) return <div className="screen-center">Cargando expediente…</div>;
    return (
      <EmployeeFile
        employee={selectedEmployee}
        documents={documents.filter((item) => item.employeeId === selectedEmployee.id)}
        canManage
        currentUser={user}
        onBack={() => navigate('/expedientes')}
      />
    );
  }

  const rows = employees.map((employee) => ({
    ...employee,
    summary: documentSummary(documents.filter((item) => item.employeeId === employee.id)),
  }));

  const visibleRows = rows.filter((employee) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = [employee.name, employee.rut, employee.position, employee.area]
      .some((value) => value?.toLowerCase().includes(term));
    const matchesStatus = statusFilter === 'Todos'
      || (statusFilter === 'Con alertas' && employee.summary.alerts > 0)
      || (statusFilter === 'Completo' && employee.summary.completion === 100)
      || (statusFilter === 'Incompleto' && employee.summary.completion < 100);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administración documental</p>
          <h1>Expedientes del personal</h1>
          <p className="page-subtitle">Selecciona un trabajador para revisar y administrar todos sus documentos.</p>
        </div>
      </header>

      <section className="file-summary-grid">
        <SummaryCard label="Trabajadores" value={employees.length} icon="users" />
        <SummaryCard label="Expedientes completos" value={rows.filter((item) => item.summary.completion === 100).length} icon="folder" />
        <SummaryCard label="Documentos vencidos" value={documents.filter((item) => expiryState(item.expiryDate).type === 'expired').length} icon="alert" tone="danger" />
        <SummaryCard label="Próximos a vencer" value={documents.filter((item) => expiryState(item.expiryDate).type === 'soon').length} icon="clock" tone="warning" />
      </section>

      <section className="toolbar file-list-toolbar">
        <label className="search-box">
          <Icon name="search" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, RUT, cargo o área" />
        </label>
        <div className="filter-tabs">
          {['Todos', 'Con alertas', 'Completo', 'Incompleto'].map((item) => (
            <button key={item} type="button" className={statusFilter === item ? 'active' : ''} onClick={() => setStatusFilter(item)}>{item}</button>
          ))}
        </div>
      </section>

      <section className="panel table-panel file-workers-panel">
        <div className="table-wrap">
          <table className="file-workers-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Trabajador</th>
                <th>RUT</th>
                <th>Fecha contrato</th>
                <th>Cargo</th>
                <th>Alertas</th>
                <th>Cumplimiento</th>
                <th>Expediente</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((employee, index) => (
                <tr key={employee.id}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="employee-cell">
                      <span className="avatar avatar-soft">{initials(employee.name)}</span>
                      <span><strong>{employee.name}</strong><small>{employee.email}</small></span>
                    </div>
                  </td>
                  <td>{employee.rut || '—'}</td>
                  <td>{formatDate(employee.contractDate || employee.startDate)}</td>
                  <td>{employee.position || '—'}</td>
                  <td>
                    {employee.summary.alerts
                      ? <span className="worker-alert-count"><Icon name="alert" size={14} /> {employee.summary.alerts}</span>
                      : <span className="worker-ok">Sin alertas</span>}
                  </td>
                  <td>
                    <div className="completion-cell">
                      <div className="completion-track"><span style={{ width: `${employee.summary.completion}%` }} /></div>
                      <strong>{employee.summary.completion}%</strong>
                    </div>
                  </td>
                  <td>
                    <button className="open-file-button" type="button" onClick={() => navigate(`/expedientes/${employee.id}`)}>
                      <Icon name="folder" size={17} /> Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleRows.length && <div className="empty-state large"><Icon name="users" size={30} /><p>No hay trabajadores para mostrar.</p></div>}
      </section>
    </div>
  );
}

function WorkerDigitalFile({ user }) {
  const [employee, setEmployee] = useState(null);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    return subscribeRows('employees', (rows) => setEmployee(rows[0] || null), {
      filters: [['email', user.email.toLowerCase()]],
      orderBy: 'name',
      ascending: true,
    });
  }, [user.email]);

  useEffect(() => {
    return subscribeRows('documents', setDocuments, {
      filters: [['ownerEmail', user.email.toLowerCase()]],
      orderBy: 'uploadedAt',
      ascending: false,
    });
  }, [user.email]);

  if (!employee) {
    return (
      <div className="page">
        <section className="panel document-empty">
          <div className="empty-folder"><Icon name="folder" size={32} /></div>
          <h2>Tu cuenta aún no está vinculada</h2>
          <p>El administrador debe registrar un trabajador usando el mismo correo de tu cuenta: {user.email}</p>
        </section>
      </div>
    );
  }

  return <EmployeeFile employee={employee} documents={documents} canManage={false} currentUser={user} />;
}

function EmployeeFile({ employee, documents, canManage, currentUser, onBack }) {
  const [category, setCategory] = useState('Todos');
  const [documentFilter, setDocumentFilter] = useState('Todos');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const fileInput = useRef(null);
  const summary = documentSummary(documents);
  const checklist = useMemo(() => documentTypes.map((type) => {
    const versions = documents
      .filter((item) => [type.id, type.label, ...(type.aliases || [])].includes(item.category))
      .sort((a, b) => timestampValue(b.uploadedAt) - timestampValue(a.uploadedAt));
    const latest = versions[0] || null;
    const expiry = expiryState(latest?.expiryDate);
    const missing = type.required && !latest;
    const alert = missing || ['expired', 'soon'].includes(expiry.type);
    return { ...type, latest, versions, expiry, missing, alert };
  }), [documents]);

  const visibleDocuments = useMemo(
    () => documents
      .filter((item) => {
        const type = documentTypeFor(item.category);
        const expiry = expiryState(item.expiryDate);
        const matchesCategory = category === 'Todos'
          || (category === 'Obligatorios' && type?.required)
          || (category === 'Vencidos' && expiry.type === 'expired')
          || (category === 'Por vencer' && expiry.type === 'soon')
          || type?.group === category
          || item.category === category;
        const matchesDocument = documentFilter === 'Todos' || item.category === documentFilter || type?.id === documentFilter;
        return matchesCategory && matchesDocument;
      })
      .sort((a, b) => timestampValue(b.uploadedAt) - timestampValue(a.uploadedAt)),
    [documents, category, documentFilter]
  );

  const visibleChecklist = useMemo(() => checklist.filter((item) => (
    category === 'Todos'
    || (category === 'Obligatorios' && item.required)
    || (category === 'Faltantes' && item.missing)
    || (category === 'Vencidos' && item.expiry.type === 'expired')
    || (category === 'Por vencer' && item.expiry.type === 'soon')
    || item.group === category
  )), [checklist, category]);

  function openUpload(typeId = emptyForm.category) {
    const type = documentTypeFor(typeId) || documentTypes[0];
    setForm({
      category: type.id,
      expiryDate: '',
      observations: type.expires ? 'Documento vigente segun emisor.' : '',
    });
    setFile(null);
    setMessage('');
    setShowUpload(true);
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!file) {
      setMessage('Selecciona un archivo.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setMessage('El archivo no puede superar los 12 MB.');
      return;
    }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type || '')) {
      setMessage('Sube PDF o imagen. Recomendado: PDF original.');
      return;
    }

    setSaving(true);
    setMessage('');
    const documentId = crypto.randomUUID();
    const storagePath = createDocumentStoragePath({
      employeeId: employee.id,
      documentId,
      fileName: file.name,
    });

    try {
      const storageInfo = await uploadDocumentFile(storagePath, file);
      await insertRow('documents', {
        id: documentId,
        employeeId: employee.id,
        employeeName: employee.name,
        ownerEmail: employee.email.toLowerCase(),
        category: form.category,
        expiryDate: form.expiryDate || '',
        observations: form.observations.trim(),
        fileName: file.name,
        storagePath,
        storageBucket: storageInfo.bucket,
        storageProvider: 'supabase',
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser.id,
        notificationState: 'pending',
      });
      setShowUpload(false);
      setForm(emptyForm);
      setFile(null);
      setMessage('Documento cargado correctamente.');
    } catch (error) {
      await deleteDocumentFile(storagePath).catch(() => {});
      setMessage(`No se pudo subir: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function downloadDocument(item) {
    try {
      const url = await getDocumentDownloadUrl(item.storagePath);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      setMessage(`No se pudo descargar: ${error.message}`);
    }
  }

  async function removeDocument(item) {
    if (!window.confirm(`¿Eliminar "${item.fileName}"?`)) return;
    try {
      await deleteDocumentFile(item.storagePath);
      await deleteRow('documents', item.id);
    } catch (error) {
      setMessage(`No se pudo eliminar: ${error.message}`);
    }
  }

  return (
    <div className="page">
      {onBack && <button className="back-button" type="button" onClick={onBack}><Icon name="back" size={17} /> Volver al listado</button>}
      <header className="employee-file-header">
        <div className="employee-file-person">
          <span className="avatar employee-file-avatar">{initials(employee.name)}</span>
          <div>
            <p className="eyebrow">{canManage ? 'Expediente del trabajador' : 'Mi expediente digital'}</p>
            <h1>{employee.name}</h1>
            <p>{employee.position || 'Cargo sin definir'} · {employee.area || 'Área sin definir'}</p>
          </div>
        </div>
        {canManage && <button className="primary-button" type="button" onClick={() => openUpload()}><Icon name="upload" /> Subir documento</button>}
      </header>

      <section className="employee-file-data">
        <DataItem label="RUT" value={employee.rut || 'Sin registrar'} />
        <DataItem label="Correo" value={employee.email} />
        <DataItem label="Fecha contrato" value={formatDate(employee.contractDate || employee.startDate)} />
        <DataItem label="Estado" value={employee.status || 'Activo'} />
        <div className="file-compliance-card">
          <span>Cumplimiento documental</span>
          <strong>{summary.completion}%</strong>
          <div className="completion-track large"><span style={{ width: `${summary.completion}%` }} /></div>
        </div>
      </section>

      {!!summary.alerts && (
        <section className="expiry-alerts">
          <div className="expiry-alert-icon"><Icon name="alert" /></div>
          <div>
            <strong>Este expediente tiene {summary.alerts} {summary.alerts === 1 ? 'alerta' : 'alertas'}</strong>
            <p>{summary.expired} vencidos · {summary.soon} próximos a vencer</p>
          </div>
        </section>
      )}

      <section className="file-ops-grid">
        <article className="panel file-readiness-card">
          <div>
            <p className="eyebrow">Orden de carpeta</p>
            <h2>{summary.missingRequired ? `${summary.missingRequired} obligatorios pendientes` : 'Expediente operativo'}</h2>
            <p>{summary.requiredReady}/{summary.requiredCount} documentos obligatorios listos. Archivos guardados como PDF/imagen original en Storage, sin duplicarlos en la base.</p>
          </div>
          <div className="file-readiness-ring" style={{ '--progress': `${summary.completion * 3.6}deg` }}>
            <strong>{summary.completion}%</strong>
          </div>
        </article>
        <article className="panel file-storage-card">
          <span><Icon name="shield" /></span>
          <div>
            <strong>Uso eficiente Supabase</strong>
            <p>La app solo consulta metadatos livianos. El PDF se descarga con enlace temporal cuando RRHH lo abre.</p>
          </div>
        </article>
      </section>

      <div className="category-tabs file-categories">
        {documentGroups.map((item) => (
          <button key={item} type="button" className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>
            {item}
            {item === 'Faltantes' && <span>{summary.missingRequired}</span>}
            {item === 'Vencidos' && <span>{summary.expired}</span>}
            {item === 'Por vencer' && <span>{summary.soon}</span>}
          </button>
        ))}
      </div>

      <section className="document-checklist">
        {visibleChecklist.map((item, index) => (
          <article className={`document-check-item ${item.alert ? 'needs-action' : 'ready'}`} key={item.id}>
            <div className="document-check-number">{index + 1}</div>
            <div className="document-check-main">
              <div className="document-check-title">
                <strong>{item.label}</strong>
                <span>{item.required ? 'Obligatorio' : 'Opcional'}</span>
              </div>
              {item.latest ? (
                <p>
                  Ultimo archivo: {item.latest.fileName}
                  {item.latest.expiryDate ? ` - vence ${formatDate(item.latest.expiryDate)}` : ' - sin vencimiento'}
                </p>
              ) : (
                <p>{item.required ? 'Falta cargar este documento.' : 'No aplica o queda pendiente si RRHH lo solicita.'}</p>
              )}
            </div>
            <span className={`document-check-state ${item.missing ? 'missing' : item.expiry.type}`}>
              {item.missing ? 'Faltante' : item.expiry.label}
            </span>
            {canManage && (
              <button className="secondary-button" type="button" onClick={() => openUpload(item.id)}>
                <Icon name="upload" size={16} /> {item.latest ? 'Actualizar' : 'Subir'}
              </button>
            )}
          </article>
        ))}
      </section>

      <section className="document-history-head">
        <div>
          <h2>Historial de archivos</h2>
          <p>{visibleDocuments.length} documentos visibles</p>
        </div>
        <label className="compact-select">
          <span>Tipo especifico</span>
          <select value={documentFilter} onChange={(event) => setDocumentFilter(event.target.value)}>
            <option>Todos</option>
            {documentTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </section>

      <section className="documents-grid">
        {visibleDocuments.map((item) => {
          const expiry = expiryState(item.expiryDate);
          return (
            <article className="document-card" key={item.id}>
              <div className={`document-type type-${item.category.toLowerCase()}`}><Icon name="file" size={22} /></div>
              <div className="document-card-main">
                <div className="document-card-heading">
                  <span className="document-category">{item.category}</span>
                  {expiry.type !== 'none' && <span className={`expiry-pill expiry-${expiry.type}`}>{expiry.label}</span>}
                </div>
                <h2 title={item.fileName}>{item.fileName}</h2>
                <div className="document-meta">
                  <span>{formatBytes(item.size)}</span>
                  <span>{formatTimestamp(item.uploadedAt)}</span>
                  {item.expiryDate && <span>Vence {formatDate(item.expiryDate)}</span>}
                </div>
                {item.observations && <p className="document-notes">{item.observations}</p>}
              </div>
              <div className="document-actions">
                <button type="button" onClick={() => downloadDocument(item)} title="Descargar"><Icon name="download" /></button>
                {canManage && <button className="danger-action" type="button" onClick={() => removeDocument(item)} title="Eliminar"><Icon name="trash" /></button>}
              </div>
            </article>
          );
        })}
      </section>

      {!visibleDocuments.length && (
        <section className="panel document-empty">
          <div className="empty-folder"><Icon name="folder" size={32} /></div>
          <h2>No hay documentos en esta categoría</h2>
          <p>{canManage ? 'Sube el primer documento de este trabajador.' : 'Recibirás una notificación cuando se agreguen documentos.'}</p>
        </section>
      )}
      {message && !showUpload && <p className="form-message error">{message}</p>}

      {showUpload && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowUpload(false)}>
          <form className="modal document-modal" onSubmit={handleUpload}>
            <div className="modal-header">
              <div><p className="eyebrow">{employee.name}</p><h2>Subir documento</h2></div>
              <button className="icon-button" type="button" onClick={() => setShowUpload(false)}><Icon name="close" /></button>
            </div>
            <div className="form-grid">
              <label className="field"><span>Tipo de documento</span><select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{documentTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="field"><span>Fecha de vencimiento</span><input type="date" value={form.expiryDate} onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))} /></label>
              <label className="field field-wide"><span>Observaciones</span><textarea rows="3" maxLength="500" value={form.observations} onChange={(event) => setForm((current) => ({ ...current, observations: event.target.value }))} placeholder="Información útil sobre el documento" /></label>
              <label className="upload-zone field-wide" onClick={() => fileInput.current?.click()}>
                <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(event) => setFile(event.target.files?.[0] || null)} />
                <Icon name="upload" size={25} />
                <strong>{file ? file.name : 'Selecciona un archivo'}</strong>
                <span>{file ? formatBytes(file.size) : 'PDF original o imagen - Maximo 12 MB'}</span>
              </label>
            </div>
            {message && <p className="form-message error">{message}</p>}
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setShowUpload(false)}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Subiendo…' : 'Subir al expediente'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, tone = '' }) {
  return <article className={`file-summary-card ${tone}`}><span><Icon name={icon} /></span><div><strong>{value}</strong><p>{label}</p></div></article>;
}

function DataItem({ label, value }) {
  return <div className="employee-file-data-item"><span>{label}</span><strong>{value}</strong></div>;
}

function documentSummary(documents) {
  const presentRequired = new Set(documents.filter((item) => documentTypeFor(item.category)?.required).map((item) => documentTypeFor(item.category)?.id));
  const requiredCount = documentTypes.filter((item) => item.required).length;
  const states = documents.map((item) => expiryState(item.expiryDate));
  return {
    completion: requiredCount ? Math.round((presentRequired.size / requiredCount) * 100) : 100,
    requiredReady: presentRequired.size,
    requiredCount,
    missingRequired: Math.max(requiredCount - presentRequired.size, 0),
    expired: states.filter((item) => item.type === 'expired').length,
    soon: states.filter((item) => item.type === 'soon').length,
    alerts: Math.max(requiredCount - presentRequired.size, 0) + states.filter((item) => ['expired', 'soon'].includes(item.type)).length,
  };
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
  if (days <= 30) return { type: 'soon', label: days === 0 ? 'Vence hoy' : `Vence en ${days} días` };
  return { type: 'ok', label: 'Vigente' };
}

function initials(name = '') { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—'; }
function timestampValue(value) { return value ? new Date(value).getTime() : 0; }
function formatTimestamp(value) { return value ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Recién subido'; }
function formatDate(value) { return value ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'Sin registrar'; }
function formatBytes(bytes = 0) { if (!bytes) return '0 KB'; const units = ['B', 'KB', 'MB', 'GB']; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
