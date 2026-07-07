-- Parche para actualizar la tabla employees sin borrar datos.
-- Ejecutar en Supabase > SQL Editor si aparece:
-- Could not find the 'contract_type' column of 'employees' in the schema cache

alter table public.employees add column if not exists contract_type text default 'Indefinido';
alter table public.employees add column if not exists work_location text default '';
alter table public.employees add column if not exists schedule_end text default '18:00';
alter table public.employees add column if not exists weekly_hours numeric not null default 44;
alter table public.employees add column if not exists supervisor text default '';
alter table public.employees add column if not exists supervisor_whatsapp text default '';
alter table public.employees add column if not exists emergency_contact text default '';
alter table public.employees add column if not exists emergency_phone text default '';

notify pgrst, 'reload schema';

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'employees'
  and column_name in (
    'contract_type',
    'work_location',
    'schedule_end',
    'weekly_hours',
    'supervisor',
    'supervisor_whatsapp',
    'emergency_contact',
    'emergency_phone'
  )
order by column_name;
