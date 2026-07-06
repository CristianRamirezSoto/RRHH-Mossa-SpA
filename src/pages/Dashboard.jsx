import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/AppLayout';
import { subscribeRows } from '../services/supabaseData';

export function Dashboard() {
  const { profile, user } = useAuth();
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    return subscribeRows('employees', setEmployees, { orderBy: 'name', ascending: true });
  }, []);

  const stats = useMemo(() => {
    const active = employees.filter((item) => item.status === 'Activo').length;
    const areas = new Set(employees.map((item) => item.area).filter(Boolean)).size;
    const newThisMonth = employees.filter((item) => {
      if (!item.startDate) return false;
      const date = new Date(`${item.startDate}T12:00:00`);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    return { active, areas, newThisMonth };
  }, [employees]);

  const firstName = (profile?.displayName || user?.email || 'equipo').split(/[\s@]/)[0];

  return (
    <div className="page">
      <header className="page-header hero-header">
        <div>
          <p className="eyebrow">Resumen general</p>
          <h1>Buenos días, {firstName}</h1>
          <p className="page-subtitle">Una vista simple de cómo está tu equipo hoy.</p>
        </div>
        <div className="today-chip">
          <span className="today-dot" />
          {new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
        </div>
      </header>

      <section className="stats-grid">
        <StatCard icon="users" label="Colaboradores" value={employees.length} detail={`${stats.active} activos`} tone="green" />
        <StatCard icon="briefcase" label="Áreas" value={stats.areas} detail="Equipos registrados" tone="blue" />
        <StatCard icon="trend" label="Nuevos ingresos" value={stats.newThisMonth} detail="Durante este mes" tone="amber" />
        <StatCard icon="clock" label="Pendientes" value={employees.filter((item) => item.status === 'Pendiente').length} detail="Por completar" tone="purple" />
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Equipo reciente</h2>
              <p>Últimos colaboradores registrados</p>
            </div>
          </div>
          <div className="people-list">
            {employees.slice(0, 5).map((employee) => (
              <div className="person-row" key={employee.id}>
                <span className="avatar avatar-soft">{getInitials(employee.name)}</span>
                <span className="person-main">
                  <strong>{employee.name}</strong>
                  <small>{employee.position || 'Cargo por definir'}</small>
                </span>
                <span className={`status-pill status-${slug(employee.status)}`}>{employee.status || 'Pendiente'}</span>
              </div>
            ))}
            {!employees.length && <EmptyState text="Aún no hay colaboradores registrados." />}
          </div>
        </article>

        <article className="panel culture-panel">
          <div className="culture-mark">M</div>
          <p className="eyebrow">Cultura Mossaspa</p>
          <h2>Las personas hacen que todo avance.</h2>
          <p>Mantén la información del equipo clara, actualizada y disponible solo para quienes corresponde.</p>
          <div className="culture-line"><span style={{ width: employees.length ? '72%' : '18%' }} /></div>
          <small>{employees.length ? 'Tu espacio de personas ya está tomando forma.' : 'Comienza agregando a tu primer colaborador.'}</small>
        </article>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, detail, tone }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon tone-${tone}`}><Icon name={icon} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state"><Icon name="users" size={28} /><p>{text}</p></div>;
}

function getInitials(name = '') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—';
}

function slug(value = '') {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
}
