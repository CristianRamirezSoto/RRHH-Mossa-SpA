import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDocumentViewUrl } from '../services/documentStorage';

export function AppLayout() {
  const { user, profile, logout } = useAuth();
  const location = useLocation();
  const [avatarUrl, setAvatarUrl] = useState('');
  const name = profile?.displayName || user?.email?.split('@')[0] || 'Usuario';
  const navItems = [
    ...(profile?.role === 'admin'
      ? [
          { to: '/panel', label: 'Panel', icon: 'grid' },
          { to: '/colaboradores', label: 'Colaboradores', icon: 'users' },
          { to: '/marcaje', label: 'Marcaje', icon: 'camera' },
          { to: '/asistencia', label: 'Asistencia', icon: 'clock' },
          { to: '/solicitudes', label: 'Solicitudes', icon: 'calendar' },
          { to: '/remuneraciones', label: 'Remuneraciones', icon: 'wallet' },
          { to: '/biometria', label: 'Biometría', icon: 'scan' },
          { to: '/expedientes', label: 'Expedientes', icon: 'folder' },
        ]
      : []),
    ...(profile?.role === 'admin' ? [] : [
      { to: '/expediente', label: 'Mi expediente', icon: 'folder' },
      { to: '/solicitudes', label: 'Solicitudes', icon: 'calendar' },
    ]),
    { to: '/notificaciones', label: 'Alertas', icon: 'bell' },
    { to: '/perfil', label: 'Mi perfil', icon: 'user' },
  ];

  useEffect(() => {
    let active = true;
    if (!profile?.avatarStoragePath) {
      setAvatarUrl('');
      return () => { active = false; };
    }
    getDocumentViewUrl(profile.avatarStoragePath)
      .then((url) => active && setAvatarUrl(url))
      .catch(() => active && setAvatarUrl(''));
    return () => { active = false; };
  }, [profile?.avatarStoragePath, profile?.avatarUpdatedAt]);

  if (location.pathname.startsWith('/terminal/')) {
    return <main className="terminal-shell"><Outlet /></main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <span>
            <strong>Mossaspa</strong>
            <small>Personas & cultura</small>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          <p className="sidebar-label">Espacio de trabajo</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar sidebar-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initials(name)}</span>
            <span className="sidebar-user-copy">
              <strong>{name}</strong>
              <small>{profile?.role === 'admin' ? 'Administrador' : 'Colaborador'}</small>
            </span>
          </div>
          <button className="icon-button" type="button" onClick={logout} title="Cerrar sesión">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function Icon({ name, size = 19 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    login: <><path d="M14 17l5-5-5-5"/><path d="M19 12H7"/><path d="M3 19V5a2 2 0 0 1 2-2h6"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    trend: <><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></>,
    close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    folder: <><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></>,
    alert: <><path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></>,
    back: <><path d="m15 18-6-6 6-6"/><path d="M9 12h12"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3Z"/><circle cx="12" cy="13" r="3.5"/></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/></>,
    face: <><circle cx="12" cy="12" r="9"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M8.5 15a5 5 0 0 0 7 0"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></>,
    userMinus: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M17 11h5"/></>,
    fingerprint: <><path d="M12 11a2 2 0 0 0-2 2c0 4-1 6-2 7"/><path d="M16 13a4 4 0 0 0-8 0c0 2-.2 4-1 5.5"/><path d="M18 13a6 6 0 0 0-12 0c0 1.5-.1 2.8-.5 4"/><path d="M14 13c0 4-.5 7-2 9"/><path d="M18 17c-.2 2-.7 3.5-1.4 5"/><path d="M4 13a8 8 0 0 1 16 0"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></>,
    wallet: <><path d="M19 7V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-5a2 2 0 0 1 0-4Z"/><path d="M16 11h5"/><path d="M17 15h.01"/></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
