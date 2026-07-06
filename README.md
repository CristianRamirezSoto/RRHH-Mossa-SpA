# RRHH Mossaspa

Aplicacion de RRHH en React + Vite con Supabase para autenticacion, base de datos y Storage.

## Modulos

- Autenticacion con Supabase Auth.
- Panel administrativo.
- Colaboradores.
- Marcaje facial y asistencia.
- Enrolamiento biometrico.
- Expedientes digitales con Supabase Storage.
- Solicitudes de vacaciones, permisos, licencias, ausencias y horas extra.
- Remuneraciones mensuales.
- Notificaciones internas.

## Configuracion Supabase

1. Crear o abrir el proyecto en Supabase.
2. Ejecutar `SUPABASE_SCHEMA.sql` en SQL Editor.
3. Ejecutar `SUPABASE_STORAGE_SETUP.sql` en SQL Editor.
4. Verificar en Authentication > Providers que Email este habilitado.
5. Si quieres entrar sin confirmar correo en desarrollo, desactiva email confirmation en Authentication > Providers > Email.
6. Crear una cuenta con el correo definido en `VITE_ADMIN_EMAIL`. Por defecto: `cramirez@mossaspa.cl`.

## Variables de entorno

Crear `.env.local` con:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
VITE_SUPABASE_DOCUMENT_BUCKET=employee-documents
VITE_ADMIN_EMAIL=cramirez@mossaspa.cl
```

Las variables Firebase antiguas ya no son necesarias para el flujo principal.

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir:

```text
http://127.0.0.1:5173
```

## Build

```bash
npm run build
```

Puede aparecer una advertencia de chunks grandes por el motor biometrico. No bloquea el build.

## Notas de seguridad

- Las politicas RLS estan en `SUPABASE_SCHEMA.sql`.
- `profiles.role` no debe actualizarse desde el cliente. El SQL limita la actualizacion de perfiles a `display_name`, `bio` y `updated_at`.
- Storage queda limitado a usuarios autenticados. Para produccion mas estricta, conviene mover descargas/subidas sensibles a Edge Functions.
