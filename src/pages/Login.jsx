import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

  const emailRef = useRef(null);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Foco en el email al cargar y al cambiar de modo
  useEffect(() => {
    emailRef.current?.focus();
    setError('');
    setFieldErrors({});
  }, [mode]);

  function validateEmail(val) {
    if (!val) return 'El correo es requerido.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Formato de correo inválido.';
    return '';
  }

  function validatePassword(val) {
    if (!val) return 'La contraseña es requerida.';
    if (val.length < 6) return 'Mínimo 6 caracteres.';
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
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr || passErr) {
      setFieldErrors({ email: emailErr, password: passErr });
      return;
    }

    setError('');
    setBusy(true);
    try {
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

  function switchMode() {
    setEmail('');
    setPassword('');
    setError('');
    setFieldErrors({});
    setMode(mode === 'login' ? 'register' : 'login');
  }

  const isLogin = mode === 'login';

  return (
    <div className={`login-root${success ? ' login-root--success' : ''}`}>
      {/* Panel izquierdo — branding */}
      <div className="login-panel-left" aria-hidden="true">
        <div className="login-orb login-orb--1" />
        <div className="login-orb login-orb--2" />
        <div className="login-brand">
          <div className="login-brand-mark">M</div>
          <div>
            <p className="login-brand-name">Mossaspa</p>
            <p className="login-brand-tagline">Personas & cultura</p>
          </div>
        </div>
        <blockquote className="login-quote">
          "Un lugar pensado para que lo que importa esté siempre a la mano."
        </blockquote>
      </div>

      {/* Panel derecho — formulario */}
      <div className="login-panel-right">
        <div className="login-form-wrap">
          {/* Toggle modo */}
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

          <h1 className="login-heading">
            {isLogin ? 'Bienvenido de vuelta' : 'Empieza ahora'}
          </h1>
          <p className="login-subheading">
            {isLogin
              ? 'Ingresa tus datos para continuar.'
              : 'Crea tu cuenta en segundos, sin tarjeta.'}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className={`login-field${fieldErrors.email ? ' login-field--error' : ''}`}>
              <label htmlFor="email" className="login-label">Correo electrónico</label>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <IconEmail />
                </span>
                <input
                  id="email"
                  ref={emailRef}
                  type="email"
                  className="login-input"
                  value={email}
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors(f => ({ ...f, email: '' }));
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

            {/* Contraseña */}
            <div className={`login-field${fieldErrors.password ? ' login-field--error' : ''}`}>
              <label htmlFor="password" className="login-label">Contraseña</label>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <IconLock />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  value={password}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(f => ({ ...f, password: '' }));
                  }}
                  onBlur={() => handleBlur('password')}
                  aria-describedby={fieldErrors.password ? 'pass-err' : undefined}
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={0}
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

            {/* Error global */}
            {error && (
              <div className="login-global-error" role="alert">
                <IconAlert /> {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? (
                <span className="login-spinner" aria-label="Procesando" />
              ) : (
                isLogin ? 'Entrar' : 'Crear mi cuenta'
              )}
            </button>
          </form>

          <p className="login-switch">
            {isLogin ? '¿Todavía no tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button type="button" className="login-switch-btn" onClick={switchMode}>
              {isLogin ? 'Regístrate gratis' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
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
    'Invalid login credentials': 'Correo o contraseña incorrectos. Si aún no creaste la cuenta, usa "Crear cuenta".',
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
