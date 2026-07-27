-- Permisos de demostracion para RRHH Mossaspa.
-- Ejecutar completo en Supabase > SQL Editor si la app sigue devolviendo 403.
--
-- Objetivo: desbloquear el sistema para demo interna con login obligatorio.
-- Nota: esto es practico para presentar el sistema; antes de produccion se deben
-- volver a endurecer las policies por rol y por trabajador.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert, update, delete on public.attendance_state to authenticated;
grant select, insert, update, delete on public.biometric_profiles to authenticated;
grant select, insert, update, delete on public.hr_requests to authenticated;
grant select, insert, update, delete on public.payroll to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
  or exists (
    select 1
    from auth.users
    where id = auth.uid()
      and lower(email) = 'cramirez@mossaspa.cl'
  );
$$;

grant execute on function public.is_admin() to authenticated;

insert into public.profiles (id, email, display_name, role, created_at, updated_at)
select
  id,
  lower(email),
  coalesce(raw_user_meta_data->>'display_name', 'Cristian Ramirez'),
  'admin',
  now(),
  now()
from auth.users
where lower(email) = 'cramirez@mossaspa.cl'
on conflict (id) do update
set
  email = excluded.email,
  display_name = coalesce(public.profiles.display_name, excluded.display_name),
  role = 'admin',
  updated_at = now();

drop policy if exists "demo_profiles_authenticated_all" on public.profiles;
create policy "demo_profiles_authenticated_all" on public.profiles
for all to authenticated
using (true)
with check (true);

drop policy if exists "demo_employees_authenticated_all" on public.employees;
create policy "demo_employees_authenticated_all" on public.employees
for all to authenticated
using (true)
with check (true);

drop policy if exists "demo_documents_authenticated_all" on public.documents;
create policy "demo_documents_authenticated_all" on public.documents
for all to authenticated
using (true)
with check (true);

drop policy if exists "demo_attendance_authenticated_all" on public.attendance;
create policy "demo_attendance_authenticated_all" on public.attendance
for all to authenticated
using (true)
with check (true);

drop policy if exists "demo_attendance_state_authenticated_all" on public.attendance_state;
create policy "demo_attendance_state_authenticated_all" on public.attendance_state
for all to authenticated
using (true)
with check (true);

drop policy if exists "demo_biometric_profiles_authenticated_all" on public.biometric_profiles;
create policy "demo_biometric_profiles_authenticated_all" on public.biometric_profiles
for all to authenticated
using (true)
with check (true);

drop policy if exists "demo_hr_requests_authenticated_all" on public.hr_requests;
create policy "demo_hr_requests_authenticated_all" on public.hr_requests
for all to authenticated
using (true)
with check (true);

drop policy if exists "demo_payroll_authenticated_all" on public.payroll;
create policy "demo_payroll_authenticated_all" on public.payroll
for all to authenticated
using (true)
with check (true);

drop policy if exists "demo_notifications_authenticated_all" on public.notifications;
create policy "demo_notifications_authenticated_all" on public.notifications
for all to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';

select id, email, display_name, role
from public.profiles
where lower(email) = 'cramirez@mossaspa.cl';
