import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/AppLayout';
import { subscribeRows, upsertRow } from '../services/supabaseData';
import {
  createPayrollReceiptPath,
  deleteDocumentFile,
  getDocumentDownloadUrl,
  uploadDocumentFile,
} from '../services/documentStorage';

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
        receiptFileName: record?.receiptFileName || '',
        receiptStoragePath: record?.receiptStoragePath || '',
        receiptContentType: record?.receiptContentType || '',
        receiptSize: record?.receiptSize || 0,
        preparedAt: record?.preparedAt || '',
        preparedBy: record?.preparedBy || '',
        approvedAt: record?.approvedAt || '',
        approvedBy: record?.approvedBy || '',
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

  async function saveRow(row, status = row.status, receiptFile = null) {
    const rowId = `${period}_${row.employee.id}`;
    const validation = validatePayroll(row, status, receiptFile);
    if (validation) {
      setMessage(validation);
      setMessageTone('error');
      return false;
    }
    setSavingId(rowId);
    setMessage('');
    setMessageTone('');
    let uploadedPath = '';
    try {
      const now = new Date().toISOString();
      const receipt = {};
      if (receiptFile) {
        uploadedPath = createPayrollReceiptPath({
          employeeId: row.employee.id,
          payrollId: rowId,
          fileName: receiptFile.name,
        });
        await uploadDocumentFile(uploadedPath, receiptFile);
        Object.assign(receipt, {
          receiptFileName: receiptFile.name,
          receiptStoragePath: uploadedPath,
          receiptContentType: receiptFile.type || 'application/octet-stream',
          receiptSize: receiptFile.size,
        });
      }
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
        paidAt: status === 'Pagado' ? now : row.paidAt || '',
        preparedAt: row.preparedAt || now,
        preparedBy: row.preparedBy || user.id,
        approvedAt: ['Listo para pago', 'Pendiente pago', 'Pagado'].includes(status) ? row.approvedAt || now : row.approvedAt || '',
        approvedBy: ['Listo para pago', 'Pendiente pago', 'Pagado'].includes(status) ? row.approvedBy || user.id : row.approvedBy || '',
        receiptFileName: row.receiptFileName || '',
        receiptStoragePath: row.receiptStoragePath || '',
        receiptContentType: row.receiptContentType || '',
        receiptSize: row.receiptSize || null,
        ...receipt,
        updatedBy: user.id,
        updatedAt: now,
      });
      if (receiptFile && row.receiptStoragePath) {
        await deleteDocumentFile(row.receiptStoragePath).catch(() => {});
      }
      setMessage(status === 'Pagado' ? 'Pago registrado correctamente.' : 'Remuneracion guardada correctamente.');
      setMessageTone('success');
      return true;
    } catch (error) {
      if (uploadedPath) await deleteDocumentFile(uploadedPath).catch(() => {});
      const needsPatch = /receipt_|prepared_|approved_/i.test(error.message);
      setMessage(needsPatch
        ? 'Falta actualizar remuneraciones en Supabase. Ejecuta SUPABASE_PAYROLL_PATCH.sql completo y vuelve a intentar.'
        : `No se pudo guardar remuneracion: ${error.message}`);
      setMessageTone('error');
      return false;
    } finally {
      setSavingId('');
    }
  }

  async function downloadReceipt(row) {
    try {
      const url = await getDocumentDownloadUrl(row.receiptStoragePath);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      setMessage(`No se pudo descargar el comprobante: ${error.message}`);
      setMessageTone('error');
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
      Comprobante: row.receiptFileName || '',
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
      </header>

      <section className="payroll-toolbar-panel">
        <div>
          <strong>Periodo de trabajo</strong>
          <span>Selecciona el mes, revisa pendientes y exporta la nomina visible.</span>
        </div>
        <div className="payroll-header-actions">
          <label className="compact-select payroll-period">
            <span>Periodo</span>
            <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
          </label>
          <button className="secondary-button" type="button" onClick={exportPayroll}><Icon name="download" /> Excel</button>
        </div>
      </section>

      <section className="stats-grid payroll-stats">
        <PayrollStat icon="wallet" label="Liquido total" value={formatMoney(totals.net)} />
        <PayrollStat icon="clock" label="Pendiente por pagar" value={formatMoney(totals.pendingAmount)} tone="warning" />
        <PayrollStat icon="check" label="Pagado" value={formatMoney(totals.paidAmount)} />
        <PayrollStat icon="shield" label="Avance" value={`${totals.paid}/${periodRows.length}`} />
      </section>

      <section className="payroll-alert-strip">
        <div>
          <strong>{totals.ready + totals.pending} pagos requieren accion</strong>
          <span>{totals.drafts} en borrador - {totals.ready} listos - {totals.pending} pendientes - {totals.paid} pagados</span>
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
            <PayrollRow
              key={row.employee.id}
              row={row}
              period={period}
              onSave={saveRow}
              onDownloadReceipt={downloadReceipt}
              saving={savingId === `${period}_${row.employee.id}`}
            />
          ))}
        </div>
        {!visibleRows.length && <div className="empty-state large"><Icon name="users" size={30} /><p>No hay colaboradores para este filtro.</p></div>}
      </section>
      {message && <p className={`form-message ${messageTone}`}>{message}</p>}
    </div>
  );
}

function PayrollRow({ row, period, onSave, onDownloadReceipt, saving }) {
  const [draft, setDraft] = useState(row);
  const [receiptFile, setReceiptFile] = useState(null);
  const fileInput = useRef(null);
  useEffect(() => setDraft(row), [row]);
  const net = draft.baseSalary + draft.bonus - draft.deductions;
  const canPay = draft.status === 'Listo para pago' || draft.status === 'Pendiente pago';
  const isPaid = draft.status === 'Pagado';
  const receiptReady = Boolean(receiptFile || draft.receiptStoragePath);
  const requirements = [
    { label: 'Montos revisados', ready: net > 0 },
    { label: 'Referencia de pago', ready: Boolean(draft.paymentReference.trim()) },
    { label: 'Comprobante adjunto', ready: receiptReady },
  ];

  async function submit(status) {
    const saved = await onSave(draft, status, receiptFile);
    if (saved) setReceiptFile(null);
  }

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
          <MoneyInput value={draft.baseSalary} disabled={isPaid} onChange={(value) => setDraft((current) => ({ ...current, baseSalary: value }))} />
        </label>
        <label>
          <span>Bonos</span>
          <MoneyInput value={draft.bonus} disabled={isPaid} onChange={(value) => setDraft((current) => ({ ...current, bonus: value }))} />
        </label>
        <label>
          <span>Descuentos</span>
          <MoneyInput value={draft.deductions} disabled={isPaid} onChange={(value) => setDraft((current) => ({ ...current, deductions: value }))} />
        </label>
      </div>

      <div className="payroll-payment-panel">
        <label>
          <span>Fecha de pago</span>
          <input disabled={isPaid} type="date" value={draft.paymentDate || ''} onChange={(event) => setDraft((current) => ({ ...current, paymentDate: event.target.value }))} />
        </label>
        <label>
          <span>Referencia</span>
          <input disabled={isPaid} value={draft.paymentReference} onChange={(event) => setDraft((current) => ({ ...current, paymentReference: event.target.value }))} placeholder="Transferencia, folio o comprobante" />
        </label>
        <label className="payroll-note-field">
          <span>Observacion</span>
          <input disabled={isPaid} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Detalle interno para RRHH" />
        </label>
      </div>

      <div className="payroll-close-panel">
        <div className="payroll-checklist">
          {requirements.map((item) => (
            <span key={item.label} className={item.ready ? 'ready' : ''}>
              <Icon name={item.ready ? 'check' : 'clock'} size={14} /> {item.label}
            </span>
          ))}
        </div>
        <div className="payroll-receipt">
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(event) => setReceiptFile(event.target.files?.[0] || null)}
          />
          <button type="button" disabled={saving || isPaid} onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={15} /> {receiptFile ? receiptFile.name : draft.receiptFileName || 'Adjuntar comprobante'}
          </button>
          {draft.receiptStoragePath && !receiptFile && (
            <button type="button" onClick={() => onDownloadReceipt(draft)}>
              <Icon name="download" size={15} /> Ver
            </button>
          )}
        </div>
      </div>

      <div className="payroll-trace">
        <span>Preparado: {formatTimestamp(draft.preparedAt)}</span>
        <span>Aprobado: {formatTimestamp(draft.approvedAt)}</span>
        <span>Pagado: {formatTimestamp(draft.paidAt)}</span>
      </div>

      <div className="payroll-actions">
        {!isPaid && <button type="button" disabled={saving} onClick={() => submit('Borrador')}>Guardar</button>}
        {!isPaid && <button type="button" disabled={saving} onClick={() => submit('Listo para pago')}>Listo pago</button>}
        {!isPaid && <button type="button" disabled={saving} onClick={() => submit('Pendiente pago')}>Pendiente</button>}
        {!isPaid && <button type="button" disabled={saving || !canPay} onClick={() => submit('Pagado')}>Pagar</button>}
        <button type="button" className="payroll-slip-button" onClick={() => printPayrollSlip(draft, period, net)}>
          <Icon name="file" size={15} /> Liquidacion
        </button>
      </div>
    </article>
  );
}

function MoneyInput({ value, onChange, disabled = false }) {
  return <input className="money-input" disabled={disabled} type="number" min="0" step="1000" value={value} onChange={(event) => onChange(Number(event.target.value || 0))} />;
}

function PayrollStat({ icon, label, value, tone = '' }) {
  return <article className="stat-card"><div className={`stat-icon ${tone === 'warning' ? 'tone-amber' : 'tone-green'}`}><Icon name={icon} /></div><div><p>{label}</p><strong className="money-stat">{value}</strong></div></article>;
}

function validatePayroll(row, status, receiptFile) {
  const net = Number(row.baseSalary) + Number(row.bonus) - Number(row.deductions);
  if (row.baseSalary < 0 || row.bonus < 0 || row.deductions < 0) return 'Los montos no pueden ser negativos.';
  if (net <= 0) return 'El liquido a pagar debe ser mayor que cero.';
  if (status === 'Pagado' && !row.paymentDate) return 'Indica la fecha efectiva del pago.';
  if (status === 'Pagado' && !row.paymentReference.trim()) return 'Agrega el folio o referencia antes de registrar el pago.';
  if (status === 'Pagado' && !receiptFile && !row.receiptStoragePath) return 'Adjunta el comprobante antes de registrar el pago.';
  if (receiptFile && receiptFile.size > 15 * 1024 * 1024) return 'El comprobante no puede superar 15 MB.';
  return '';
}

function printPayrollSlip(row, period, net) {
  const popup = window.open('', '_blank', 'width=820,height=900');
  if (!popup) return;
  const employee = row.employee;
  const content = `<!doctype html><html><head><meta charset="utf-8"><title>Liquidacion ${escapeHtml(employee.name)}</title>
  <style>body{font-family:Arial,sans-serif;color:#17372c;margin:42px}header{border-bottom:3px solid #247252;padding-bottom:18px;margin-bottom:26px}h1{margin:0 0 6px;font-size:25px}p{color:#64776e}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px}.meta div,.total{padding:14px;border:1px solid #dce7e1;border-radius:8px}.meta span,th{font-size:11px;text-transform:uppercase;color:#71827a}strong{display:block;margin-top:5px}table{width:100%;border-collapse:collapse}th,td{padding:13px;border-bottom:1px solid #dce7e1;text-align:left}td:last-child,th:last-child{text-align:right}.total{margin-top:24px;text-align:right;background:#eff8f3}.total strong{font-size:24px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:90px}.signature{border-top:1px solid #51685e;text-align:center;padding-top:8px;font-size:12px}@media print{body{margin:20mm}}</style>
  </head><body><header><h1>Mossaspa</h1><p>Liquidacion de remuneraciones - ${escapeHtml(formatPeriod(period))}</p></header>
  <section class="meta"><div><span>Trabajador</span><strong>${escapeHtml(employee.name)}</strong></div><div><span>RUT</span><strong>${escapeHtml(employee.rut || 'No informado')}</strong></div><div><span>Cargo</span><strong>${escapeHtml(employee.position || 'No informado')}</strong></div><div><span>Area</span><strong>${escapeHtml(employee.area || 'No informada')}</strong></div></section>
  <table><thead><tr><th>Concepto</th><th>Monto</th></tr></thead><tbody><tr><td>Sueldo base</td><td>${formatMoney(row.baseSalary)}</td></tr><tr><td>Bonos</td><td>${formatMoney(row.bonus)}</td></tr><tr><td>Descuentos</td><td>-${formatMoney(row.deductions)}</td></tr></tbody></table>
  <div class="total"><span>Liquido a pagar</span><strong>${formatMoney(net)}</strong></div>
  <p>Estado: ${escapeHtml(row.status)}${row.paymentReference ? ` | Referencia: ${escapeHtml(row.paymentReference)}` : ''}</p>
  <div class="signatures"><div class="signature">Firma empleador</div><div class="signature">Firma trabajador</div></div>
  <script>window.onload=()=>window.print()</script></body></html>`;
  popup.document.write(content);
  popup.document.close();
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

function formatPeriod(period = '') {
  if (!period) return '';
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}
function formatTimestamp(value) {
  if (!value) return 'Pendiente';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
function initials(name = '') { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '-'; }
function formatMoney(value) { return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0)); }
function slug(value = '') { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'); }
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
