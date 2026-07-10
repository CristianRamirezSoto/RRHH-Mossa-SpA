import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/AppLayout';
import { updateEmployeeProfile } from '../services/attendanceApi';
import {
  createProfileAvatarPath,
  deleteDocumentFile,
  getDocumentViewUrl,
  uploadDocumentFile,
} from '../services/documentStorage';

const MAX_AVATAR_SIZE = 700 * 1024;

export function Profile() {
  const { user, profile, setProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [status, setStatus] = useState('');
  const [statusTone, setStatusTone] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    setDisplayName(profile?.displayName || '');
    setBio(profile?.bio || '');
  }, [profile]);

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

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus('');
    setStatusTone('');
    try {
      const compressed = await compressAvatar(file);
      if (compressed.size > MAX_AVATAR_SIZE) {
        setStatus('La imagen quedo muy pesada. Prueba con una foto mas liviana.');
        setStatusTone('error');
        return;
      }
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(compressed);
      setAvatarPreview(URL.createObjectURL(compressed));
    } catch (error) {
      setStatus(`No se pudo preparar la foto: ${error.message}`);
      setStatusTone('error');
    } finally {
      event.target.value = '';
    }
  }

  async function removeAvatar() {
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview('');
    setAvatarUrl('');
    setSaving(true);
    setStatus('');
    setStatusTone('');
    try {
      const previousPath = profile?.avatarStoragePath || '';
      const updatedProfile = await updateEmployeeProfile(user.id, {
        displayName,
        bio,
        avatarStoragePath: '',
        avatarFileName: '',
        avatarUpdatedAt: null,
      });
      if (previousPath) await deleteDocumentFile(previousPath).catch(() => {});
      setProfile((current) => ({ ...current, ...updatedProfile }));
      setStatus('Foto eliminada correctamente.');
      setStatusTone('success');
    } catch (error) {
      setStatus(`No se pudo eliminar la foto: ${error.message}`);
      setStatusTone('error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setStatus('');
    setStatusTone('');
    let uploadedPath = '';
    try {
      const previousPath = profile?.avatarStoragePath || '';
      const avatarPayload = {};
      if (avatarFile) {
        uploadedPath = createProfileAvatarPath({ userId: user.id, fileName: avatarFile.name });
        await uploadDocumentFile(uploadedPath, avatarFile);
        avatarPayload.avatarStoragePath = uploadedPath;
        avatarPayload.avatarFileName = avatarFile.name;
        avatarPayload.avatarUpdatedAt = new Date().toISOString();
      }
      const updatedProfile = await updateEmployeeProfile(user.id, {
        displayName,
        bio,
        ...avatarPayload,
      });
      if (avatarFile && previousPath) await deleteDocumentFile(previousPath).catch(() => {});
      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview('');
      setProfile((current) => ({ ...current, ...updatedProfile }));
      setStatus('Tus cambios se guardaron correctamente.');
      setStatusTone('success');
    } catch (error) {
      if (uploadedPath) await deleteDocumentFile(uploadedPath).catch(() => {});
      const needsPatch = /avatar_storage_path|avatar_file_name|avatar_updated_at|schema cache/i.test(error.message);
      setStatus(needsPatch
        ? 'Falta actualizar Supabase para fotos de perfil. Ejecuta SUPABASE_PROFILE_PATCH.sql y vuelve a guardar.'
        : `No se pudo guardar: ${error.message}`);
      setStatusTone('error');
    } finally {
      setSaving(false);
    }
  }

  const visibleAvatar = avatarPreview || avatarUrl;
  const initials = (displayName || user?.email || 'U').slice(0, 2).toUpperCase();
  const estimatedStorage = avatarFile?.size || (profile?.avatarStoragePath ? 180 * 1024 : 0);

  return (
    <div className="page profile-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cuenta</p>
          <h1>Mi perfil</h1>
          <p className="page-subtitle">Personaliza tu identidad en la app cuidando el consumo de Supabase.</p>
        </div>
      </header>

      <form className="panel profile-card" onSubmit={handleSave}>
        <div className="profile-identity">
          <button className="profile-avatar-button" type="button" onClick={() => fileInput.current?.click()} title="Cambiar foto">
            {visibleAvatar ? <img src={visibleAvatar} alt="" /> : <span>{initials}</span>}
          </button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleAvatarChange} />
          <div className="profile-identity-copy">
            <h2>{displayName || 'Completa tu nombre'}</h2>
            <p>{user?.email}</p>
            <span className="role-badge">{profile?.role === 'admin' ? 'Administrador' : 'Colaborador'}</span>
            <div className="profile-photo-actions">
              <button className="secondary-button" type="button" onClick={() => fileInput.current?.click()}>
                <Icon name="upload" size={16} /> Cambiar foto
              </button>
              {(visibleAvatar || profile?.avatarStoragePath) && (
                <button className="secondary-button danger-soft-button" type="button" onClick={removeAvatar} disabled={saving}>
                  <Icon name="trash" size={16} /> Quitar
                </button>
              )}
            </div>
          </div>
        </div>

        <section className="profile-consumption-card">
          <span><Icon name="shield" /></span>
          <div>
            <strong>Consumo Supabase controlado</strong>
            <p>La foto se comprime a WebP antes de subir. Postgres guarda solo texto liviano con la ruta; Storage conserva un unico avatar vigente.</p>
          </div>
          <b>{formatBytes(estimatedStorage)}</b>
        </section>

        <div className="profile-fields">
          <label className="field"><span>Nombre para mostrar</span><input value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nombre y apellido" /></label>
          <label className="field"><span>Presentacion breve</span><textarea value={bio} maxLength={280} rows={4} onChange={(event) => setBio(event.target.value)} placeholder="Cuentale al equipo un poco sobre ti" /></label>
        </div>
        {status && <p className={`form-message ${statusTone}`}>{status}</p>}
        <div className="profile-actions"><button className="primary-button" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button></div>
      </form>
    </div>
  );
}

async function compressAvatar(file) {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona una imagen valida.');
  const bitmap = await createImageBitmap(file);
  const size = Math.min(512, bitmap.width, bitmap.height);
  const sx = Math.max(0, Math.floor((bitmap.width - size) / 2));
  const sy = Math.max(0, Math.floor((bitmap.height - size) / 2));
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, sx, sy, size, size, 0, 0, 512, 512);
  bitmap.close?.();
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('No se pudo comprimir la imagen.')), 'image/webp', 0.78);
  });
  return new File([blob], 'avatar.webp', { type: 'image/webp' });
}

function formatBytes(bytes = 0) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
