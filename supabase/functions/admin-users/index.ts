import { createClient } from 'npm:@supabase/supabase-js@2.108.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_ROLES = new Set(['admin', 'employee']);
const VALID_STATUSES = new Set(['active', 'suspended']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido.' }, 405);

  try {
    const admin = createAdminClient();
    const actor = await requireAdministrator(req, admin);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'list');

    switch (action) {
      case 'list':
        return json(await listAccounts(admin, body));
      case 'create':
        return json(await createAccount(admin, actor, body), 201);
      case 'invite':
        return json(await inviteAccount(admin, actor, body), 201);
      case 'update-role':
        return json(await updateRole(admin, actor, body));
      case 'set-status':
        return json(await setStatus(admin, actor, body));
      case 'send-recovery':
        return json(await sendRecovery(admin, actor, body));
      default:
        throw httpError(400, 'Acción administrativa no reconocida.');
    }
  } catch (error) {
    const status = Number(error?.status || 500);
    console.error('admin-users:', error?.message || error);
    return json(
      { ok: false, error: status >= 500 ? 'No se pudo completar la operación administrativa.' : error.message },
      status,
    );
  }
});

function createAdminClient() {
  const url = requiredEnv('SUPABASE_URL');
  const key = serviceKey();
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    const keys = JSON.parse(raw);
    if (keys.default) return keys.default;
  }

  throw new Error('Falta la clave secreta del proyecto para administrar Auth.');
}

async function requireAdministrator(req, admin) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw httpError(401, 'Sesión requerida.');

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) throw httpError(401, 'La sesión no es válida o expiró.');

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email, role, account_status')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.role !== 'admin' || profile?.account_status === 'suspended') {
    throw httpError(403, 'Solo un administrador activo puede gestionar cuentas.');
  }

  return {
    id: authData.user.id,
    email: authData.user.email || profile.email,
  };
}

async function listAccounts(admin, body) {
  const page = clamp(Number(body.page || 1), 1, 10000);
  const perPage = clamp(Number(body.perPage || 100), 1, 200);
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page, perPage });
  if (authError) throw authError;

  const users = authData.users || [];
  const ids = users.map((user) => user.id);
  const emails = users.map((user) => user.email?.toLowerCase()).filter(Boolean);

  const [{ data: profiles, error: profilesError }, { data: employees, error: employeesError }, auditResult] = await Promise.all([
    ids.length
      ? admin.from('profiles').select('id, email, display_name, role, account_status, role_updated_at').in('id', ids)
      : Promise.resolve({ data: [], error: null }),
    emails.length
      ? admin.from('employees').select('id, name, email, position, area, status').in('email', emails)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from('account_audit_log')
      .select('id, actor_email, target_email, action, changes, created_at')
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  if (profilesError) throw profilesError;
  if (employeesError) throw employeesError;
  if (auditResult.error) throw auditResult.error;

  const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const employeesByEmail = new Map((employees || []).map((employee) => [employee.email?.toLowerCase(), employee]));

  return {
    ok: true,
    users: users.map((user) => serializeUser(
      user,
      profilesById.get(user.id),
      employeesByEmail.get(user.email?.toLowerCase()),
    )),
    total: authData.total ?? users.length,
    audit: auditResult.data || [],
  };
}

async function createAccount(admin, actor, body) {
  const email = validEmail(body.email);
  const password = validPassword(body.password);
  const displayName = cleanText(body.displayName, 120);
  const role = validRole(body.role);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
    app_metadata: { app_role: role },
  });
  if (error) throw translateAuthError(error);
  if (!data.user) throw new Error('Supabase no devolvió la cuenta creada.');

  try {
    await saveProfile(admin, data.user.id, email, displayName, role, 'active', actor.id);
    await linkEmployee(admin, data.user.id, email);
    await audit(admin, actor, data.user, 'account.created', { role, method: 'temporary_password' });
  } catch (error) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw error;
  }

  return {
    ok: true,
    message: 'Cuenta creada y confirmada.',
    user: serializeUser(data.user, {
      id: data.user.id,
      email,
      display_name: displayName,
      role,
      account_status: 'active',
    }),
  };
}

async function inviteAccount(admin, actor, body) {
  const email = validEmail(body.email);
  const displayName = cleanText(body.displayName, 120);
  const role = validRole(body.role);
  const redirectTo = validRedirect(body.redirectTo);

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName },
    ...(redirectTo ? { redirectTo } : {}),
  });
  if (error) throw translateAuthError(error);
  if (!data.user) throw new Error('Supabase no devolvió la invitación creada.');

  await saveProfile(admin, data.user.id, email, displayName, role, 'active', actor.id);
  await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { app_role: role } });
  await linkEmployee(admin, data.user.id, email);
  await audit(admin, actor, data.user, 'account.invited', { role, method: 'email_invitation' });

  return {
    ok: true,
    message: 'Invitación enviada correctamente.',
    user: serializeUser(data.user, {
      id: data.user.id,
      email,
      display_name: displayName,
      role,
      account_status: 'active',
    }),
  };
}

async function updateRole(admin, actor, body) {
  const userId = requiredId(body.userId);
  const role = validRole(body.role);
  if (userId === actor.id) throw httpError(400, 'No puedes cambiar el rol de tu propia cuenta.');

  const target = await getAuthUser(admin, userId);
  const currentProfile = await getProfile(admin, userId);
  if (currentProfile?.role === 'admin' && role !== 'admin') await ensureAnotherActiveAdmin(admin, userId);

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...(target.app_metadata || {}), app_role: role },
  });
  if (authError) throw authError;

  await saveProfile(
    admin,
    userId,
    target.email || currentProfile.email,
    currentProfile.display_name || target.user_metadata?.display_name || '',
    role,
    currentProfile.account_status || 'active',
    actor.id,
  );
  await audit(admin, actor, target, 'account.role_changed', { from: currentProfile?.role, to: role });

  return { ok: true, message: 'Permisos actualizados correctamente.' };
}

async function setStatus(admin, actor, body) {
  const userId = requiredId(body.userId);
  const status = validStatus(body.status);
  if (userId === actor.id) throw httpError(400, 'No puedes suspender ni modificar tu propia cuenta.');

  const target = await getAuthUser(admin, userId);
  const profile = await getProfile(admin, userId);
  if (profile?.role === 'admin' && status === 'suspended') await ensureAnotherActiveAdmin(admin, userId);

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: status === 'suspended' ? '876000h' : 'none',
    app_metadata: { ...(target.app_metadata || {}), account_status: status },
  });
  if (authError) throw authError;

  const { error: profileError } = await admin
    .from('profiles')
    .update({ account_status: status, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (profileError) throw profileError;

  await audit(admin, actor, target, status === 'suspended' ? 'account.suspended' : 'account.reactivated', {
    status,
  });

  return {
    ok: true,
    message: status === 'suspended' ? 'Cuenta suspendida.' : 'Cuenta reactivada.',
  };
}

async function sendRecovery(admin, actor, body) {
  const userId = requiredId(body.userId);
  const target = await getAuthUser(admin, userId);
  if (!target.email) throw httpError(400, 'La cuenta no tiene un correo válido.');

  const redirectTo = validRedirect(body.redirectTo);
  const { error } = await admin.auth.resetPasswordForEmail(
    target.email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (error) throw error;

  await audit(admin, actor, target, 'account.recovery_sent', {});
  return { ok: true, message: 'Correo de recuperación enviado.' };
}

async function saveProfile(admin, id, email, displayName, role, status, actorId) {
  const { error } = await admin.from('profiles').upsert({
    id,
    email: email.toLowerCase(),
    display_name: displayName,
    role,
    account_status: status,
    role_updated_at: new Date().toISOString(),
    role_updated_by: actorId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) throw error;
}

async function linkEmployee(admin, userId, email) {
  const { error } = await admin
    .from('employees')
    .update({ user_uid: userId, updated_at: new Date().toISOString() })
    .eq('email', email);
  if (error) throw error;
}

async function getAuthUser(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) throw httpError(404, 'Cuenta no encontrada.');
  return data.user;
}

async function getProfile(admin, userId) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, display_name, role, account_status')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureAnotherActiveAdmin(admin, excludedId) {
  const { count, error } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('account_status', 'active')
    .neq('id', excludedId);
  if (error) throw error;
  if (!count) throw httpError(409, 'Debe existir al menos otro administrador activo.');
}

async function audit(admin, actor, target, action, changes) {
  const { error } = await admin.from('account_audit_log').insert({
    actor_user_id: actor.id,
    actor_email: actor.email,
    target_user_id: target.id,
    target_email: target.email || '',
    action,
    changes,
  });
  if (error) throw error;
}

function serializeUser(user, profile = {}, employee = null) {
  const bannedUntil = user.banned_until || null;
  return {
    id: user.id,
    email: user.email || profile?.email || '',
    displayName: profile?.display_name || user.user_metadata?.display_name || employee?.name || '',
    role: profile?.role || user.app_metadata?.app_role || 'employee',
    status: isFuture(bannedUntil) ? 'suspended' : (profile?.account_status || 'active'),
    emailConfirmed: Boolean(user.email_confirmed_at),
    invitedAt: user.invited_at || null,
    lastSignInAt: user.last_sign_in_at || null,
    createdAt: user.created_at,
    bannedUntil,
    employee: employee ? {
      id: employee.id,
      name: employee.name,
      position: employee.position,
      area: employee.area,
      status: employee.status,
    } : null,
  };
}

function validEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Ingresa un correo válido.');
  return email;
}

function validPassword(value) {
  const password = String(value || '');
  if (password.length < 10) throw httpError(400, 'La contraseña temporal debe tener al menos 10 caracteres.');
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw httpError(400, 'La contraseña debe incluir mayúsculas, minúsculas y números.');
  }
  return password;
}

function validRole(value) {
  const role = String(value || 'employee');
  if (!VALID_ROLES.has(role)) throw httpError(400, 'Rol no permitido.');
  return role;
}

function validStatus(value) {
  const status = String(value || '');
  if (!VALID_STATUSES.has(status)) throw httpError(400, 'Estado de cuenta no permitido.');
  return status;
}

function validRedirect(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value));
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function requiredId(value) {
  const id = String(value || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw httpError(400, 'Identificador de cuenta inválido.');
  return id;
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

function isFuture(value) {
  return value ? new Date(value).getTime() > Date.now() : false;
}

function translateAuthError(error) {
  const message = String(error?.message || '');
  if (/already.*registered|already.*exists/i.test(message)) {
    return httpError(409, 'Ya existe una cuenta con ese correo.');
  }
  return error;
}

function requiredEnv(name) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
