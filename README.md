# RRHH Mossa SpA

Sistema de recursos humanos construido con React, Vite y Supabase. Vercel publica el frontend y Supabase proporciona autenticación, Postgres, Storage y Edge Functions.

## Módulos

- Panel administrativo y colaboradores.
- Marcaje facial, enrolamiento biométrico y asistencia.
- Expedientes digitales almacenados en Supabase Storage.
- Solicitudes, remuneraciones, perfil y notificaciones internas.
- Portal del trabajador con inicio personal, directorio interno, documentos y liquidaciones liberadas.

## Desarrollo local

Requisitos: Node.js 20 o superior.

```bash
pnpm install
copy .env.example .env.local
pnpm dev
```

Completa en `.env.local` al menos `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Nunca publiques `.env.local` ni una `service_role` key.

## Verificación

```bash
pnpm lint
pnpm build
```

`pnpm check` ejecuta ambas comprobaciones antes de publicar.

## Supabase

Para una instalación nueva, ejecuta en SQL Editor:

1. `supabase/sql/00_schema.sql`
2. `supabase/sql/01_storage.sql`
3. `supabase/sql/02_employee_portal.sql`
4. `supabase/sql/03_document_permissions.sql`
5. `supabase/sql/04_secure_employee_directory.sql`
6. `supabase/sql/05_account_management.sql`
7. `supabase/sql/06_secure_document_actions.sql`

### Administración de cuentas

El panel `Usuarios y permisos` utiliza una Edge Function protegida para operar con Supabase Auth.
Después de ejecutar las migraciones, despliega las funciones:

```bash
supabase functions deploy admin-users
supabase functions deploy document-actions
```

Las funciones validan el JWT del solicitante, comprueban el rol para cada operación y
mantienen la clave secreta exclusivamente en Supabase. El autorregistro público queda desactivado
por defecto; puede habilitarse explícitamente con `VITE_ALLOW_SELF_REGISTRATION=true`.

Cuando el panel esté operativo, desactiva también `Allow new users to sign up` en
`Supabase > Authentication > Sign In / Providers`; las invitaciones y altas administrativas seguirán funcionando.

Los archivos de `supabase/sql/patches` documentan ajustes históricos y no deben ejecutarse indiscriminadamente sobre una instalación nueva. Las tareas administrativas manuales están en `supabase/sql/admin`.

La Edge Function de WhatsApp está en `supabase/functions/send-whatsapp-request`.

## Estructura

```text
src/
  config/       variables y configuración pública del frontend
  features/     módulos funcionales
  components/   componentes compartidos
  context/      estado global de autenticación
  lib/          clientes de servicios externos
  services/     acceso a datos y almacenamiento
  styles/       estilos globales
supabase/
  functions/    Edge Functions
  sql/          esquema, parches y tareas administrativas
docs/           arquitectura, configuración y despliegue
```

Consulta [docs/README.md](docs/README.md) para el índice completo de documentación.
