import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/AppLayout';
import { subscribeRows, upsertRow } from '../services/supabaseData';

export function Payroll() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeRows('employees', setEmployees, { orderBy: 'name', ascending: true }), []);

  useEffect(() => {
    return subscribeRows('payroll', setPayroll, { orderBy: 'updatedAt', ascending: false });
  }, []);

  const periodRows = useMemo(() => {
    const records = new Map(payroll.filter((item) => item.period === period).map((item) => [item.employeeId, item]));
    return employees.filter((item) => item.status !== 'Inactivo').map((employee) => {
      const record = records.get(employee.id);
      return {
        employee,
        baseSalary: Number(record?.baseSalary || employee.baseSalary || 0),
        bonus: Number(record?.bonus || 0),
        deductions: Number(record?.deductions || 0),
        status: record?.status || 'Borrador',
      };
    });
  }, [employees, payroll, period]);

  const totals = useMemo(() => periodRows.reduce((acc, row) => {
    acc.gross += row.baseSalary + row.bonus;
    acc.deductions += row.deductions;
    acc.net += row.baseSalary + row.bonus - row.deductions;
    acc.closed += row.status === 'Cerrado' ? 1 : 0;
    return acc;
  }, { gross: 0, deductions: 0, net: 0, closed: 0 }), [periodRows]);

  async function saveRow(row, status = row.status) {
    setSaving(true);
    setMessage('');
    try {
      await upsertRow('payroll', {
        id: `${period}_${row.employee.id}`,
        period,
        employeeId: row.employee.id,
        employeeName: row.employee.name,
        ownerEmail: row.employee.email.toLowerCase(),
        position: row.employee.position || '',
        baseSalary: row.baseSalary,
        bonus: row.bonus,
        deductions: row.deductions,
        netPay: row.baseSalary + row.bonus - row.deductions,
        status,
        updatedBy: user.id,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      setMessage(`No se pudo guardar remuneracion: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Remuneraciones</p>
          <h1>Proceso mensual</h1>
          <p className="page-subtitle">Precalculo de sueldos, bonos, descuentos y cierre por trabajador.</p>
        </div>
        <label className="compact-select payroll-period">
          <span>Periodo</span>
          <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
      </header>

      <section className="stats-grid payroll-stats">
        <PayrollStat icon="wallet" label="Haberes" value={formatMoney(totals.gross)} />
        <PayrollStat icon="userMinus" label="Descuentos" value={formatMoney(totals.deductions)} />
        <PayrollStat icon="check" label="Liquido estimado" value={formatMoney(totals.net)} />
        <PayrollStat icon="shield" label="Cerrados" value={`${totals.closed}/${periodRows.length}`} />
      </section>

      <section className="panel table-panel payroll-panel">
        <div className="panel-heading">
          <div>
            <h2>Nomina del periodo</h2>
            <p>Edita montos y cierra liquidaciones cuando esten listas.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Sueldo base</th>
                <th>Bonos</th>
                <th>Descuentos</th>
                <th>Liquido</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {periodRows.map((row) => (
                <PayrollRow key={row.employee.id} row={row} onSave={saveRow} saving={saving} />
              ))}
            </tbody>
          </table>
        </div>
        {!periodRows.length && <div className="empty-state large"><Icon name="users" size={30} /><p>No hay colaboradores activos para remunerar.</p></div>}
      </section>
      {message && <p className="form-message error">{message}</p>}
    </div>
  );
}

function PayrollRow({ row, onSave, saving }) {
  const [draft, setDraft] = useState(row);
  useEffect(() => setDraft(row), [row]);
  const net = draft.baseSalary + draft.bonus - draft.deductions;

  return (
    <tr>
      <td>
        <div className="employee-cell">
          <span className="avatar avatar-soft">{initials(draft.employee.name)}</span>
          <span><strong>{draft.employee.name}</strong><small>{draft.employee.position || 'Cargo sin definir'}</small></span>
        </div>
      </td>
      <td><MoneyInput value={draft.baseSalary} onChange={(value) => setDraft((current) => ({ ...current, baseSalary: value }))} /></td>
      <td><MoneyInput value={draft.bonus} onChange={(value) => setDraft((current) => ({ ...current, bonus: value }))} /></td>
      <td><MoneyInput value={draft.deductions} onChange={(value) => setDraft((current) => ({ ...current, deductions: value }))} /></td>
      <td><strong>{formatMoney(net)}</strong></td>
      <td><span className={`status-pill status-${draft.status === 'Cerrado' ? 'activo' : 'pendiente'}`}>{draft.status}</span></td>
      <td>
        <div className="payroll-actions">
          <button type="button" disabled={saving} onClick={() => onSave(draft, 'Borrador')}>Guardar</button>
          <button type="button" disabled={saving} onClick={() => onSave(draft, 'Cerrado')}>Cerrar</button>
        </div>
      </td>
    </tr>
  );
}

function MoneyInput({ value, onChange }) {
  return <input className="money-input" type="number" min="0" step="1000" value={value} onChange={(event) => onChange(Number(event.target.value || 0))} />;
}

function PayrollStat({ icon, label, value }) {
  return <article className="stat-card"><div className="stat-icon tone-green"><Icon name={icon} /></div><div><p>{label}</p><strong className="money-stat">{value}</strong></div></article>;
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function initials(name = '') { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '-'; }
function formatMoney(value) { return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0)); }
