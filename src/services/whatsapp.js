const configuredNumber = import.meta.env.VITE_HR_WHATSAPP_NUMBER || '';

export function whatsappConfigured() {
  return Boolean(formatWhatsappNumber(configuredNumber));
}

export function openWhatsAppRequestNotification(request) {
  const phone = formatWhatsappNumber(configuredNumber);
  if (!phone) return false;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(buildRequestMessage(request))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

function buildRequestMessage(request) {
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
