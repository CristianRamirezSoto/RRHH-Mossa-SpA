import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { getDocumentDownloadUrl } from '../../services/documentStorage';
import { subscribeRows } from '../../services/supabaseData';

export function WorkerPayments() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [period, setPeriod] = useState('Todos');
  const [message, setMessage] = useState('');
  const email = user.email.toLowerCase();

  useEffect(() => subscribeRows('payroll', setRecords, {
    filters: [['ownerEmail', email]],
    orderBy: 'updatedAt',
    ascending: false,
  }), [email]);

  const published = useMemo(
    () => records.filter((item) => ['Pendiente pago', 'Pagado'].includes(item.status)),
    [records],
  );
  const periods = useMemo(() => ['Todos', ...new Set(published.map((item) => item.period).filter(Boolean))], [published]);
  const visible = period === 'Todos' ? published : published.filter((item) => item.period === period);
  const latest = published[0];

  async function downloadReceipt(record) {
    if (!record.receiptStoragePath) return;
    setMessage('');
    try {
      const url = await getDocumentDownloadUrl(record.receiptStoragePath);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      setMessage(`No se pudo abrir el comprobante: ${error.message}`);
    }
  }

  return (
    <div className="page worker-payments-page">
      <header className="page-header portal-page-header">
        <div>
          <p className="eyebrow">Remuneraciones</p>
          <h1>Mis liquidaciones</h1>
          <p className="page-subtitle">Consulta tus periodos liberados, montos y comprobantes de pago.</p>
        </div>
        <label className="compact-select payment-period-filter">
          <span>Periodo</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            {periods.map((item) => <option key={item} value={item}>{item === 'Todos' ? item : formatPeriod(item)}</option>)}
          </select>
        </label>
      </header>

      {latest && (
        <section className="latest-payment-card">
          <div>
            <span className="portal-kicker"><Icon name="wallet" size={16} /> Última liquidación liberada</span>
            <h2>{formatPeriod(latest.period)}</h2>
            <p>{latest.status === 'Pagado' ? `Pagada el ${formatDate(latest.paymentDate || latest.paidAt)}` : 'Programada para pago'}</p>
          </div>
          <div className="latest-payment-amount">
            <span>Líquido</span>
            <strong>{formatMoney(latest.netPay)}</strong>
            <small>{latest.status}</small>
          </div>
        </section>
      )}

      <section className="worker-payment-list">
        {visible.map((record) => (
          <article className="worker-payment-card" key={record.id}>
            <span className="worker-payment-icon"><Icon name="file" /></span>
            <div className="worker-payment-main">
              <div>
                <h2>Liquidación {formatPeriod(record.period)}</h2>
                <span className={`request-state ${record.status === 'Pagado' ? 'request-aprobada' : 'request-pendiente'}`}>{record.status}</span>
              </div>
              <dl>
                <div><dt>Sueldo base</dt><dd>{formatMoney(record.baseSalary)}</dd></div>
                <div><dt>Bonos</dt><dd>{formatMoney(record.bonus)}</dd></div>
                <div><dt>Descuentos</dt><dd>{formatMoney(Number(record.deductions || 0) + Number(record.advance || 0))}</dd></div>
                <div className="payment-net"><dt>Líquido</dt><dd>{formatMoney(record.netPay)}</dd></div>
              </dl>
            </div>
            <button className="secondary-button" type="button" disabled={!record.receiptStoragePath} onClick={() => downloadReceipt(record)}>
              <Icon name="download" size={17} /> {record.receiptStoragePath ? 'Descargar' : 'Sin comprobante'}
            </button>
          </article>
        ))}
      </section>

      {!visible.length && (
        <section className="panel document-empty">
          <div className="empty-folder"><Icon name="wallet" size={30} /></div>
          <h2>Aún no hay liquidaciones liberadas</h2>
          <p>Cuando RRHH publique un periodo, podrás consultarlo y descargar su comprobante desde aquí.</p>
        </section>
      )}
      {message && <p className="form-message error">{message}</p>}
    </div>
  );
}

function formatMoney(value = 0) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatPeriod(value = '') {
  if (!/^\d{4}-\d{2}$/.test(value)) return value || 'Sin periodo';
  const [year, month] = value.split('-');
  const formatted = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1, 1));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatDate(value) {
  if (!value) return 'fecha por confirmar';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(normalized));
}
