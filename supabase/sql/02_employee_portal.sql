-- Portal del trabajador: directorio seguro, visibilidad documental y liquidaciones liberadas.
-- Ejecutar una vez en Supabase > SQL Editor después de 00_schema.sql y 01_storage.sql.

alter table public.documents
  add column if not exists visible_to_worker boolean not null default true;

drop policy if exists "documents_read_own" on public.documents;
create policy "documents_read_own" on public.documents
for select to authenticated
using (
  visible_to_worker = true
  and lower(owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
);

drop policy if exists "payroll_read_own" on public.payroll;
create policy "payroll_read_own" on public.payroll
for select to authenticated
using (
  status in ('Pendiente pago', 'Pagado')
  and lower(owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
);

-- La vista contiene exclusivamente información apta para un directorio interno.
-- No expone RUT, sueldo, teléfonos, fechas contractuales ni contactos de emergencia.
drop view if exists public.employee_directory;
create view public.employee_directory
with (security_barrier = true)
as
select
  id,
  name,
  email,
  position,
  area,
  work_location,
  photo_url,
  status
from public.employees
where status = 'Activo';

revoke all on public.employee_directory from anon;
revoke all on public.employee_directory from public;
grant select on public.employee_directory to authenticated;

comment on view public.employee_directory is
  'Directorio interno con campos laborales no sensibles para usuarios autenticados.';

notify pgrst, 'reload schema';
