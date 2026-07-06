import { Icon } from '../AppLayout';

const items = [
  { key: 'present', label: 'Presentes', icon: 'users', tone: 'green' },
  { key: 'absent', label: 'Ausentes', icon: 'userMinus', tone: 'gray' },
  { key: 'late', label: 'Atrasos', icon: 'clock', tone: 'amber' },
  { key: 'marks', label: 'Marcaciones', icon: 'fingerprint', tone: 'blue' },
];

export function DailyAttendanceSummary({ summary }) {
  return (
    <section className="attendance-summary-grid">
      {items.map((item) => (
        <article className="attendance-summary-card" key={item.key}>
          <span className={`attendance-summary-icon tone-${item.tone}`}><Icon name={item.icon} /></span>
          <div>
            <strong>{summary[item.key] || 0}</strong>
            <span>{item.label}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
