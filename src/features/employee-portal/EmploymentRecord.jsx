import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { subscribeRows, updateOwnEmployeeContact } from '../../services/supabaseData';
import './EmploymentRecord.css';

const emptyContact = {
  phone: '',
  personalEmail: '',
  address: '',
  commune: '',
  emergencyContact: '',
  emergencyPhone: '',
};

const fieldLabels = {
  name: 'Nombre legal',
  email: 'Correo corporativo',
  phone: 'Teléfono',
  personalEmail: 'Correo personal',
  rut: 'RUT',
  position: 'Cargo',
  area: 'Área',
  isSupervisor: 'Responsabilidad de supervisor',
  supervisorId: 'Supervisor asignado',
  supervisor: 'Supervisor',
  workLocation: 'Lugar de trabajo',
  contractType: 'Tipo de contrato',
  startDate: 'Fecha de ingreso',
  contractDate: 'Fecha de contrato',
  scheduleStart: 'Hora de entrada',
  scheduleEnd: 'Hora de salida',
  weeklyHours: 'Horas semanales',
  baseSalary: 'Sueldo base',
  address: 'Dirección',
  commune: 'Comuna',
  emergencyContact: 'Contacto de emergencia',
  emergencyPhone: 'Teléfono de emergencia',
  biometricConsent: 'Consentimiento biométrico',
  status: 'Estado laboral',
};

export function EmploymentRecord() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyContact);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('');

  useEffect(() => subscribeRows('employees', (rows) => {
    const ownRecord = rows[0] || null;
    setEmployee(ownRecord);
    setLoading(false);
    if (ownRecord) setForm(contactFromEmployee(ownRecord));
  }, {
    filters: [['email', user.email.toLowerCase()]],
    orderBy: 'name',
    ascending: true,
  }), [user.email]);

  useEffect(() => {
    if (!employee?.id) {
      setHistory([]);
      return undefined;
    }
    return subscribeRows('employeeChangeLog', setHistory, {
      filters: [['employeeId', employee.id]],
      orderBy: 'createdAt',
      ascending: false,
    });
  }, [employee?.id]);

  const completion = useMemo(() => {
    if (!employee) return 0;
    const values = [
      employee.phone,
      employee.personalEmail,
      employee.address,
      employee.commune,
      employee.emergencyContact,
      employee.emergencyPhone,
    ];
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [employee]);

  function cancelEdit() {
    setForm(contactFromEmployee(employee));
    setEditing(false);
    setMessage('');
    setMessageTone('');
  }

  async function saveContact(event) {
    event.preventDefault();
    if (form.personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personalEmail)) {
      setMessage('Revisa el formato del correo personal.');
      setMessageTone('error');
      return;
    }
    setSaving(true);
    setMessage('');
    setMessageTone('');
    try {
      const updated = await updateOwnEmployeeContact(form);
      setEmployee(updated);
      setForm(contactFromEmployee(updated));
      setEditing(false);
      setMessage('Datos personales actualizados. El cambio quedó registrado en el historial.');
      setMessageTone('success');
    } catch (error) {
      setMessage(`No se pudieron guardar tus datos: ${error.message}`);
      setMessageTone('error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="screen-center">Cargando ficha laboral…</div>;

  if (!employee) {
    return (
      <div className="page employment-record-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Mi información</p>
            <h1>Mi ficha laboral</h1>
          </div>
        </header>
        <section className="panel record-missing-state">
          <span><Icon name="alert" size={27} /></span>
          <div>
            <h2>Tu cuenta aún no tiene una ficha vinculada</h2>
            <p>Solicita a Administración que cree o vincule una ficha con el correo <strong>{user.email}</strong>.</p>
          </div>
          <Link className="primary-button" to="/ayuda">Solicitar ayuda</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page employment-record-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Mi información</p>
          <h1>Mi ficha laboral</h1>
          <p className="page-subtitle">Consulta tu relación laboral y mantén actualizados tus datos personales.</p>
        </div>
        <Link className="secondary-button" to="/solicitudes?tipo=Corrección%20de%20ficha%20laboral">
          <Icon name="edit" size={16} /> Solicitar una corrección
        </Link>
      </header>

      <section className="record-hero">
        <span className="record-avatar">{initials(employee.name)}</span>
        <div className="record-hero-copy">
          <p>Ficha laboral vigente</p>
          <h2>{employee.name}</h2>
          <span>{employee.position || 'Cargo por confirmar'} · {employee.area || 'Área por confirmar'}</span>
        </div>
        <div className="record-hero-meta">
          <span className={`record-status status-${slug(employee.status)}`}>{employee.status || 'Pendiente'}</span>
          <small>{employee.employeeCode ? `Código ${employee.employeeCode}` : `RUT ${employee.rut || 'sin registrar'}`}</small>
        </div>
      </section>

      <section className="record-responsibility-strip">
        <span><Icon name="shield" size={18} /></span>
        <div>
          <strong>Responsabilidades claras</strong>
          <p>Tú mantienes tus datos de contacto. Administración controla contrato, cargo, sueldo, jornada y jefatura.</p>
        </div>
        <b>{completion}% datos personales</b>
      </section>

      {message && <p className={`record-feedback ${messageTone}`}>{message}</p>}

      <div className="record-layout">
        <form className="panel record-contact-card" onSubmit={saveContact}>
          <div className="record-section-heading">
            <div>
              <p className="eyebrow">Autoservicio</p>
              <h2>Datos personales</h2>
              <span>Puedes modificarlos directamente. Cada cambio queda auditado.</span>
            </div>
            {!editing && (
              <button className="secondary-button" type="button" onClick={() => setEditing(true)}>
                <Icon name="edit" size={15} /> Editar
              </button>
            )}
          </div>

          <div className="record-edit-grid">
            <ContactField label="Teléfono personal" name="phone" value={form.phone} setForm={setForm} disabled={!editing} placeholder="+56 9…" />
            <ContactField label="Correo personal" name="personalEmail" value={form.personalEmail} setForm={setForm} disabled={!editing} type="email" placeholder="nombre@correo.cl" />
            <ContactField label="Dirección" name="address" value={form.address} setForm={setForm} disabled={!editing} wide placeholder="Calle, número y departamento" />
            <ContactField label="Comuna" name="commune" value={form.commune} setForm={setForm} disabled={!editing} placeholder="Comuna" />
            <ContactField label="Contacto de emergencia" name="emergencyContact" value={form.emergencyContact} setForm={setForm} disabled={!editing} placeholder="Nombre y relación" />
            <ContactField label="Teléfono de emergencia" name="emergencyPhone" value={form.emergencyPhone} setForm={setForm} disabled={!editing} placeholder="+56 9…" />
          </div>

          {editing && (
            <div className="record-form-actions">
              <button className="secondary-button" type="button" onClick={cancelEdit}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar datos'}</button>
            </div>
          )}
        </form>

        <section className="panel record-supervisor-card">
          <span><Icon name="users" size={21} /></span>
          <p className="eyebrow">Ruta de gestión</p>
          <h2>{employee.supervisor || 'Administración RR. HH.'}</h2>
          <p>{employee.supervisorId
            ? 'Es tu supervisor directo y recibe primero las solicitudes que requieren aprobación.'
            : 'No tienes supervisor asignado; tus solicitudes llegan directamente a Administración.'}</p>
          <div>
            <small>Lugar de trabajo</small>
            <strong>{employee.workLocation || 'Por definir'}</strong>
          </div>
        </section>

        <RecordSection
          title="Relación laboral"
          eyebrow="Administración"
          description="Estos datos afectan organización, permisos y responsabilidades."
          items={[
            ['Cargo', employee.position],
            ['Área', employee.area],
            ['Supervisor', employee.supervisor],
            ['Lugar de trabajo', employee.workLocation],
            ['Rol de supervisión', employee.isSupervisor ? 'Sí, tiene equipo a cargo' : 'No'],
            ['Estado', employee.status],
          ]}
        />

        <RecordSection
          title="Contrato y jornada"
          eyebrow="Información protegida"
          description="Solo Administración puede modificar estos antecedentes."
          items={[
            ['Tipo de contrato', employee.contractType],
            ['Fecha de ingreso', formatDate(employee.startDate)],
            ['Fecha de contrato', formatDate(employee.contractDate)],
            ['Horario', `${employee.scheduleStart || '--:--'} a ${employee.scheduleEnd || '--:--'}`],
            ['Horas semanales', employee.weeklyHours ? `${employee.weeklyHours} horas` : 'Sin registrar'],
            ['Sueldo base', formatMoney(employee.baseSalary)],
          ]}
        />

        <section className="panel record-history-card">
          <div className="record-section-heading">
            <div>
              <p className="eyebrow">Trazabilidad</p>
              <h2>Historial de cambios</h2>
              <span>Últimas modificaciones realizadas en tu ficha.</span>
            </div>
            <Icon name="clock" size={20} />
          </div>
          <div className="record-history-list">
            {history.slice(0, 6).map((entry) => <HistoryItem entry={entry} key={entry.id} />)}
            {!history.length && (
              <div className="record-empty-history">
                <Icon name="check" size={18} />
                <span><strong>Sin cambios recientes</strong><small>Las próximas modificaciones aparecerán aquí.</small></span>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="record-correction-banner">
        <span><Icon name="help" size={21} /></span>
        <div>
          <strong>¿Encontraste un dato laboral incorrecto?</strong>
          <p>Solicita la corrección de nombre legal, RUT, cargo, contrato, jornada, sueldo o supervisor. Quedará trazabilidad de la revisión.</p>
        </div>
        <Link className="primary-button" to="/solicitudes?tipo=Corrección%20de%20ficha%20laboral">Crear solicitud</Link>
      </section>
    </div>
  );
}

function ContactField({ label, name, value, setForm, disabled, wide = false, type = 'text', placeholder = '' }) {
  const maxLengths = { phone: 40, personalEmail: 160, address: 240, commune: 100, emergencyContact: 100, emergencyPhone: 40 };
  return (
    <label className={`field${wide ? ' field-wide' : ''}`}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        maxLength={maxLengths[name] || 100}
        placeholder={placeholder}
        onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
      />
    </label>
  );
}

function RecordSection({ title, eyebrow, description, items }) {
  return (
    <section className="panel record-info-card">
      <div className="record-section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <span>{description}</span>
        </div>
        <span className="record-lock"><Icon name="shield" size={17} /></span>
      </div>
      <dl>
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || 'Sin registrar'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function HistoryItem({ entry }) {
  const fields = (entry.changedFields || []).slice(0, 3);
  return (
    <article className="record-history-item">
      <span><Icon name={entry.source === 'self_service' ? 'user' : 'shield'} size={15} /></span>
      <div>
        <strong>{entry.source === 'self_service' ? 'Actualización personal' : entry.source === 'admin' ? 'Cambio administrativo' : 'Actualización del sistema'}</strong>
        <p>{fields.map((field) => fieldLabels[field] || field).join(', ')}{(entry.changedFields || []).length > 3 ? ` y ${(entry.changedFields || []).length - 3} más` : ''}</p>
        <small>{formatTimestamp(entry.createdAt)}</small>
      </div>
    </article>
  );
}

function contactFromEmployee(employee) {
  if (!employee) return emptyContact;
  return {
    phone: employee.phone || '',
    personalEmail: employee.personalEmail || '',
    address: employee.address || '',
    commune: employee.commune || '',
    emergencyContact: employee.emergencyContact || '',
    emergencyPhone: employee.emergencyPhone || '',
  };
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
}

function slug(value = '') {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
}

function formatDate(value) {
  if (!value) return 'Sin registrar';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function formatTimestamp(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatMoney(value) {
  if (!Number(value)) return 'Sin registrar';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}
