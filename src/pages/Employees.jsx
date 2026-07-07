import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/AppLayout';
import { insertRow, subscribeRows, updateRow } from '../services/supabaseData';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  rut: '',
  position: '',
  area: '',
  supervisor: '',
  supervisorWhatsapp: '',
  workLocation: '',
  contractType: 'Indefinido',
  startDate: '',
  contractDate: '',
  scheduleStart: '08:00',
  scheduleEnd: '18:00',
  weeklyHours: 44,
  baseSalary: 0,
  emergencyContact: '',
  emergencyPhone: '',
  biometricConsent: false,
  status: 'Activo',
};

const statusOptions = ['Activo', 'Pendiente', 'Inactivo'];
const contractOptions = ['Indefinido', 'Plazo fijo', 'Part time', 'Honorarios', 'Practica'];
const employeeDraftKey = 'rrhh-mossaspa-employee-draft';

function readEmployeeDraft() {
  try {
    const draft = window.localStorage.getItem(employeeDraftKey);
    return draft ? { ...emptyForm, ...JSON.parse(draft) } : emptyForm;
  } catch {
    return emptyForm;
  }
}

function writeEmployeeDraft(form) {
  try {
    window.localStorage.setItem(employeeDraftKey, JSON.stringify(form));
  } catch {
    // localStorage can be unavailable in private windows; the form still works in memory.
  }
}

function clearEmployeeDraft() {
  try {
    window.localStorage.removeItem(employeeDraftKey);
  } catch {
    // Nothing to clear.
  }
}

export function Employees() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => subscribeRows('employees', setEmployees, { orderBy: 'name', ascending: true }), []);

  const summary = useMemo(() => {
    const active = employees.filter((item) => item.status === 'Activo').length;
    const pending = employees.filter((item) => item.status === 'Pendiente').length;
    const enrolled = employees.filter((item) => item.biometricEnrolled).length;
    const areas = new Set(employees.map((item) => item.area).filter(Boolean)).size;
    return { active, pending, enrolled, areas };
  }, [employees]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((item) => {
      const matchesText = [
        item.name,
        item.email,
        item.rut,
        item.position,
        item.area,
        item.supervisor,
        item.workLocation,
      ].some((value) => value?.toLowerCase().includes(term));
      const matchesFilter = filter === 'Todos' || item.status === filter;
      return matchesText && matchesFilter;
    });
  }, [employees, search, filter]);

  function openCreate() {
    setEditing('new');
    setForm(readEmployeeDraft());
    setMessage('');
  }

  function openEdit(employee) {
    setEditing(employee.id);
    setForm(Object.fromEntries(Object.keys(emptyForm).map((key) => [key, employee[key] ?? emptyForm[key]])));
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setMessage('Nombre y correo son obligatorios.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        weeklyHours: Number(form.weeklyHours || 0),
        baseSalary: Number(form.baseSalary || 0),
        updatedAt: new Date().toISOString(),
      };

      if (editing === 'new') {
        await insertRow('employees', { ...payload, createdAt: new Date().toISOString() });
      } else {
        await updateRow('employees', editing, payload);
      }

      setEditing(null);
      setForm(emptyForm);
      if (editing === 'new') clearEmployeeDraft();
    } catch (error) {
      if (editing === 'new') writeEmployeeDraft(form);
      setMessage(error.code === '42501'
        ? 'Supabase rechazo el guardado: falta ejecutar el SQL de admin en la base de datos. Tu borrador quedo guardado en este navegador.'
        : `No se pudo guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  function updateForm(updater) {
    setForm((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (editing === 'new') writeEmployeeDraft(next);
      return next;
    });
  }

  const canEdit = profile?.role === 'admin';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Personas</p>
          <h1>Colaboradores</h1>
          <p className="page-subtitle">Ficha laboral, jornada, contrato, sueldo base y datos operativos del equipo.</p>
        </div>
        {canEdit && (
          <button className="primary-button" type="button" onClick={openCreate}>
            <Icon name="plus" /> Nuevo colaborador
          </button>
        )}
      </header>

      <section className="file-summary-grid employees-summary">
        <SummaryCard icon="users" label="Activos" value={summary.active} />
        <SummaryCard icon="clock" label="Pendientes" value={summary.pending} tone="warning" />
        <SummaryCard icon="fingerprint" label="Con biometria" value={`${summary.enrolled}/${employees.length}`} />
        <SummaryCard icon="briefcase" label="Areas" value={summary.areas} />
      </section>

      <section className="toolbar">
        <label className="search-box">
          <Icon name="search" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, RUT, cargo, area o supervisor" />
        </label>
        <div className="filter-tabs">
          {['Todos', ...statusOptions].map((status) => (
            <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)} type="button">{status}</button>
          ))}
        </div>
      </section>

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Cargo / area</th>
                <th>Jornada</th>
                <th>Contrato</th>
                <th>Sueldo base</th>
                <th>Estado</th>
                <th>Biometria</th>
                {canEdit && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div className="employee-cell">
                      <span className="avatar avatar-soft">{initials(employee.name)}</span>
                      <span>
                        <strong>{employee.name}</strong>
                        <small>{employee.email}{employee.rut ? ` - ${employee.rut}` : ''}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="stacked-cell">
                      <strong>{employee.position || 'Cargo por definir'}</strong>
                      <small>{employee.area || 'Area sin definir'}</small>
                    </div>
                  </td>
                  <td>{employee.scheduleStart || '--:--'} - {employee.scheduleEnd || '--:--'}</td>
                  <td>{employee.contractType || 'Sin definir'}</td>
                  <td>{formatMoney(employee.baseSalary)}</td>
                  <td><span className={`status-pill status-${slug(employee.status)}`}>{employee.status || 'Pendiente'}</span></td>
                  <td>
                    <span className={`mini-badge ${employee.biometricEnrolled ? 'ready' : employee.biometricConsent ? 'warning' : ''}`}>
                      {employee.biometricEnrolled ? 'Enrolado' : employee.biometricConsent ? 'Consentido' : 'Pendiente'}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <div className="row-actions">
                        <button className="table-action" type="button" onClick={() => openEdit(employee)} title="Editar">
                          <Icon name="edit" size={17} />
                        </button>
                        <button
                          className={`table-action ${employee.biometricEnrolled ? 'success-action' : 'warning-action'}`}
                          type="button"
                          onClick={() => navigate(`/biometria/${employee.id}`)}
                          title={employee.biometricEnrolled ? 'Actualizar enrolamiento' : 'Enrolar rostro'}
                        >
                          <Icon name="scan" size={17} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && <div className="empty-state large"><Icon name="search" size={30} /><p>No encontramos colaboradores con esos filtros.</p></div>}
      </section>

      {editing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}>
          <form className="modal employee-modal" onSubmit={handleSubmit}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Ficha laboral</p>
                <h2>{editing === 'new' ? 'Nuevo colaborador' : 'Editar colaborador'}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setEditing(null)}><Icon name="close" /></button>
            </div>

            <FormSection title="Identificacion">
              <Field label="Nombre completo" name="name" value={form.name} setForm={updateForm} required />
              <Field label="Correo corporativo" name="email" value={form.email} setForm={updateForm} type="email" required />
              <Field label="Telefono" name="phone" value={form.phone} setForm={updateForm} />
              <Field label="RUT" name="rut" value={form.rut} setForm={updateForm} />
              <SelectField label="Estado" name="status" value={form.status} setForm={updateForm} options={statusOptions} />
            </FormSection>

            <FormSection title="Datos laborales">
              <Field label="Cargo" name="position" value={form.position} setForm={updateForm} />
              <Field label="Area" name="area" value={form.area} setForm={updateForm} />
              <Field label="Supervisor" name="supervisor" value={form.supervisor} setForm={updateForm} />
              <Field label="WhatsApp supervisor" name="supervisorWhatsapp" value={form.supervisorWhatsapp} setForm={updateForm} />
              <Field label="Sede / ubicacion" name="workLocation" value={form.workLocation} setForm={updateForm} />
              <SelectField label="Tipo de contrato" name="contractType" value={form.contractType} setForm={updateForm} options={contractOptions} />
              <MoneyField label="Sueldo base" name="baseSalary" value={form.baseSalary} setForm={updateForm} />
              <Field label="Fecha de ingreso" name="startDate" value={form.startDate} setForm={updateForm} type="date" />
              <Field label="Fecha de contrato" name="contractDate" value={form.contractDate} setForm={updateForm} type="date" />
            </FormSection>

            <FormSection title="Jornada y emergencia">
              <Field label="Entrada" name="scheduleStart" value={form.scheduleStart} setForm={updateForm} type="time" />
              <Field label="Salida" name="scheduleEnd" value={form.scheduleEnd} setForm={updateForm} type="time" />
              <Field label="Horas semanales" name="weeklyHours" value={form.weeklyHours} setForm={updateForm} type="number" />
              <Field label="Contacto emergencia" name="emergencyContact" value={form.emergencyContact} setForm={updateForm} />
              <Field label="Telefono emergencia" name="emergencyPhone" value={form.emergencyPhone} setForm={updateForm} />
              <label className="consent-field field-wide">
                <input
                  type="checkbox"
                  checked={Boolean(form.biometricConsent)}
                  onChange={(event) => updateForm((current) => ({ ...current, biometricConsent: event.target.checked }))}
                />
                <span>
                  <strong>Consentimiento biometrico registrado</strong>
                  <small>El trabajador autorizo el uso de reconocimiento facial para control de asistencia.</small>
                </span>
              </label>
            </FormSection>

            {message && <p className="form-message error">{message}</p>}
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar colaborador'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, tone = '' }) {
  return <article className={`file-summary-card ${tone}`}><span><Icon name={icon} /></span><div><strong>{value}</strong><p>{label}</p></div></article>;
}

function FormSection({ title, children }) {
  return (
    <section className="employee-form-section">
      <h3>{title}</h3>
      <div className="form-grid">{children}</div>
    </section>
  );
}

function Field({ label, name, value, setForm, type = 'text', required = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value ?? ''} required={required} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} />
    </label>
  );
}

function MoneyField({ label, name, value, setForm }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" min="0" step="10000" value={value ?? 0} onChange={(event) => setForm((current) => ({ ...current, [name]: Number(event.target.value || 0) }))} />
    </label>
  );
}

function SelectField({ label, name, value, setForm, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}>
        {options.map((item) => <option key={item}>{item}</option>)}
      </select>
    </label>
  );
}

function initials(name = '') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '-';
}

function slug(value = '') {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
}
