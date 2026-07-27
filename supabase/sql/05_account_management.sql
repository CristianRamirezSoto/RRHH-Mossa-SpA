-- Gestion profesional de cuentas y permisos.
-- Ejecutar en Supabase > SQL Editor despues de 04_secure_employee_directory.sql.

begin;

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended'));

alter table public.profiles
  add column if not exists role_updated_at timestamptz;

alter table public.profiles
  add column if not exists role_updated_by uuid references auth.users(id) on delete set null;

update public.profiles
set account_status = 'active'
where account_status is null;

create table if not exists public.account_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text not null default '',
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_audit_log_created_at_idx
  on public.account_audit_log (created_at desc);

create index if not exists account_audit_log_target_user_idx
  on public.account_audit_log (target_user_id);

alter table public.account_audit_log enable row level security;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_admin() from anon;
grant execute on function private.is_admin() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "account_audit_admin_read" on public.account_audit_log;
create policy "account_audit_admin_read"
on public.account_audit_log
for select
to authenticated
using (public.is_admin());

revoke all on public.account_audit_log from anon;
revoke all on public.account_audit_log from public;
revoke all on public.account_audit_log from authenticated;
grant select on public.account_audit_log to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    role,
    account_status
  )
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    case when lower(new.email) = 'cramirez@mossaspa.cl' then 'admin' else 'employee' end,
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

notify pgrst, 'reload schema';

commit;
