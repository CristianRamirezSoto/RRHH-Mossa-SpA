-- Reset administrativo para RRHH Mossaspa.
-- Ejecutar en Supabase > SQL Editor despues de SUPABASE_SCHEMA.sql.
--
-- Importante:
-- 1. Este script limpia datos de la app y perfiles publicos.
-- 2. Para limpiar/crear usuarios de Supabase Auth, usa Authentication > Users.
--    La anon key de la app no puede borrar/crear usuarios Auth como administrador.
-- 3. Crea el usuario Auth manualmente con:
--    email: cramirez@mossaspa.cl
--    password: Mossarcp343.
--    opcion recomendada: Auto Confirm User / Email Confirmed.
-- 4. Despues de crear el usuario en Auth, ejecuta la seccion "Vincular admin".

truncate table
  public.notifications,
  public.payroll,
  public.hr_requests,
  public.biometric_profiles,
  public.attendance_state,
  public.attendance,
  public.documents,
  public.employees
restart identity cascade;

delete from public.profiles
where lower(email) <> 'cramirez@mossaspa.cl';

-- Vincular admin desde auth.users hacia public.profiles.
insert into public.profiles (id, email, display_name, role, created_at, updated_at)
select
  id,
  lower(email),
  'Cristian Ramirez',
  'admin',
  now(),
  now()
from auth.users
where lower(email) = 'cramirez@mossaspa.cl'
on conflict (id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  role = 'admin',
  updated_at = now();

-- Verificacion esperada: debe devolver una fila con role = admin.
select id, email, display_name, role
from public.profiles
where lower(email) = 'cramirez@mossaspa.cl';
