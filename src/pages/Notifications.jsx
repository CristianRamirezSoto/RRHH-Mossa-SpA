import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/AppLayout';
import { subscribeRows, updateRow } from '../services/supabaseData';

export function Notifications() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [pushStatus, setPushStatus] = useState('');

  useEffect(() => {
    return subscribeRows('notifications', setNotifications, {
      filters: profile?.role === 'admin' ? [] : [['ownerEmail', user.email.toLowerCase()]],
      orderBy: 'createdAt',
      ascending: false,
    });
  }, [profile?.role, user.email]);

  async function markRead(item) {
    if (!item.read) await updateRow('notifications', item.id, { read: true });
    if (item.link) navigate(item.link);
  }

  function enablePushNotifications() {
    setPushStatus('Las notificaciones push se migraran con Supabase Edge Functions. Por ahora veras los avisos dentro de la app.');
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Centro de avisos</p>
          <h1>Notificaciones</h1>
          <p className="page-subtitle">Alertas de documentos vencidos, solicitudes y procesos internos.</p>
        </div>
        <button className="secondary-button" type="button" onClick={enablePushNotifications}><Icon name="bell" /> Activar avisos en este dispositivo</button>
      </header>
      {pushStatus && <p className="push-status">{pushStatus}</p>}

      <section className="notification-list">
        {notifications.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`notification-card${item.read ? '' : ' unread'}`}
            onClick={() => markRead(item)}
          >
            <span className={`notification-icon ${item.severity || 'warning'}`}><Icon name="alert" /></span>
            <span className="notification-copy">
              <strong>{item.title}</strong>
              <span>{item.message}</span>
              <small>{formatTimestamp(item.createdAt)}</small>
            </span>
            {!item.read && <span className="unread-dot" />}
          </button>
        ))}
      </section>

      {!notifications.length && (
        <section className="panel document-empty">
          <div className="empty-folder"><Icon name="bell" size={30} /></div>
          <h2>No tienes notificaciones</h2>
          <p>Las alertas documentales apareceran aqui automaticamente.</p>
        </section>
      )}
    </div>
  );
}

function formatTimestamp(value) {
  return value
    ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    : 'Ahora';
}
