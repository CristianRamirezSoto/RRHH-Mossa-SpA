-- Parche para mejorar remuneraciones sin borrar datos.
-- Agrega estados operativos, fecha/referencia de pago y observaciones.

alter table public.payroll add column if not exists payment_date date;
alter table public.payroll add column if not exists payment_reference text default '';
alter table public.payroll add column if not exists notes text default '';
alter table public.payroll add column if not exists paid_at timestamptz;

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
    'paid_at'
  )
order by column_name;
