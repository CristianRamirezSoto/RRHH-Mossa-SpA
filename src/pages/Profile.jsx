import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateEmployeeProfile } from '../services/attendanceApi';

export function Profile() {
  const { user, profile, setProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName || '');
    setBio(profile?.bio || '');
  }, [profile]);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setStatus('');
    try {
      const updatedProfile = await updateEmployeeProfile(user.id, { displayName, bio });
      setProfile((current) => ({ ...current, ...updatedProfile }));
      setStatus('Tus cambios se guardaron correctamente.');
    } catch (error) {
      setStatus(`No se pudo guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page profile-page">
      <header className="page-header">
        <div><p className="eyebrow">Cuenta</p><h1>Mi perfil</h1><p className="page-subtitle">La información visible dentro del espacio de trabajo.</p></div>
      </header>
      <form className="panel profile-card" onSubmit={handleSave}>
        <div className="profile-identity">
          <span className="avatar profile-avatar">{(displayName || user?.email || 'U').slice(0, 2).toUpperCase()}</span>
          <div><h2>{displayName || 'Completa tu nombre'}</h2><p>{user?.email}</p><span className="role-badge">{profile?.role === 'admin' ? 'Administrador' : 'Colaborador'}</span></div>
        </div>
        <div className="profile-fields">
          <label className="field"><span>Nombre para mostrar</span><input value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nombre y apellido" /></label>
          <label className="field"><span>Presentación breve</span><textarea value={bio} maxLength={280} rows={4} onChange={(event) => setBio(event.target.value)} placeholder="Cuéntale al equipo un poco sobre ti" /></label>
        </div>
        {status && <p className="form-message">{status}</p>}
        <div className="profile-actions"><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </form>
    </div>
  );
}
