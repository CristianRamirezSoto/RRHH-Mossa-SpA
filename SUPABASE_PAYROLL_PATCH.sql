-- Parche para mejorar remuneraciones sin borrar datos.
-- Agrega estados operativos, fecha/referencia de pago y observaciones.

alter table public.payroll add column if not exists payment_date date;
alter table public.payroll add column if not exists payment_reference text default '';
alter table public.payroll add column if not exists notes text default '';
alter table public.payroll add column if not exists paid_at timestamptz;
alter table public.payroll add column if not exists receipt_file_name text;
alter table public.payroll add column if not exists receipt_storage_path text;
alter table public.payroll add column if not exists receipt_content_type text;
alter table public.payroll add column if not exists receipt_size bigint;
alter table public.payroll add column if not exists prepared_at timestamptz;
alter table public.payroll add column if not exists prepared_by uuid;
alter table public.payroll add column if not exists approved_at timestamptz;
alter table public.payroll add column if not exists approved_by uuid;

update public.payroll
set status = 'Pagado'
where status = 'Cerrado';

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.payroll'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';

  if constraint_name is not null then
    execute format('alter table public.payroll drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.payroll
  add constraint payroll_status_check
  check (status in ('Borrador', 'Listo para pago', 'Pendiente pago', 'Pagado'));

notify pgrst, 'reload schema';

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'payroll'
  and column_name in (
    'status',
    'payment_date',
    'payment_reference',
    'notes',
    'paid_at',
    'receipt_file_name',
    'receipt_storage_path',
    'prepared_at',
    'prepared_by',
    'approved_at',
    'approved_by'
  )
order by column_name;
