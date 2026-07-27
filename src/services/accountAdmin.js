import { supabase, supabaseConfigured } from '../lib/supabase';

async function invoke(action, payload = {}) {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');

  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...payload },
  });

  if (error) {
    let message = error.message || 'No se pudo completar la operación.';
    try {
      const details = await error.context?.json();
      if (details?.error) message = details.error;
    } catch {
      // La respuesta puede no contener JSON; conservamos el mensaje original.
    }
    throw new Error(message);
  }

  if (!data?.ok) throw new Error(data?.error || 'No se pudo completar la operación.');
  return data;
}

export function listAccounts() {
  return invoke('list', { page: 1, perPage: 200 });
}

export function createAccount(payload) {
  return invoke('create', payload);
}

export function inviteAccount(payload) {
  return invoke('invite', payload);
}

export function updateAccountRole(userId, role) {
  return invoke('update-role', { userId, role });
}

export function setAccountStatus(userId, status) {
  return invoke('set-status', { userId, status });
}

export function sendAccountRecovery(userId) {
  return invoke('send-recovery', {
    userId,
    redirectTo: `${window.location.origin}/login`,
  });
}
