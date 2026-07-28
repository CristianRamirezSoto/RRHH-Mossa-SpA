import { supabase, supabaseConfigured } from '../lib/supabase';

async function invoke(action, documentId) {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase no está configurado.');

  const { data, error } = await supabase.functions.invoke('document-actions', {
    body: { action, documentId },
  });

  if (error) {
    let message = error.message || 'No se pudo completar la operación documental.';
    try {
      const details = await error.context?.json();
      if (details?.error) message = details.error;
    } catch {
      // Conservamos el mensaje original cuando la respuesta no incluye JSON.
    }
    throw new Error(message);
  }

  if (!data?.ok) throw new Error(data?.error || 'No se pudo completar la operación documental.');
  return data;
}

export function requestDocumentDownload(documentId) {
  return invoke('download', documentId);
}

export function deleteManagedDocument(documentId) {
  return invoke('delete', documentId);
}
