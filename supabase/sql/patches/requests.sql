-- Parche para historial, aprobacion/rechazo y respaldos de solicitudes.
-- Ejecutar en Supabase > SQL Editor sin borrar datos existentes.

alter table public.hr_requests add column if not exists resolution_comment text default '';
alter table public.hr_requests add column if not exists resolved_at timestamptz;
alter table public.hr_requests add column if not exists evidence_file_name text default '';
alter table public.hr_requests add column if not exists evidence_storage_path text default '';
alter table public.hr_requests add column if not exists evidence_content_type text default '';
alter table public.hr_requests add column if not exists evidence_size bigint not null default 0;
alter table public.hr_requests add column if not exists requested_changes jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'hr_requests'
  and column_name in (
    'resolution_comment',
    'resolved_at',
    'evidence_file_name',
    'evidence_storage_path',
    'evidence_content_type',
    'evidence_size'
  )
order by column_name;
