const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Metodo no permitido.' }, 405);
  }

  try {
    const { request } = await req.json();
    const payload = buildWhatsAppPayload(request);
    const phoneNumberId = requiredEnv('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = requiredEnv('WHATSAPP_ACCESS_TOKEN');
    const graphVersion = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v21.0';

    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ ok: false, error: data?.error?.message || 'WhatsApp rechazo el mensaje.', details: data }, response.status);
    }

    return json({ ok: true, provider: 'whatsapp_cloud_api', data });
  } catch (error) {
    return json({ ok: false, error: error.message || 'No se pudo enviar WhatsApp.' }, 500);
  }
});

function buildWhatsAppPayload(request) {
  const to = normalizePhone(requiredEnv('WHATSAPP_RECIPIENT_PHONE'));
  const templateName = Deno.env.get('WHATSAPP_TEMPLATE_NAME');
  const languageCode = Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') || 'es_CL';

  if (templateName) {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: 'body',
            parameters: [
              textParam(request.type),
              textParam(request.employeeName),
              textParam(formatDate(request.fromDate)),
              textParam(formatDate(request.toDate)),
              textParam(request.detail || 'Sin detalle'),
            ],
          },
        ],
      },
    };
  }

  return {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body: buildPlainTextMessage(request),
    },
  };
}

function buildPlainTextMessage(request) {
  return [
    'Nueva solicitud RRHH Mossaspa',
    `Tipo: ${request.type}`,
    `Trabajador: ${request.employeeName}`,
    `Desde: ${formatDate(request.fromDate)}`,
    `Hasta: ${formatDate(request.toDate)}`,
    `Detalle: ${request.detail || 'Sin detalle'}`,
    'Estado: Pendiente',
  ].join('\n');
}

function textParam(text) {
  return { type: 'text', text: String(text || '') };
}

function requiredEnv(name) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
