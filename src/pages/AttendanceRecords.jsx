import { useEffect, useMemo, useState } from 'react';
import { DailyAttendanceSummary } from '../components/attendance/DailyAttendanceSummary';
import { Icon } from '../components/AppLayout';
import { subscribeRows } from '../services/supabaseData';

export function AttendanceRecords() {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('daily');

  useEffect(() => {
    return subscribeRows('attendance', setRecords, {
      filters: [['dateKey', selectedDate]],
      orderBy: 'createdAt',
      ascending: false,
    });
  }, [selectedDate]);

  useEffect(() => subscribeRows('employees', setEmployees, { orderBy: 'name', ascending: true }), []);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesType = typeFilter === 'all' || record.type === typeFilter;
      const matchesSearch = !normalizedSearch
        || record.employeeName?.toLowerCase().includes(normalizedSearch)
        || record.position?.toLowerCase().includes(normalizedSearch);
      return matchesType && matchesSearch;
    });
  }, [records, search, typeFilter]);

  const dailyRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return employees
      .filter((employee) => employee.status === 'Activo')
      .filter((employee) => (
        !normalizedSearch
        || employee.name?.toLowerCase().includes(normalizedSearch)
        || employee.position?.toLowerCase().includes(normalizedSearch)
        || employee.area?.toLowerCase().includes(normalizedSearch)
      ))
      .map((employee) => {
        const employeeRecords = records
          .filter((record) => record.employeeId === employee.id)
          .sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt));
        const entries = employeeRecords.filter((record) => record.type === 'entry');
        const exits = employeeRecords.filter((record) => record.type === 'exit');
        const firstEntry = entries[0] || null;
        const lastExit = exits[exits.length - 1] || null;
        const latestMark = employeeRecords[employeeRecords.length - 1] || null;
        const status = firstEntry?.status === 'late'
          ? 'Atraso'
          : firstEntry
            ? latestMark?.type === 'exit' ? 'Salida registrada' : 'Presente'
            : 'Ausente';

        return {
          employee,
          firstEntry,
          lastExit,
          marks: employeeRecords.length,
          status,
          confidence: employeeRecords.length
            ? Math.round((employeeRecords.reduce((sum, record) => sum + Number(record.confidence || 0), 0) / employeeRecords.length) * 100)
            : 0,
        };
      })
      .filter((row) => {
        if (typeFilter === 'entry') return Boolean(row.firstEntry);
        if (typeFilter === 'exit') return Boolean(row.lastExit);
        return true;
      });
  }, [employees, records, search, typeFilter]);

  const summary = useMemo(() => {
    const latestByEmployee = new Map();
    records
      .slice()
      .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt))
      .forEach((record) => {
        if (!latestByEmployee.has(record.employeeId)) latestByEmployee.set(record.employeeId, record);
      });
    const presentIds = new Set(
      [...latestByEmployee.values()]
        .filter((item) => item.type === 'entry')
        .map((item) => item.employeeId)
    );

    return {
      present: presentIds.size,
      absent: Math.max(0, employees.filter((item) => item.status === 'Activo').length - presentIds.size),
      late: new Set(records.filter((item) => item.status === 'late').map((item) => item.employeeId)).size,
      marks: records.length,
    };
  }, [employees, records]);

  return (
    <div className="page attendance-records-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Control de asistencia</p>
          <h1>Asistencia</h1>
          <p className="page-subtitle">Resumen diario, detalle de marcaciones y exportacion para respaldo.</p>
        </div>
      </header>

      <DailyAttendanceSummary summary={summary} />

      <section className="panel attendance-records-panel">
        <div className="panel-heading attendance-records-heading">
          <div>
            <h2>Libro de asistencia</h2>
            <p>{dailyRows.length} trabajadores y {filteredRecords.length} marcaciones para la fecha seleccionada</p>
          </div>
          <div className="attendance-records-filters">
            <label>
              <span>Fecha</span>
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
            <label>
              <span>Tipo</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="entry">Entradas</option>
                <option value="exit">Salidas</option>
              </select>
            </label>
            <label>
              <span>Buscar</span>
              <input
                type="search"
                placeholder="Nombre, cargo o area"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="attendance-report-actions">
          <div className="attendance-view-toggle" role="tablist" aria-label="Vista de asistencia">
            <button className={viewMode === 'daily' ? 'active' : ''} type="button" onClick={() => setViewMode('daily')}>Resumen diario</button>
            <button className={viewMode === 'marks' ? 'active' : ''} type="button" onClick={() => setViewMode('marks')}>Marcaciones</button>
          </div>
          <div className="attendance-download-actions">
            <button className="secondary-button" type="button" onClick={() => downloadDailyExcel(dailyRows, selectedDate)}>
              <Icon name="download" /> Excel resumen
            </button>
            <button className="secondary-button" type="button" onClick={() => downloadMarksExcel(filteredRecords, selectedDate)}>
              <Icon name="download" /> Excel marcaciones
            </button>
          </div>
        </div>

        <div className="table-wrap">
          {viewMode === 'daily' ? (
            <DailyTable rows={dailyRows} />
          ) : (
            <MarksTable records={filteredRecords} />
          )}

          {((viewMode === 'daily' && !dailyRows.length) || (viewMode === 'marks' && !filteredRecords.length)) && (
            <div className="empty-state attendance-empty">
              <Icon name="clock" size={27} />
              <p>No hay registros con estos filtros.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DailyTable({ rows }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Trabajador</th>
          <th>Cargo / area</th>
          <th>Entrada</th>
          <th>Salida</th>
          <th>Estado</th>
          <th>Marcaciones</th>
          <th>Confianza prom.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.employee.id}>
            <td>
              <span className="employee-cell">
                <span className="avatar avatar-soft">{initials(row.employee.name)}</span>
                <span>
                  <strong>{row.employee.name}</strong>
                  <small>{row.employee.email}</small>
                </span>
              </span>
            </td>
            <td>
              <span className="stacked-cell">
                <strong>{row.employee.position || 'Cargo sin definir'}</strong>
                <small>{row.employee.area || 'Area sin definir'}</small>
              </span>
            </td>
            <td>{row.firstEntry ? formatDateTime(row.firstEntry.createdAt) : '--:--'}</td>
            <td>{row.lastExit ? formatDateTime(row.lastExit.createdAt) : '--:--'}</td>
            <td><AttendanceState status={row.status} /></td>
            <td>{row.marks}</td>
            <td>{row.confidence ? `${row.confidence}%` : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MarksTable({ records }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Trabajador</th>
          <th>Cargo</th>
          <th>Hora</th>
          <th>Tipo</th>
          <th>Estado</th>
          <th>Confianza</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record) => (
          <tr key={record.id}>
            <td>
              <span className="employee-cell">
                <span className="avatar avatar-soft">{initials(record.employeeName)}</span>
                {record.employeeName}
              </span>
            </td>
            <td>{record.position || '-'}</td>
            <td>{formatDateTime(record.createdAt)}</td>
            <td><span className={`attendance-type type-${record.type}`}>{record.type === 'entry' ? 'Entrada' : 'Salida'}</span></td>
            <td>
              <span className={`attendance-state-pill state-${record.status || 'ok'}`}>
                <Icon name={record.status === 'late' ? 'clock' : 'check'} size={13} />
                {record.status === 'late' ? 'Atraso' : 'Registrado'}
              </span>
            </td>
            <td>{Math.round(Number(record.confidence || 0) * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AttendanceState({ status }) {
  const normalized = status === 'Atraso' ? 'late' : status === 'Ausente' ? 'absent' : 'ok';
  return (
    <span className={`attendance-state-pill state-${normalized}`}>
      <Icon name={normalized === 'late' ? 'clock' : normalized === 'absent' ? 'alert' : 'check'} size={13} />
      {status}
    </span>
  );
}

function dateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function timestampValue(value) { return value ? new Date(value).getTime() : 0; }

function formatDateTime(value) {
  if (!value) return 'Ahora';
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function initials(name = '') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '-';
}

function downloadDailyExcel(rows, selectedDate) {
  const excelRows = rows.map((row) => ({
    Fecha: selectedDate,
    Trabajador: row.employee.name,
    Email: row.employee.email,
    Cargo: row.employee.position || '',
    Area: row.employee.area || '',
    Entrada: row.firstEntry ? formatDateTime(row.firstEntry.createdAt) : '',
    Salida: row.lastExit ? formatDateTime(row.lastExit.createdAt) : '',
    Estado: row.status,
    Marcaciones: row.marks,
    'Confianza promedio': row.confidence ? `${row.confidence}%` : '',
  }));
  downloadExcel(`asistencia-resumen-${selectedDate}.xls`, 'Resumen diario', excelRows);
}

function downloadMarksExcel(records, selectedDate) {
  const excelRows = records.map((record) => ({
    Fecha: selectedDate,
    Trabajador: record.employeeName,
    Cargo: record.position || '',
    Hora: formatDateTime(record.createdAt),
    Tipo: record.type === 'entry' ? 'Entrada' : 'Salida',
    Estado: record.status === 'late' ? 'Atraso' : 'Registrado',
    Confianza: `${Math.round(Number(record.confidence || 0) * 100)}%`,
    Origen: record.source || '',
  }));
  downloadExcel(`asistencia-marcaciones-${selectedDate}.xls`, 'Marcaciones', excelRows);
}

function downloadExcel(fileName, title, rows) {
  const headers = Object.keys(rows[0] || { SinDatos: '' });
  const table = `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
  const workbook = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; }
          h1 { font-size: 18px; color: #173d32; }
          table { border-collapse: collapse; width: 100%; }
          th { background: #dff2e9; color: #173d32; font-weight: bold; }
          th, td { border: 1px solid #b9d7ca; padding: 8px; mso-number-format: "\\@"; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>Fecha: ${escapeHtml(selectedDateFromFileName(fileName))}</p>
        ${table}
      </body>
    </html>
  `;
  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function selectedDateFromFileName(fileName) {
  return fileName.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '';
}
