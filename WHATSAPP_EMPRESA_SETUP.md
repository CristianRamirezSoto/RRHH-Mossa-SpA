# WhatsApp Empresa para solicitudes RRHH

El envio corporativo no debe salir desde un WhatsApp personal. Para eso se usa WhatsApp Business Platform / Cloud API de Meta y una Supabase Edge Function.

## Flujo del sistema

1. Un colaborador crea una solicitud en la app.
2. La solicitud queda guardada en Supabase (`hr_requests`).
3. La app llama a la funcion `send-whatsapp-request`.
4. La funcion usa el token seguro de Meta y envia el mensaje desde el numero empresarial.

## Credenciales necesarias

Desde Meta for Developers / WhatsApp Business Platform:

- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_RECIPIENT_PHONE`
- `WHATSAPP_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE`

Ejemplo de secretos:

```env
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_RECIPIENT_PHONE=56933542751
WHATSAPP_TEMPLATE_NAME=solicitud_rrhh
WHATSAPP_TEMPLATE_LANGUAGE=es_CL
WHATSAPP_GRAPH_VERSION=v21.0
```

No subir estos valores a GitHub.

## Plantilla recomendada en Meta

Nombre:

`solicitud_rrhh`

Idioma:

`es_CL`

Texto sugerido:

```text
Nueva solicitud RRHH Mossaspa.
Tipo: {{1}}
Trabajador: {{2}}
Desde: {{3}}
Hasta: {{4}}
Detalle: {{5}}
```

Meta debe aprobar la plantilla antes de usarla para mensajes iniciados por la empresa.

## Deploy de la funcion

Cuando Supabase CLI este disponible:

```powershell
supabase functions deploy send-whatsapp-request
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=...
supabase secrets set WHATSAPP_ACCESS_TOKEN=...
supabase secrets set WHATSAPP_RECIPIENT_PHONE=56933542751
supabase secrets set WHATSAPP_TEMPLATE_NAME=solicitud_rrhh
supabase secrets set WHATSAPP_TEMPLATE_LANGUAGE=es_CL
supabase secrets set WHATSAPP_GRAPH_VERSION=v21.0
```

Tambien se pueden cargar secretos desde el Dashboard:

`Supabase > Edge Functions > Secrets`

## Estado actual

La app ya intenta enviar por la funcion corporativa `send-whatsapp-request`.

Si la funcion aun no esta desplegada o faltan secretos, la solicitud queda guardada igual y el sistema muestra que falta configurar WhatsApp Empresa.
