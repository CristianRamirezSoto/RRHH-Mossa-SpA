-- Convierte cramirez@mossaspa.cl en administrador.
-- Ejecutar completo en Supabase > SQL Editor.

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

grant select on public.profiles to authenticated;
grant insert, select, update, delete on public.employees to authenticated;
grant insert, select, update, delete on public.documents to authenticated;
grant insert, select, update, delete on public.attendance to authenticated;
grant insert, select, update, delete on public.attendance_state to authenticated;
grant insert, select, update, delete on public.biometric_profiles to authenticated;
grant insert, select, update, delete on public.hr_requests to authenticated;
grant insert, select, update, delete on public.payroll to authenticated;
grant select, update on public.notifications to authenticated;

drop policy if exists "employees_admin_all" on public.employees;
create policy "employees_admin_all" on public.employees
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

notify pgrst, 'reload schema';

select id, email, display_name, role
from public.profiles
where lower(email) = 'cramirez@mossaspa.cl';
