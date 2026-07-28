import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import {
  createAccount,
  deleteAccount,
  inviteAccount,
  listAccounts,
  sendAccountRecovery,
  setAccountStatus,
  updateAccountRole,
} from '../../services/accountAdmin';
import './AccountManagement.css';

const ROLE_COPY = {
  admin: {
    label: 'Administrador',
    description: 'Control total de RRHH, cuentas, documentos y configuraciones.',
    permissions: ['Gestión completa de colaboradores', 'Remuneraciones y expedientes', 'Usuarios, roles y seguridad'],
  },
  employee: {
    label: 'Colaborador',
    description: 'Autoservicio personal con acceso exclusivamente a sus propios datos.',
    permissions: ['Descarga de documentos propios', 'Liquidaciones y solicitudes personales', 'Directorio interno y perfil'],
  },
};

export function AccountManagement() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [audit, setAudit] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [credentials, setCredentials] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const result = await listAccounts();
      setAccounts(result.users || []);
      setAudit(result.audit || []);
      setTotal(result.total || result.users?.length || 0);
    } catch (loadError) {
      setError(normalizeError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => ({
    active: accounts.filter((account) => account.status === 'active').length,
    admins: accounts.filter((account) => account.role === 'admin' && account.status === 'active').length,
    pending: accounts.filter((account) => !account.emailConfirmed).length,
    suspended: accounts.filter((account) => account.status === 'suspended').length,
  }), [accounts]);

  const visibleAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesSearch = !term || [
        account.displayName,
        account.email,
        account.employee?.position,
        account.employee?.area,
      ].some((value) => value?.toLowerCase().includes(term));
      const matchesRole = roleFilter === 'all' || account.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [accounts, roleFilter, search, statusFilter]);

  async function handleCreated(result, temporaryPassword) {
    setCreateOpen(false);
    setCredentials(temporaryPassword ? {
      email: result.user.email,
      password: temporaryPassword,
    } : null);
    setNotice(result.message);
    await load({ quiet: true });
  }

  async function handleAccountChanged(message) {
    setSelected(null);
    setNotice(message);
    await load({ quiet: true });
  }

  return (
    <div className="page account-page">
      <header className="account-header">
        <div>
          <p className="portal-kicker"><Icon name="shield" size={15} /> Administración de accesos</p>
          <h1>Usuarios y permisos</h1>
          <p>Control centralizado de cuentas, roles, estado de acceso y recuperación de credenciales.</p>
        </div>
        <button className="account-primary-button" type="button" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={17} /> Nueva cuenta
        </button>
      </header>

      <section className="account-security-note">
        <span><Icon name="shield" size={19} /></span>
        <div>
          <strong>Acceso basado en roles y mínimo privilegio</strong>
          <p>Las operaciones sensibles se validan en el servidor. Ninguna clave administrativa se expone en el navegador.</p>
        </div>
        <small>RBAC activo</small>
      </section>

      {notice && (
        <section className="account-feedback success" role="status">
          <Icon name="check" size={18} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Cerrar mensaje"><Icon name="close" size={16} /></button>
        </section>
      )}

      {credentials && (
        <CredentialCard credentials={credentials} onClose={() => setCredentials(null)} />
      )}

      {error && (
        <section className="account-feedback error" role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => load()}><Icon name="arrow" size={15} /> Reintentar</button>
        </section>
      )}

      <section className="account-metrics" aria-label="Resumen de cuentas">
        <Metric icon="users" label="Cuentas registradas" value={total} tone="green" />
        <Metric icon="check" label="Accesos activos" value={stats.active} tone="blue" />
        <Metric icon="shield" label="Administradores" value={stats.admins} tone="purple" />
        <Metric icon="alert" label="Pendientes / suspendidas" value={stats.pending + stats.suspended} tone="amber" />
      </section>

      <section className="account-content-grid">
        <div className="account-directory-panel">
          <div className="account-panel-heading">
            <div>
              <p className="portal-kicker">Directorio de acceso</p>
              <h2>Cuentas del sistema</h2>
            </div>
            <span>{visibleAccounts.length} visibles</span>
          </div>

          <div className="account-toolbar">
            <label className="account-search">
              <Icon name="search" size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, correo, cargo o área"
              />
            </label>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filtrar por rol">
              <option value="all">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="employee">Colaboradores</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por estado">
              <option value="all">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="suspended">Suspendidas</option>
            </select>
          </div>

          <div className="account-table-wrap">
            <table className="account-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Último acceso</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }, (_, index) => <AccountSkeleton key={index} />)}
                {!loading && visibleAccounts.map((account) => (
                  <AccountRow
                    account={account}
                    currentUserId={user?.id}
                    key={account.id}
                    onManage={() => setSelected(account)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {!loading && !visibleAccounts.length && !error && (
            <div className="account-empty">
              <span><Icon name="search" size={24} /></span>
              <strong>No encontramos cuentas</strong>
              <p>Prueba ajustando la búsqueda o los filtros.</p>
            </div>
          )}
        </div>

        <aside className="account-side-column">
          <RoleMatrix />
          <AuditTimeline events={audit} />
        </aside>
      </section>

      {createOpen && (
        <CreateAccountModal
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {selected && (
        <ManageAccountModal
          account={selected}
          isCurrentUser={selected.id === user?.id}
          onClose={() => setSelected(null)}
          onChanged={handleAccountChanged}
        />
      )}
    </div>
  );
}

function Metric({ icon, label, value, tone }) {
  return (
    <article className={`account-metric ${tone}`}>
      <span><Icon name={icon} size={19} /></span>
      <div><strong>{value}</strong><small>{label}</small></div>
    </article>
  );
}

function AccountRow({ account, currentUserId, onManage }) {
  const current = account.id === currentUserId;
  return (
    <tr>
      <td>
        <div className="account-person">
          <span className="account-avatar">{initials(account.displayName || account.email)}</span>
          <div>
            <strong>{account.displayName || account.employee?.name || 'Nombre pendiente'}</strong>
            <small>{account.email}</small>
            {account.employee && <em>{account.employee.position || 'Cargo sin definir'} · {account.employee.area || 'Sin área'}</em>}
          </div>
        </div>
      </td>
      <td><RoleBadge role={account.role} /></td>
      <td><StatusBadge account={account} /></td>
      <td><span className="account-last-seen">{formatRelative(account.lastSignInAt)}</span></td>
      <td>
        <button className="account-manage-button" type="button" onClick={onManage}>
          {current ? 'Ver mi acceso' : 'Gestionar'} <Icon name="arrow" size={14} />
        </button>
      </td>
    </tr>
  );
}

function RoleBadge({ role }) {
  return (
    <span className={`account-role-badge ${role}`}>
      <Icon name={role === 'admin' ? 'shield' : 'user'} size={13} />
      {ROLE_COPY[role]?.label || role}
    </span>
  );
}

function StatusBadge({ account }) {
  const pending = !account.emailConfirmed;
  const status = account.status === 'suspended' ? 'suspended' : pending ? 'pending' : 'active';
  const label = status === 'suspended' ? 'Suspendida' : status === 'pending' ? 'Invitación pendiente' : 'Activa';
  return <span className={`account-status-badge ${status}`}><i /> {label}</span>;
}

function RoleMatrix() {
  return (
    <section className="account-side-card role-matrix">
      <div className="account-panel-heading compact">
        <div><p className="portal-kicker">Matriz de acceso</p><h2>Permisos por rol</h2></div>
      </div>
      {Object.entries(ROLE_COPY).map(([role, copy]) => (
        <article className="role-matrix-item" key={role}>
          <div className="role-matrix-title">
            <span><Icon name={role === 'admin' ? 'shield' : 'user'} size={16} /></span>
            <div><strong>{copy.label}</strong><p>{copy.description}</p></div>
          </div>
          <ul>
            {copy.permissions.map((permission) => <li key={permission}><Icon name="check" size={13} /> {permission}</li>)}
          </ul>
        </article>
      ))}
    </section>
  );
}

function AuditTimeline({ events }) {
  return (
    <section className="account-side-card">
      <div className="account-panel-heading compact">
        <div><p className="portal-kicker">Trazabilidad</p><h2>Actividad reciente</h2></div>
      </div>
      <div className="account-audit-list">
        {events.slice(0, 6).map((event) => (
          <article key={event.id}>
            <span><Icon name={auditIcon(event.action)} size={14} /></span>
            <div>
              <strong>{auditLabel(event.action)}</strong>
              <p>{event.target_email}</p>
              <small>{formatDateTime(event.created_at)} · {event.actor_email}</small>
            </div>
          </article>
        ))}
        {!events.length && <p className="account-audit-empty">Las modificaciones de cuentas aparecerán aquí.</p>}
      </div>
    </section>
  );
}

function CredentialCard({ credentials, onClose }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`Usuario: ${credentials.email}\nContraseña temporal: ${credentials.password}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="credential-card">
      <span className="credential-icon"><Icon name="key" size={21} /></span>
      <div>
        <p className="portal-kicker">Entrega segura</p>
        <h2>Credenciales temporales del colaborador</h2>
        <p>Compártelas por un canal seguro y solicita cambiar la contraseña en el primer ingreso.</p>
        <dl>
          <div><dt>Usuario</dt><dd>{credentials.email}</dd></div>
          <div><dt>Contraseña temporal</dt><dd>{credentials.password}</dd></div>
        </dl>
      </div>
      <div className="credential-actions">
        <button type="button" onClick={copy}><Icon name="file" size={15} /> {copied ? 'Copiado' : 'Copiar acceso'}</button>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Ocultar credenciales"><Icon name="close" size={16} /></button>
      </div>
    </section>
  );
}

function CreateAccountModal({ onClose, onCreated }) {
  const [mode, setMode] = useState('temporary');
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: generatePassword(),
    role: 'employee',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        displayName: form.displayName.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        redirectTo: `${window.location.origin}/login`,
      };
      const result = mode === 'invite'
        ? await inviteAccount(payload)
        : await createAccount({ ...payload, password: form.password });
      await onCreated(result, mode === 'temporary' ? form.password : '');
    } catch (submitError) {
      setError(normalizeError(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Crear una cuenta" subtitle="Alta controlada de acceso al portal" onClose={onClose}>
      <form className="account-modal-form" onSubmit={submit}>
        <div className="account-mode-picker">
          <button className={mode === 'temporary' ? 'active' : ''} type="button" onClick={() => setMode('temporary')}>
            <Icon name="key" size={17} /><span><strong>Contraseña temporal</strong><small>Acceso inmediato y confirmado</small></span>
          </button>
          <button className={mode === 'invite' ? 'active' : ''} type="button" onClick={() => setMode('invite')}>
            <Icon name="mail" size={17} /><span><strong>Invitación por correo</strong><small>El usuario configura su acceso</small></span>
          </button>
        </div>

        <div className="account-form-grid">
          <label>
            <span>Nombre completo</span>
            <input required value={form.displayName} onChange={(event) => update('displayName', event.target.value)} placeholder="Nombre del colaborador" />
          </label>
          <label>
            <span>Correo corporativo</span>
            <input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="persona@mossaspa.cl" />
          </label>
          {mode === 'temporary' && (
            <label className="field-wide">
              <span>Contraseña temporal</span>
              <div className="account-password-field">
                <input required minLength={10} value={form.password} onChange={(event) => update('password', event.target.value)} />
                <button type="button" onClick={() => update('password', generatePassword())}>Regenerar</button>
              </div>
              <small>Incluye mayúsculas, minúsculas y números. Se mostrará una sola vez al finalizar.</small>
            </label>
          )}
        </div>

        <fieldset className="account-role-options">
          <legend>Rol y permisos iniciales</legend>
          {Object.entries(ROLE_COPY).map(([role, copy]) => (
            <label className={form.role === role ? 'selected' : ''} key={role}>
              <input type="radio" name="role" value={role} checked={form.role === role} onChange={() => update('role', role)} />
              <span><Icon name={role === 'admin' ? 'shield' : 'user'} size={17} /></span>
              <div><strong>{copy.label}</strong><p>{copy.description}</p></div>
            </label>
          ))}
        </fieldset>

        {error && <div className="account-modal-error" role="alert"><Icon name="alert" size={16} /> {error}</div>}
        <div className="account-modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Creando acceso…' : mode === 'invite' ? 'Enviar invitación' : 'Crear cuenta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ManageAccountModal({ account, isCurrentUser, onClose, onChanged }) {
  const [role, setRole] = useState(account.role);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const changed = role !== account.role;

  async function saveRole() {
    setBusyAction('role');
    setError('');
    try {
      const result = await updateAccountRole(account.id, role);
      await onChanged(result.message);
    } catch (actionError) {
      setError(normalizeError(actionError));
      setBusyAction('');
    }
  }

  async function toggleStatus() {
    const next = account.status === 'suspended' ? 'active' : 'suspended';
    if (next === 'suspended' && !window.confirm(`¿Suspender el acceso de ${account.email}?`)) return;
    setBusyAction('status');
    setError('');
    try {
      const result = await setAccountStatus(account.id, next);
      await onChanged(result.message);
    } catch (actionError) {
      setError(normalizeError(actionError));
      setBusyAction('');
    }
  }

  async function recovery() {
    setBusyAction('recovery');
    setError('');
    try {
      const result = await sendAccountRecovery(account.id);
      await onChanged(result.message);
    } catch (actionError) {
      setError(normalizeError(actionError));
      setBusyAction('');
    }
  }

  async function removeAccount() {
    if (deleteConfirmation.trim().toLowerCase() !== account.email.toLowerCase()) return;
    setBusyAction('delete');
    setError('');
    try {
      const result = await deleteAccount(account.id);
      await onChanged(result.message);
    } catch (actionError) {
      setError(normalizeError(actionError));
      setBusyAction('');
    }
  }

  return (
    <Modal title="Gestionar permisos" subtitle={account.email} onClose={onClose}>
      <div className="manage-account-summary">
        <span className="account-avatar large">{initials(account.displayName || account.email)}</span>
        <div>
          <h3>{account.displayName || account.employee?.name || 'Nombre pendiente'}</h3>
          <p>{account.employee?.position || 'Cuenta sin ficha laboral vinculada'}</p>
        </div>
        <StatusBadge account={account} />
      </div>

      {isCurrentUser && (
        <div className="account-self-warning">
          <Icon name="shield" size={17} />
          Tu propia cuenta está protegida: otro administrador debe modificar su rol o estado.
        </div>
      )}

      <fieldset className="account-role-options manage">
        <legend>Permisos por rol</legend>
        {Object.entries(ROLE_COPY).map(([roleValue, copy]) => (
          <label className={role === roleValue ? 'selected' : ''} key={roleValue}>
            <input
              type="radio"
              name="managed-role"
              value={roleValue}
              checked={role === roleValue}
              disabled={isCurrentUser}
              onChange={() => setRole(roleValue)}
            />
            <span><Icon name={roleValue === 'admin' ? 'shield' : 'user'} size={17} /></span>
            <div>
              <strong>{copy.label}</strong>
              <p>{copy.description}</p>
              <ul>{copy.permissions.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </label>
        ))}
      </fieldset>

      <div className="account-secondary-actions">
        <button type="button" onClick={recovery} disabled={Boolean(busyAction)}>
          <Icon name="mail" size={16} />
          <span><strong>Recuperar contraseña</strong><small>Enviar enlace seguro al correo</small></span>
        </button>
        <button
          type="button"
          className={account.status === 'suspended' ? 'reactivate' : 'suspend'}
          onClick={toggleStatus}
          disabled={isCurrentUser || Boolean(busyAction)}
        >
          <Icon name={account.status === 'suspended' ? 'check' : 'userMinus'} size={16} />
          <span>
            <strong>{account.status === 'suspended' ? 'Reactivar cuenta' : 'Suspender cuenta'}</strong>
            <small>{account.status === 'suspended' ? 'Restablecer acceso al portal' : 'Bloquear nuevos inicios de sesión'}</small>
          </span>
        </button>
      </div>

      {!isCurrentUser && (
        <section className="account-danger-zone">
          <div>
            <span><Icon name="trash" size={16} /></span>
            <div>
              <strong>Eliminar cuenta definitivamente</strong>
              <p>Revoca el acceso y elimina el usuario de autenticación. La ficha laboral y sus documentos se conservan.</p>
            </div>
          </div>
          {!deleteOpen ? (
            <button type="button" onClick={() => setDeleteOpen(true)} disabled={Boolean(busyAction)}>
              Eliminar cuenta
            </button>
          ) : (
            <div className="account-delete-confirmation">
              <label>
                Escribe <strong>{account.email}</strong> para confirmar
                <input
                  autoFocus
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  placeholder={account.email}
                />
              </label>
              <div>
                <button
                  type="button"
                  className="cancel"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteConfirmation('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="confirm-delete"
                  onClick={removeAccount}
                  disabled={Boolean(busyAction) || deleteConfirmation.trim().toLowerCase() !== account.email.toLowerCase()}
                >
                  {busyAction === 'delete' ? 'Eliminando…' : 'Confirmar eliminación'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {error && <div className="account-modal-error" role="alert"><Icon name="alert" size={16} /> {error}</div>}
      <div className="account-modal-actions">
        <button type="button" className="secondary" onClick={onClose}>Cerrar</button>
        <button type="button" className="primary" onClick={saveRole} disabled={!changed || isCurrentUser || Boolean(busyAction)}>
          {busyAction === 'role' ? 'Guardando…' : 'Guardar permisos'}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop account-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <header>
          <div><p>{subtitle}</p><h2 id="account-modal-title">{title}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <tr className="account-skeleton">
      <td><span /><i /></td><td><span /></td><td><span /></td><td><span /></td><td><span /></td>
    </tr>
  );
}

function normalizeError(error) {
  const message = error?.message || String(error || '');
  if (/Failed to send a request|FunctionsFetchError/i.test(message)) {
    return 'La función admin-users aún no está desplegada en Supabase. Revisa la guía de instalación.';
  }
  if (/non-2xx|FunctionsHttpError/i.test(message)) {
    return 'Supabase rechazó la operación. Confirma el SQL de cuentas y vuelve a iniciar sesión.';
  }
  return message || 'No se pudo completar la operación.';
}

function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = `${upper}${lower}${digits}`;
  const required = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    digits[randomIndex(digits.length)],
  ];
  while (required.length < 14) required.push(all[randomIndex(all.length)]);
  for (let index = required.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [required[index], required[swapIndex]] = [required[swapIndex], required[index]];
  }
  return required.join('');
}

function randomIndex(max) {
  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return values[0] % max;
}

function initials(value = '') {
  return value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
}

function formatRelative(value) {
  if (!value) return 'Nunca';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days} d`;
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function auditLabel(action) {
  return {
    'account.created': 'Cuenta creada',
    'account.invited': 'Invitación enviada',
    'account.role_changed': 'Permisos modificados',
    'account.suspended': 'Cuenta suspendida',
    'account.reactivated': 'Cuenta reactivada',
    'account.recovery_sent': 'Recuperación enviada',
    'account.deleted': 'Cuenta eliminada',
  }[action] || 'Cuenta actualizada';
}

function auditIcon(action) {
  if (action?.includes('suspended')) return 'userMinus';
  if (action?.includes('deleted')) return 'trash';
  if (action?.includes('role')) return 'shield';
  if (action?.includes('recovery') || action?.includes('invited')) return 'mail';
  return 'user';
}
