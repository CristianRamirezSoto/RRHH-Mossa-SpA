import { createClient } from 'npm:@supabase/supabase-js@2.108.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido.' }, 405);

  try {
    const admin = createAdminClient();
    const actor = await requireUser(req, admin);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const documentId = requiredId(body.documentId);

    if (action === 'download') {
      const document = await getDocument(admin, documentId);
      await authorizeDownload(actor, document);
      return json(await createDownload(admin, actor, document));
    }

    if (action === 'delete') {
      if (!actor.isAdmin) throw httpError(403, 'Solo un administrador puede eliminar documentos.');
      const document = await getDocument(admin, documentId);
      return json(await deleteDocument(admin, actor, document));
    }

    throw httpError(400, 'Acción documental no reconocida.');
  } catch (error) {
    const status = Number(error?.status || 500);
    console.error('document-actions:', error?.message || error);
    return json(
      { ok: false, error: status >= 500 ? 'No se pudo completar la operación documental.' : error.message },
      status,
    );
  }
});

function createAdminClient() {
  return createClient(requiredEnv('SUPABASE_URL'), serviceKey(), {
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

  throw new Error('Falta la clave secreta del proyecto para administrar documentos.');
}

async function requireUser(req, admin) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw httpError(401, 'Sesión requerida.');

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) throw httpError(401, 'La sesión no es válida o expiró.');

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, account_status')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.account_status === 'suspended') throw httpError(403, 'La cuenta se encuentra suspendida.');

  return {
    id: authData.user.id,
    email: String(authData.user.email || '').toLowerCase(),
    isAdmin: profile?.role === 'admin' && profile?.account_status !== 'suspended',
  };
}

async function getDocument(admin, documentId) {
  const { data, error } = await admin
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw httpError(404, 'El documento ya no existe en el expediente.');
  return data;
}

function authorizeDownload(actor, document) {
  const ownsDocument = String(document.owner_email || '').toLowerCase() === actor.email;
  if (!actor.isAdmin && (!ownsDocument || document.visible_to_worker === false)) {
    throw httpError(403, 'No tienes permiso para descargar este documento.');
  }
}

async function createDownload(admin, actor, document) {
  const bucket = document.storage_bucket || 'employee-documents';
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(document.storage_path, 60 * 10, {
      download: document.file_name || true,
    });

  if (error || !data?.signedUrl) throw error || new Error('No se pudo crear el enlace de descarga.');
  await writeAudit(admin, actor, document, 'document.downloaded');

  return {
    ok: true,
    fileName: document.file_name,
    downloadUrl: data.signedUrl,
    expiresIn: 600,
  };
}

async function deleteDocument(admin, actor, document) {
  const bucket = document.storage_bucket || 'employee-documents';
  const { error: storageError } = await admin.storage
    .from(bucket)
    .remove([document.storage_path]);
  if (storageError) throw storageError;

  const { error: deleteError } = await admin
    .from('documents')
    .delete()
    .eq('id', document.id);
  if (deleteError) throw deleteError;

  await writeAudit(admin, actor, document, 'document.deleted');
  return {
    ok: true,
    message: 'Documento eliminado definitivamente del expediente y del almacenamiento.',
  };
}

async function writeAudit(admin, actor, document, action) {
  const { error } = await admin.from('document_audit_log').insert({
    document_id: document.id,
    employee_id: document.employee_id,
    employee_name: document.employee_name,
    actor_user_id: actor.id,
    actor_email: actor.email,
    action,
    file_name: document.file_name,
    storage_path: document.storage_path,
    details: {
      category: document.category,
      owner_email: document.owner_email,
      visible_to_worker: document.visible_to_worker,
    },
  });
  if (error) console.warn('No se pudo registrar la auditoría documental:', error.message);
}

function requiredId(value) {
  const id = String(value || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw httpError(400, 'Identificador de documento inválido.');
  return id;
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
