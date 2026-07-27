const env = import.meta.env;

export const appConfig = Object.freeze({
  supabaseUrl: env.VITE_SUPABASE_URL?.trim() || '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY?.trim() || '',
  documentBucket: env.VITE_SUPABASE_DOCUMENT_BUCKET?.trim() || 'employee-documents',
  adminEmail: (env.VITE_ADMIN_EMAIL?.trim() || 'cramirez@mossaspa.cl').toLowerCase(),
  hrWhatsappNumber: env.VITE_HR_WHATSAPP_NUMBER?.trim() || '',
  manualWhatsappFallback: env.VITE_ENABLE_MANUAL_WHATSAPP_FALLBACK === 'true',
});

export const missingRequiredConfig = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(
  (key) => !env[key]?.trim(),
);
