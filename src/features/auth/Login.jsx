import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appConfig } from '../../config/env';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import './Login.css';

export function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState('');

  const emailRef = useRef(null);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // El acceso funciona como una vista completa, sin heredar el scroll del portal.
  useEffect(() => {
    document.documentElement.classList.add('login-viewport-locked');
    return () => document.documentElement.classList.remove('login-viewport-locked');
  }, []);

  // Foco en el email al cargar y al cambiar de modo
  useEffect(() => {
    if (mode !== 'recovery') emailRef.current?.focus();
    setError('');
    setFieldErrors({});
  }, [mode]);

  useEffect(() => {
    const { data } = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery');
        setPassword('');
        setRecoveryNotice('Define una contraseña nueva para recuperar tu acceso.');
      }
    }) || { data: { subscription: null } };
    return () => data.subscription?.unsubscribe();
  }, []);

  function validateEmail(val) {
    if (!val) return 'El correo es requerido.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Formato de correo inválido.';
    return '';
  }

  function validatePassword(val) {
    if (!val) return 'La contraseña es requerida.';
    if (val.length < (mode === 'recovery' ? 10 : 6)) {
      return mode === 'recovery' ? 'La nueva contraseña debe tener al menos 10 caracteres.' : 'Mínimo 6 caracteres.';
    }
    return '';
  }

  function handleBlur(field) {
    const errs = { ...fieldErrors };
    if (field === 'email') errs.email = validateEmail(email);
    if (field === 'password') errs.password = validatePassword(password);
    setFieldErrors(errs);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const emailErr = mode === 'recovery' ? '' : validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr || passErr) {
      setFieldErrors({ email: emailErr, password: passErr });
      return;
    }

    setError('');
    setBusy(true);
    try {
      if (mode === 'recovery') {
        if (!supabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await supabase.auth.signOut();
        setMode('login');
        setPassword('');
        setRecoveryNotice('Contraseña actualizada. Ya puedes iniciar sesión.');
        return;
      }
      if (mode === 'login') {
        await login(email, password);
      } else {
        const result = await register(email, password);
        if (!result.session) {
          setSuccess(false);
          setError('Cuenta creada. Revisa tu correo y confirma la cuenta antes de iniciar sesión.');
          return;
        }
      }
      setSuccess(true);
      setTimeout(() => navigate('/'), 400);
    } catch (err) {
      setError(traducirError(err.code || err.message));
    } finally {
      setBusy(false);
    }
  }

  async function requestRecovery() {
    const emailError = validateEmail(email);
    if (emailError) {
      setFieldErrors((current) => ({ ...current, email: emailError }));
      emailRef.current?.focus();
      return;
    }
    if (!supabaseConfigured || !supabase) {
      setError('Supabase no está configurado.');
      return;
    }

    setRecovering(true);
    setError('');
    setRecoveryNotice('');
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (recoveryError) {
      setError(traducirError(recoveryError.code || recoveryError.message));
    } else {
      setRecoveryNotice('Te enviamos un enlace seguro para recuperar tu contraseña. Revisa también la carpeta de spam.');
    }
    setRecovering(false);
  }

  function switchMode() {
    if (!appConfig.allowSelfRegistration) return;
    setEmail('');
    setPassword('');
    setError('');
    setFieldErrors({});
    setMode(mode === 'login' ? 'register' : 'login');
  }

  const isLogin = mode === 'login';
  const isRecovery = mode === 'recovery';

  return (
    <div className={`login-root${success ? ' login-root--success' : ''}`}>
      <main className="login-access-panel">
        <div className="login-form-wrap">
          <div className="login-logo-row">
            <img src="/images/mossa-logo.png" alt="Construcción Mossa SpA" />
            <i aria-hidden="true" />
            <span>
              <strong>Portal de personas</strong>
              <small>Gestión interna y colaboradores</small>
            </span>
          </div>

          {!isRecovery && appConfig.allowSelfRegistration ? (
            <div className="login-mode-toggle">
              <button
                type="button"
                className={`login-mode-btn${isLogin ? ' login-mode-btn--active' : ''}`}
                onClick={() => mode !== 'login' && switchMode()}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className={`login-mode-btn${!isLogin ? ' login-mode-btn--active' : ''}`}
                onClick={() => mode !== 'register' && switchMode()}
              >
                Crear cuenta
              </button>
            </div>
          ) : !isRecovery ? (
            <div className="login-managed-access">
              <IconLock />
              <span>Acceso administrado por RRHH</span>
            </div>
          ) : null}

          <h1 className="login-heading">
            {isRecovery ? 'Crea una nueva contraseña' : isLogin ? 'Bienvenido al Portal Mossa' : 'Crea tu cuenta'}
          </h1>
          <p className="login-subheading">
            {isRecovery
              ? 'Usa al menos 10 caracteres y evita reutilizar una clave anterior.'
              : isLogin
                ? 'Ingresa tus credenciales para acceder a tu espacio de trabajo.'
                : 'Completa tus datos para solicitar acceso.'}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {!isRecovery && (
              <div className={`login-field${fieldErrors.email ? ' login-field--error' : ''}`}>
                <label htmlFor="email" className="login-label">Correo corporativo</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon"><IconEmail /></span>
                  <input
                    id="email"
                    ref={emailRef}
                    type="email"
                    className="login-input"
                    value={email}
                    placeholder="nombre@mossaspa.cl"
                    autoComplete="email"
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: '' }));
                    }}
                    onBlur={() => handleBlur('email')}
                    aria-describedby={fieldErrors.email ? 'email-err' : undefined}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="login-field-error" id="email-err" role="alert">
                    <IconAlert /> {fieldErrors.email}
                  </p>
                )}
              </div>
            )}

            <div className={`login-field${fieldErrors.password ? ' login-field--error' : ''}`}>
              <label htmlFor="password" className="login-label">{isRecovery ? 'Nueva contraseña' : 'Contraseña'}</label>
              <div className="login-input-wrap">
                <span className="login-input-icon"><IconLock /></span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  value={password}
                  placeholder={isRecovery ? 'Mínimo 10 caracteres' : 'Ingresa tu contraseña'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: '' }));
                  }}
                  onBlur={() => handleBlur('password')}
                  aria-describedby={fieldErrors.password ? 'pass-err' : undefined}
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="login-field-error" id="pass-err" role="alert">
                  <IconAlert /> {fieldErrors.password}
                </p>
              )}
            </div>

            {error && (
              <div className="login-global-error" role="alert">
                <IconAlert /> {error}
              </div>
            )}

            {recoveryNotice && (
              <div className="login-recovery-notice" role="status">
                <span>✓</span> {recoveryNotice}
              </div>
            )}

            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? (
                <span className="login-spinner" aria-label="Procesando" />
              ) : (
                isRecovery ? 'Actualizar contraseña' : isLogin ? 'Ingresar al portal' : 'Crear mi cuenta'
              )}
            </button>
          </form>

          {isLogin && (
            <div className="login-recovery-row">
              <span>¿Problemas con tu clave?</span>
              <button type="button" onClick={requestRecovery} disabled={recovering}>
                {recovering ? 'Enviando…' : 'Recupérala aquí'}
              </button>
            </div>
          )}

          {!isRecovery && appConfig.allowSelfRegistration ? (
            <p className="login-switch">
              {isLogin ? '¿Todavía no tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button type="button" className="login-switch-btn" onClick={switchMode}>
                {isLogin ? 'Regístrate gratis' : 'Inicia sesión'}
              </button>
            </p>
          ) : null}

          <section className="login-help-card">
            <span><IconLock /></span>
            <div>
              <strong>¿Necesitas ayuda para acceder?</strong>
              <p>RRHH puede activar, suspender o recuperar tu cuenta de forma segura.</p>
            </div>
          </section>

          <p className="login-privacy-note">Acceso privado · Datos protegidos · Sesión segura</p>
        </div>
      </main>

      <aside className="login-visual-panel" aria-hidden="true">
        <div className="login-visual-shade" />
        <div className="login-visual-brand">
          <IconLock />
          <span><strong>Entorno seguro</strong><small>Uso exclusivo Mossa SpA</small></span>
        </div>
        <article className="login-hero-card">
          <span className="login-hero-kicker">Portal de colaboradores</span>
          <h2>Tu trabajo, en un solo lugar.</h2>
          <p>Documentos, solicitudes, liquidaciones y equipo disponibles de forma simple y segura.</p>
          <div className="login-hero-features">
            <span><i>✓</i> Expediente digital</span>
            <span><i>✓</i> Gestión transparente</span>
            <span><i>✓</i> Información protegida</span>
          </div>
        </article>
        <div className="login-security-card">
          <IconLock />
          <span><strong>Tu información es personal</strong><small>No compartas tus credenciales con terceros.</small></span>
        </div>
      </aside>
    </div>
  );
}

function traducirError(code) {
  const m = {
    'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Intenta iniciar sesión.',
    'auth/invalid-email': 'El formato del correo no es válido.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No encontramos una cuenta con ese correo.',
    'auth/wrong-password': 'La contraseña no es correcta.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento e intenta de nuevo.',
    'auth/network-request-failed': 'Sin conexión a internet. Revisa tu red.',
    invalid_credentials: 'Correo o contraseña incorrectos.',
    'Invalid login credentials': 'Correo o contraseña incorrectos. Si aún no tienes acceso, comunícate con RRHH.',
    'Email not confirmed': 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
    user_already_exists: 'Ese correo ya tiene una cuenta. Intenta iniciar sesión.',
    'User already registered': 'Ese correo ya tiene una cuenta. Intenta iniciar sesión.',
    email_address_invalid: 'El formato del correo no es válido.',
    weak_password: 'La contraseña debe tener al menos 6 caracteres.',
  };
  return m[code] || code || 'Algo salió mal. Intenta de nuevo.';
}

/* ── Iconos inline (sin dependencias externas) ─────────────────────────── */
function IconEmail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:'4px'}}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
