-- Arreglo de permisos de produccion para RRHH Mossaspa.
-- Ejecutar completo en Supabase > SQL Editor.
--
-- Objetivo:
-- - cramirez@mossaspa.cl queda como administrador real.
-- - Admin puede operar modulos internos.
-- - Colaboradores solo ven/crean lo que corresponde a su correo/usuario.
-- - Se eliminan policies de demostracion si fueron creadas.

grant usage on schema public to authenticated;

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
  or lower(coalesce(auth.jwt()->>'email', '')) = 'cramirez@mossaspa.cl';
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

grant select on public.profiles to authenticated;
grant insert, select, update, delete on public.employees to authenticated;
grant insert, select, update, delete on public.documents to authenticated;
grant insert, select, update, delete on public.attendance to authenticated;
grant insert, select, update, delete on public.attendance_state to authenticated;
grant insert, select, update, delete on public.biometric_profiles to authenticated;
grant insert, select, update, delete on public.hr_requests to authenticated;
grant insert, select, update, delete on public.payroll to authenticated;
grant select, update on public.notifications to authenticated;

drop policy if exists "demo_profiles_authenticated_all" on public.profiles;
drop policy if exists "demo_employees_authenticated_all" on public.employees;
drop policy if exists "demo_documents_authenticated_all" on public.documents;
drop policy if exists "demo_attendance_authenticated_all" on public.attendance;
drop policy if exists "demo_attendance_state_authenticated_all" on public.attendance_state;
drop policy if exists "demo_biometric_profiles_authenticated_all" on public.biometric_profiles;
drop policy if exists "demo_hr_requests_authenticated_all" on public.hr_requests;
drop policy if exists "demo_payroll_authenticated_all" on public.payroll;
drop policy if exists "demo_notifications_authenticated_all" on public.notifications;

drop policy if exists "profiles_read_own_or_admin" on public.profiles;
create policy "profiles_read_own_or_admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "employees_admin_all" on public.employees;
create policy "employees_admin_all" on public.employees
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "employees_read_own" on public.employees;
create policy "employees_read_own" on public.employees
for select to authenticated
using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "documents_admin_all" on public.documents;
create policy "documents_admin_all" on public.documents
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "documents_read_own" on public.documents;
create policy "documents_read_own" on public.documents
for select to authenticated
using (lower(owner_email) = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "attendance_admin_all" on public.attendance;
create policy "attendance_admin_all" on public.attendance
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "attendance_read_own" on public.attendance;
create policy "attendance_read_own" on public.attendance
for select to authenticated
using (user_uid = auth.uid() or lower(owner_email) = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "admin_state_all" on public.attendance_state;
create policy "admin_state_all" on public.attendance_state
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_biometric_all" on public.biometric_profiles;
create policy "admin_biometric_all" on public.biometric_profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "requests_admin_all" on public.hr_requests;
create policy "requests_admin_all" on public.hr_requests
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "requests_own_select_insert" on public.hr_requests;
create policy "requests_own_select_insert" on public.hr_requests
for select to authenticated
using (lower(owner_email) = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "requests_insert_own" on public.hr_requests;
create policy "requests_insert_own" on public.hr_requests
for insert to authenticated
with check (public.is_admin() or lower(owner_email) = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "payroll_admin_all" on public.payroll;
create policy "payroll_admin_all" on public.payroll
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "payroll_read_own" on public.payroll;
create policy "payroll_read_own" on public.payroll
for select to authenticated
using (lower(owner_email) = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "notifications_read_own_or_admin" on public.notifications;
create policy "notifications_read_own_or_admin" on public.notifications
for select to authenticated
using (public.is_admin() or recipient_uid = auth.uid() or lower(owner_email) = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update to authenticated
using (recipient_uid = auth.uid() or public.is_admin())
with check (recipient_uid = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';

select
  u.id,
  lower(u.email) as auth_email,
  p.email as profile_email,
  p.role as profile_role,
  case when lower(u.email) = 'cramirez@mossaspa.cl' and p.role = 'admin'
    then 'OK_ADMIN_CONFIGURADO'
    else 'REVISAR_ADMIN'
  end as estado
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = 'cramirez@mossaspa.cl';
