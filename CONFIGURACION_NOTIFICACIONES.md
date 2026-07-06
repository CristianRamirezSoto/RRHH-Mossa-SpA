# Configuración de notificaciones

El código deja preparados tres canales:

1. Notificaciones dentro de la aplicación.
2. Correos generados en la colección `mail`.
3. Push web/móvil mediante Firebase Cloud Messaging.

## Correos

Instalar la extensión oficial Trigger Email from Firestore y configurar SMTP:

```bash
firebase ext:install firebase/firestore-send-email
```

La extensión debe observar la colección `mail`.

## Push web y móvil

Generar una clave Web Push en Firebase Console > Configuración del proyecto >
Cloud Messaging y agregarla en `.env.local`:

```env
VITE_FIREBASE_VAPID_KEY=clave_publica_web_push
```

Cada usuario registra su teléfono o navegador desde el botón
**Activar avisos en este dispositivo**.

En iPhone, las notificaciones web requieren instalar primero la aplicación en
la pantalla de inicio.

## Revisión de vencimientos

La función programada `checkDocumentExpirations` se ejecuta todos los días a
las 08:00 en la zona `America/Santiago`. Genera una alerta cuando:

- El documento está vencido.
- El documento vence dentro de los próximos 30 días.

El despliegue de funciones programadas requiere un proyecto Firebase real con
facturación habilitada.
