import { supabase, supabaseConfigured } from '../supabase';

const DOCUMENT_BUCKET = import.meta.env.VITE_SUPABASE_DOCUMENT_BUCKET || 'employee-documents';

function ensureSupabaseStorage() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase Storage no está configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }
}

export function createDocumentStoragePath({ employeeId, documentId, fileName }) {
  const safeName = fileName.replace(/[^\w.\-() ]/g, '_');
  return `employees/${employeeId}/documents/${documentId}/${Date.now()}-${safeName}`;
}

export async function uploadDocumentFile(path, file) {
  ensureSupabaseStorage();
  const { error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (error) throw error;
  return { bucket: DOCUMENT_BUCKET, path };
}

export async function getDocumentDownloadUrl(path) {
  ensureSupabaseStorage();
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, 60 * 10, { download: true });

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocumentFile(path) {
  ensureSupabaseStorage();
  const { error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .remove([path]);

  if (error) throw error;
}
