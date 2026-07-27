import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/AppLayout';
import { listRows } from '../../services/supabaseData';

export function EmployeeDirectory() {
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listRows('employeeDirectory', { orderBy: 'name', ascending: true })
      .then((rows) => active && setPeople(rows))
      .catch(() => active && setError('Activa el portal del trabajador ejecutando supabase/sql/02_employee_portal.sql en Supabase.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const areas = useMemo(() => ['Todas', ...new Set(people.map((person) => person.area).filter(Boolean))], [people]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return people.filter((person) => {
      const matchesArea = area === 'Todas' || person.area === area;
      const matchesTerm = !term || [person.name, person.position, person.area, person.workLocation]
        .some((value) => value?.toLowerCase().includes(term));
      return matchesArea && matchesTerm;
    });
  }, [people, search, area]);

  return (
    <div className="page directory-page">
      <header className="page-header portal-page-header">
        <div>
          <p className="eyebrow">Nuestra organización</p>
          <h1>Personas</h1>
          <p className="page-subtitle">Conoce al equipo y encuentra rápidamente a quien necesitas.</p>
        </div>
        <span className="directory-count"><Icon name="users" size={17} /> {people.length} colaboradores activos</span>
      </header>

      <section className="directory-toolbar">
        <label className="search-box directory-search">
          <Icon name="search" size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, cargo, área o sede" />
        </label>
        <div className="category-tabs directory-area-tabs">
          {areas.map((item) => (
            <button key={item} className={area === item ? 'active' : ''} type="button" onClick={() => setArea(item)}>{item}</button>
          ))}
        </div>
      </section>

      {error && <section className="portal-notice warning"><Icon name="alert" /><div><strong>Configuración pendiente</strong><p>{error}</p></div></section>}
      {loading && <section className="directory-grid">{Array.from({ length: 6 }, (_, index) => <div className="directory-card skeleton" key={index} />)}</section>}

      {!loading && !error && (
        <section className="directory-grid">
          {visible.map((person) => <PersonCard key={person.id} person={person} />)}
        </section>
      )}

      {!loading && !error && !visible.length && (
        <section className="panel document-empty">
          <div className="empty-folder"><Icon name="search" size={30} /></div>
          <h2>No encontramos personas</h2>
          <p>Prueba con otro nombre, cargo, área o sede.</p>
        </section>
      )}
    </div>
  );
}

function PersonCard({ person }) {
  return (
    <article className="directory-card">
      <div className="directory-card-top">
        <span className="directory-avatar">
          {person.photoUrl ? <img src={person.photoUrl} alt="" /> : initials(person.name)}
        </span>
        <span className="directory-status"><i /> Disponible</span>
      </div>
      <div className="directory-person-copy">
        <h2>{person.name}</h2>
        <p>{person.position || 'Cargo por confirmar'}</p>
      </div>
      <div className="directory-meta">
        <span><Icon name="building" size={15} /> {person.area || 'Sin área'}</span>
        <span><Icon name="location" size={15} /> {person.workLocation || 'Sede por confirmar'}</span>
      </div>
      <a className="directory-contact" href={`mailto:${person.email}`}>
        <Icon name="mail" size={16} /> Contactar
      </a>
    </article>
  );
}

function initials(name = '') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—';
}
