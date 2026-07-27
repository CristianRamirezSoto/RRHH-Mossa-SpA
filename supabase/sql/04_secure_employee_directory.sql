-- Corrige la alerta Security Definer View de Supabase para employee_directory.
-- Ejecutar una vez en Supabase > SQL Editor despues de 03_document_permissions.sql.
--
-- La vista anterior se reemplaza por una tabla RLS que solo contiene campos
-- laborales aptos para el directorio. Un trigger privado la mantiene sincronizada.

begin;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'employee_directory'
      and c.relkind = 'v'
  ) then
    execute 'drop view public.employee_directory';
  end if;
end;
$$;

create table if not exists public.employee_directory (
  id uuid primary key references public.employees(id) on delete cascade,
  name text not null,
  email text not null,
  position text default '',
  area text default '',
  work_location text default '',
  photo_url text default '',
  status text not null default 'Activo'
);

alter table public.employee_directory enable row level security;

drop policy if exists "employee_directory_read_authenticated" on public.employee_directory;
create policy "employee_directory_read_authenticated"
on public.employee_directory
for select
to authenticated
using ((select auth.uid()) is not null);

revoke all on public.employee_directory from anon;
revoke all on public.employee_directory from public;
revoke all on public.employee_directory from authenticated;
grant select on public.employee_directory to authenticated;

create or replace function public.sync_employee_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.employee_directory where id = old.id;
    return old;
  end if;

  if new.status = 'Activo' then
    insert into public.employee_directory (
      id, name, email, position, area, work_location, photo_url, status
    )
    values (
      new.id, new.name, new.email, new.position, new.area,
      new.work_location, new.photo_url, new.status
    )
    on conflict (id) do update set
      name = excluded.name,
      email = excluded.email,
      position = excluded.position,
      area = excluded.area,
      work_location = excluded.work_location,
      photo_url = excluded.photo_url,
      status = excluded.status;
  else
    delete from public.employee_directory where id = new.id;
  end if;

  return new;
end;
$$;

-- Es una funcion exclusiva del trigger: ningun usuario de la API puede llamarla.
revoke all on function public.sync_employee_directory() from public;
revoke all on function public.sync_employee_directory() from anon;
revoke all on function public.sync_employee_directory() from authenticated;

drop trigger if exists employees_sync_directory on public.employees;
create trigger employees_sync_directory
after insert or update or delete on public.employees
for each row execute function public.sync_employee_directory();

insert into public.employee_directory (
  id, name, email, position, area, work_location, photo_url, status
)
select
  id, name, email, position, area, work_location, photo_url, status
from public.employees
where status = 'Activo'
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  position = excluded.position,
  area = excluded.area,
  work_location = excluded.work_location,
  photo_url = excluded.photo_url,
  status = excluded.status;

delete from public.employee_directory d
where not exists (
  select 1
  from public.employees e
  where e.id = d.id
    and e.status = 'Activo'
);

comment on table public.employee_directory is
  'Directorio interno RLS con campos laborales no sensibles para usuarios autenticados.';

notify pgrst, 'reload schema';

commit;
