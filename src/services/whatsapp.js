import { supabase, supabaseConfigured } from '../supabase';

const fallbackNumber = import.meta.env.VITE_HR_WHATSAPP_NUMBER || '';
const manualFallbackEnabled = import.meta.env.VITE_ENABLE_MANUAL_WHATSAPP_FALLBACK === 'true';

export function whatsappConfigured() {
  return supabaseConfigured || Boolean(formatWhatsappNumber(fallbackNumber));
}

export function whatsappModeLabel() {
  return supabaseConfigured
    ? 'WhatsApp Empresa'
    : 'WhatsApp manual';
}

export async function notifyRequestByWhatsApp(request) {
  if (supabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke('send-whatsapp-request', {
      body: { request },
    });

    if (!error && data?.ok) {
      return { ok: true, mode: 'business', message: 'Aviso enviado desde WhatsApp Empresa.' };
    }

    console.warn('No se pudo enviar WhatsApp corporativo:', error?.message || data?.error);
  }

  const opened = manualFallbackEnabled && openManualWhatsAppRequestNotification(request);
  return opened
    ? { ok: true, mode: 'manual', message: 'No esta activo WhatsApp Empresa; se abrio WhatsApp manual como respaldo.' }
    : { ok: false, mode: 'none', message: 'Solicitud enviada. Falta configurar WhatsApp Empresa en Supabase.' };
}

export function openManualWhatsAppRequestNotification(request) {
  const phone = formatWhatsappNumber(fallbackNumber);
  if (!phone) return false;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(buildRequestMessage(request))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function buildRequestMessage(request) {
  const lines = [
    '*Nueva solicitud RRHH Mossaspa*',
    `Tipo: ${request.type}`,
    `Trabajador: ${request.employeeName}`,
    `Desde: ${formatDate(request.fromDate)}`,
    `Hasta: ${formatDate(request.toDate)}`,
    `Estado: ${request.status || 'Pendiente'}`,
  ];
  if (request.detail) lines.push(`Detalle: ${request.detail}`);
  lines.push('', 'Revisar en el sistema RRHH.');
  return lines.join('\n');
}

function formatWhatsappNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('56')) return digits;
  if (digits.length === 9) return `56${digits}`;
  return digits;
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
    : 'Sin fecha';
}
