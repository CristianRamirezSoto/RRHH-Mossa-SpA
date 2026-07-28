# SQL de Supabase

- `00_schema.sql`: esquema base y políticas RLS para instalaciones nuevas.
- `01_storage.sql`: bucket y políticas de Storage.
- `02_employee_portal.sql`: directorio interno seguro y reglas de visibilidad para documentos y liquidaciones.
- `03_document_permissions.sql`: permisos definitivos para que RRHH gestione y el trabajador solo descargue archivos propios.
- `04_secure_employee_directory.sql`: reemplaza la vista privilegiada por un directorio RLS sincronizado.
- `05_account_management.sql`: agrega estado de cuenta, auditoría y roles administrados.
- `06_secure_document_actions.sql`: registra descargas y eliminaciones documentales realizadas por las Edge Functions.
- `patches/`: correcciones históricas para bases existentes; revisar antes de ejecutar.
- `admin/`: tareas manuales sensibles, como asignar o restablecer administradores.

Las funciones `supabase/functions/admin-users` y `supabase/functions/document-actions` deben desplegarse con JWT habilitado. Utilizan las claves
secretas que Supabase entrega automáticamente a las Edge Functions y nunca las exponen al navegador.

Antes de ejecutar cualquier script en producción, crea un respaldo y confirma si el cambio ya fue aplicado. Los scripts administrativos no forman parte de un despliegue automático.
