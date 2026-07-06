import { Icon } from '../AppLayout';

export function RecentAttendanceList({ records }) {
  return (
    <section className="panel recent-attendance-panel">
      <div className="panel-heading">
        <div>
          <h2>Últimas marcaciones</h2>
          <p>Registros realizados durante el día</p>
        </div>
        <span className="live-indicator"><i /> En vivo</span>
      </div>
      <div className="recent-attendance-list">
        {records.slice(0, 8).map((record) => (
          <article className="recent-attendance-item" key={record.id}>
            <span className="attendance-person-photo">
              {record.photoUrl
                ? <img src={record.photoUrl} alt="" />
                : initials(record.employeeName)}
            </span>
            <span className="attendance-person-copy">
              <strong>{record.employeeName}</strong>
              <small>{record.position || 'Colaborador'}</small>
            </span>
            <span className="attendance-record-meta">
              <strong>{formatTime(record.createdAt)}</strong>
              <span className={`attendance-type type-${record.type}`}>{record.type === 'entry' ? 'Entrada' : 'Salida'}</span>
            </span>
            <span className={`attendance-state state-${record.status || 'ok'}`}>
              <Icon name={record.status === 'late' ? 'clock' : 'check'} size={13} />
              {record.status === 'late' ? 'Atraso' : 'Registrado'}
            </span>
          </article>
        ))}
        {!records.length && (
          <div className="empty-state attendance-empty">
            <Icon name="clock" size={27} />
            <p>Aún no hay marcaciones hoy.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function initials(name = '') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—';
}

function formatTime(value) {
  if (!value) return 'Ahora';
  return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}
