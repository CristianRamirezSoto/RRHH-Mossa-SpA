import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/AppLayout';
import { subscribeRows, upsertRow } from '../services/supabaseData';

const payrollStatuses = ['Todos', 'Borrador', 'Listo para pago', 'Pendiente pago', 'Pagado'];

export function Payroll() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [filter, setFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('Todas');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('');
  const [savingId, setSavingId] = useState('');

  useEffect(() => subscribeRows('employees', setEmployees, { orderBy: 'name', ascending: true }), []);

  useEffect(() => {
    return subscribeRows('payroll', setPayroll, { orderBy: 'updatedAt', ascending: false });
  }, []);

  const periodRows = useMemo(() => {
    const records = new Map(payroll.filter((item) => item.period === period).map((item) => [item.employeeId, item]));
    return employees.filter((item) => item.status !== 'Inactivo').map((employee) => {
      const record = records.get(employee.id);
      const baseSalary = Number(record?.baseSalary || employee.baseSalary || 0);
      const bonus = Number(record?.bonus || 0);
      const deductions = Number(record?.deductions || 0);
      return {
        employee,
        baseSalary,
        bonus,
        deductions,
        netPay: Number(record?.netPay || baseSalary + bonus - deductions),
        status: record?.status || 'Borrador',
        paymentDate: record?.paymentDate || suggestedPaymentDate(period),
        paymentReference: record?.paymentReference || '',
        notes: record?.notes || '',
        paidAt: record?.paidAt || '',
        updatedAt: record?.updatedAt || '',
      };
    });
  }, [employees, payroll, period]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return periodRows.filter((row) => {
      const matchesStatus = filter === 'Todos' || row.status === filter;
      const matchesArea = areaFilter === 'Todas' || row.employee.area === areaFilter;
      const matchesSearch = !term || [
        row.employee.name,
        row.employee.rut,
        row.employee.email,
        row.employee.position,
        row.employee.area,
      ].some((value) => value?.toLowerCase().includes(term));
      return matchesStatus && matchesArea && matchesSearch;
    });
  }, [periodRows, filter, search, areaFilter]);

  const areaOptions = useMemo(
    () => ['Todas', ...Array.from(new Set(periodRows.map((row) => row.employee.area).filter(Boolean))).sort()],
    [periodRows]
  );

  const statusCounts = useMemo(() => Object.fromEntries(payrollStatuses.map((status) => [
    status,
    status === 'Todos' ? periodRows.length : periodRows.filter((row) => row.status === status).length,
  ])), [periodRows]);

  const totals = useMemo(() => periodRows.reduce((acc, row) => {
    acc.gross += row.baseSalary + row.bonus;
    acc.deductions += row.deductions;
    acc.net += row.netPay;
    acc.ready += row.status === 'Listo para pago' ? 1 : 0;
    acc.pending += row.status === 'Pendiente pago' ? 1 : 0;
    acc.paid += row.status === 'Pagado' ? 1 : 0;
    acc.drafts += row.status === 'Borrador' ? 1 : 0;
    acc.pendingAmount += ['Listo para pago', 'Pendiente pago'].includes(row.status) ? row.netPay : 0;
    acc.paidAmount += row.status === 'Pagado' ? row.netPay : 0;
    return acc;
  }, { gross: 0, deductions: 0, net: 0, ready: 0, pending: 0, paid: 0, drafts: 0, pendingAmount: 0, paidAmount: 0 }), [periodRows]);

  async function saveRow(row, status = row.status) {
    const rowId = `${period}_${row.employee.id}`;
    setSavingId(rowId);
    setMessage('');
    setMessageTone('');
    try {
      await upsertRow('payroll', {
        id: rowId,
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
        paymentDate: row.paymentDate || suggestedPaymentDate(period),
        paymentReference: status === 'Pagado' ? row.paymentReference.trim() : row.paymentReference,
        notes: row.notes.trim(),
        paidAt: status === 'Pagado' ? new Date().toISOString() : row.paidAt || '',
        updatedBy: user.id,
        updatedAt: new Date().toISOString(),
      });
      setMessage(status === 'Pagado' ? 'Pago registrado correctamente.' : 'Remuneracion guardada correctamente.');
      setMessageTone('success');
    } catch (error) {
      setMessage(`No se pudo guardar remuneracion: ${error.message}`);
      setMessageTone('error');
    } finally {
      setSavingId('');
    }
  }

  function exportPayroll() {
    const rows = visibleRows.map((row) => ({
      Trabajador: row.employee.name,
      Cargo: row.employee.position || '',
      Periodo: period,
      'Sueldo base': row.baseSalary,
      Bonos: row.bonus,
      Descuentos: row.deductions,
      Liquido: row.netPay,
      Estado: row.status,
      'Fecha pago': row.paymentDate || '',
      Referencia: row.paymentReference || '',
      Observaciones: row.notes || '',
    }));
    downloadExcelLikeFile(`remuneraciones-${period}.xls`, rows);
  }

  return (
    <div className="page payroll-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Remuneraciones</p>
          <h1>Control mensual de pagos</h1>
          <p className="page-subtitle">Prepara sueldos, marca pendientes por pagar y deja trazabilidad de pagos realizados.</p>
        </div>
        <div className="payroll-header-actions">
          <label className="compact-select payroll-period">
            <span>Periodo</span>
            <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
          </label>
          <button className="secondary-button" type="button" onClick={exportPayroll}><Icon name="download" /> Excel</button>
        </div>
      </header>

      <section className="stats-grid payroll-stats">
        <PayrollStat icon="wallet" label="Liquido total" value={formatMoney(totals.net)} />
        <PayrollStat icon="clock" label="Pendiente por pagar" value={formatMoney(totals.pendingAmount)} tone="warning" />
        <PayrollStat icon="check" label="Pagado" value={formatMoney(totals.paidAmount)} />
        <PayrollStat icon="shield" label="Avance" value={`${totals.paid}/${periodRows.length}`} />
      </section>

      <section className="payroll-alert-strip">
        <div>
          <strong>{totals.ready + totals.pending} pagos requieren accion</strong>
          <span>{totals.drafts} en borrador · {totals.ready} listos · {totals.pending} pendientes · {totals.paid} pagados</span>
        </div>
        <span className={totals.ready + totals.pending ? 'payroll-risk warning' : 'payroll-risk ok'}>
          {totals.ready + totals.pending ? 'Revisar antes del cierre' : 'Periodo sin pendientes'}
        </span>
      </section>

      <section className="payroll-filters-panel">
        <label className="search-box payroll-search">
          <Icon name="search" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar trabajador, RUT, cargo o area" />
        </label>
        <label className="payroll-filter-field">
          <span>Area</span>
          <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
            {areaOptions.map((area) => <option key={area}>{area}</option>)}
          </select>
        </label>
        <div className="payroll-status-filter">
          {payrollStatuses.map((item) => (
            <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              <span>{item}</span>
              <strong>{statusCounts[item] || 0}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="panel payroll-panel">
        <div className="panel-heading">
          <div>
            <h2>Nomina del periodo</h2>
            <p>{visibleRows.length} registros visibles de {periodRows.length} trabajadores activos</p>
          </div>
        </div>
        <div className="payroll-list">
          {visibleRows.map((row) => (
            <PayrollRow key={row.employee.id} row={row} onSave={saveRow} saving={savingId === `${period}_${row.employee.id}`} />
          ))}
        </div>
        {!visibleRows.length && <div className="empty-state large"><Icon name="users" size={30} /><p>No hay colaboradores para este filtro.</p></div>}
      </section>
      {message && <p className={`form-message ${messageTone}`}>{message}</p>}
    </div>
  );
}

function PayrollRow({ row, onSave, saving }) {
  const [draft, setDraft] = useState(row);
  useEffect(() => setDraft(row), [row]);
  const net = draft.baseSalary + draft.bonus - draft.deductions;
  const canPay = draft.status === 'Listo para pago' || draft.status === 'Pendiente pago';

  return (
    <article className="payroll-card">
      <div className="payroll-card-top">
        <div className="payroll-card-header">
          <div className="employee-cell">
            <span className="avatar avatar-soft">{initials(draft.employee.name)}</span>
            <span><strong>{draft.employee.name}</strong><small>{draft.employee.position || 'Cargo sin definir'}{draft.employee.area ? ` - ${draft.employee.area}` : ''}</small></span>
          </div>
          <span className={`payroll-status payroll-${slug(draft.status)}`}>{draft.status}</span>
        </div>

        <div className="payroll-net-box">
          <span>Liquido a pagar</span>
          <strong>{formatMoney(net)}</strong>
        </div>
      </div>

      <div className="payroll-edit-grid">
        <label>
          <span>Sueldo base</span>
          <MoneyInput value={draft.baseSalary} onChange={(value) => setDraft((current) => ({ ...current, baseSalary: value }))} />
        </label>
        <label>
          <span>Bonos</span>
          <MoneyInput value={draft.bonus} onChange={(value) => setDraft((current) => ({ ...current, bonus: value }))} />
        </label>
        <label>
          <span>Descuentos</span>
          <MoneyInput value={draft.deductions} onChange={(value) => setDraft((current) => ({ ...current, deductions: value }))} />
        </label>
      </div>

      <div className="payroll-payment-panel">
        <label>
          <span>Fecha de pago</span>
          <input type="date" value={draft.paymentDate || ''} onChange={(event) => setDraft((current) => ({ ...current, paymentDate: event.target.value }))} />
        </label>
        <label>
          <span>Referencia</span>
          <input value={draft.paymentReference} onChange={(event) => setDraft((current) => ({ ...current, paymentReference: event.target.value }))} placeholder="Transferencia, folio o comprobante" />
        </label>
        <label className="payroll-note-field">
          <span>Observacion</span>
          <input value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Detalle interno para RRHH" />
        </label>
      </div>

      <div className="payroll-actions">
        <button type="button" disabled={saving} onClick={() => onSave(draft, 'Borrador')}>Guardar</button>
        <button type="button" disabled={saving} onClick={() => onSave(draft, 'Listo para pago')}>Listo pago</button>
        <button type="button" disabled={saving} onClick={() => onSave(draft, 'Pendiente pago')}>Pendiente</button>
        <button type="button" disabled={saving || !canPay} onClick={() => onSave(draft, 'Pagado')}>Pagar</button>
      </div>
    </article>
  );
}

function MoneyInput({ value, onChange }) {
  return <input className="money-input" type="number" min="0" step="1000" value={value} onChange={(event) => onChange(Number(event.target.value || 0))} />;
}

function PayrollStat({ icon, label, value, tone = '' }) {
  return <article className="stat-card"><div className={`stat-icon ${tone === 'warning' ? 'tone-yellow' : 'tone-green'}`}><Icon name={icon} /></div><div><p>{label}</p><strong className="money-stat">{value}</strong></div></article>;
}

function downloadExcelLikeFile(fileName, rows) {
  const columns = Object.keys(rows[0] || { Trabajador: '', Periodo: '', Estado: '' });
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}</tr>`).join('');
  const table = `<table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  const blob = new Blob([`\ufeff${table}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function suggestedPaymentDate(period) {
  if (!period) return '';
  const [year, month] = period.split('-').map(Number);
  return `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
}

function initials(name = '') { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '-'; }
function formatMoney(value) { return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0)); }
function slug(value = '') { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'); }
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
