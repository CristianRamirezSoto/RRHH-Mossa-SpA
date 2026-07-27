# SQL de Supabase

- `00_schema.sql`: esquema base y políticas RLS para instalaciones nuevas.
- `01_storage.sql`: bucket y políticas de Storage.
- `02_employee_portal.sql`: directorio interno seguro y reglas de visibilidad para documentos y liquidaciones.
- `patches/`: correcciones históricas para bases existentes; revisar antes de ejecutar.
- `admin/`: tareas manuales sensibles, como asignar o restablecer administradores.

Antes de ejecutar cualquier script en producción, crea un respaldo y confirma si el cambio ya fue aplicado. Los scripts administrativos no forman parte de un despliegue automático.
