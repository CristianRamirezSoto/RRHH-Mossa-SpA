-- Esquema base para RRHH Mossaspa usando Supabase Auth + Postgres.
-- Ejecutar en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text default '',
  bio text default '',
  role text not null default 'employee' check (role in ('admin', 'employee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text default '',
  rut text default '',
  position text default '',
  area text default '',
  employee_code text default '',
  contract_type text default 'Indefinido',
  work_location text default '',
  schedule_end text default '18:00',
  weekly_hours numeric not null default 44,
  supervisor text default '',
  supervisor_whatsapp text default '',
  emergency_contact text default '',
  emergency_phone text default '',
  start_date date,
  contract_date date,
  schedule_start text default '08:00',
  biometric_consent boolean not null default false,
  biometric_enrolled boolean not null default false,
  biometric_updated_at timestamptz,
  status text not null default 'Activo' check (status in ('Activo', 'Pendiente', 'Inactivo')),
  base_salary numeric not null default 0,
  photo_url text default '',
  user_uid uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees add column if not exists employee_code text default '';
alter table public.employees add column if not exists contract_type text default 'Indefinido';
alter table public.employees add column if not exists work_location text default '';
alter table public.employees add column if not exists schedule_end text default '18:00';
alter table public.employees add column if not exists weekly_hours numeric not null default 44;
alter table public.employees add column if not exists supervisor text default '';
alter table public.employees add column if not exists supervisor_whatsapp text default '';
alter table public.employees add column if not exists emergency_contact text default '';
alter table public.employees add column if not exists emergency_phone text default '';

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  employee_name text not null,
  owner_email text not null,
  category text not null,
  expiry_date date,
  observations text default '',
  file_name text not null,
  storage_path text not null,
  storage_bucket text not null default 'employee-documents',
  storage_provider text not null default 'supabase',
  content_type text default 'application/octet-stream',
  size bigint not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  notification_state text default 'pending'
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  employee_name text not null,
  position text default '',
  photo_url text default '',
  owner_email text not null,
  user_uid uuid references auth.users(id) on delete set null,
  type text not null check (type in ('entry', 'exit')),
  status text not null default 'ok' check (status in ('ok', 'late')),
  confidence numeric not null default 0,
  date_key text not null,
  source text not null default 'facial-recognition',
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_state (
  id text primary key,
  employee_id uuid not null references public.employees(id) on delete cascade,
  date_key text not null,
  last_type text not null check (last_type in ('entry', 'exit')),
  last_at timestamptz not null default now(),
  last_attendance_id uuid
);

create table if not exists public.biometric_profiles (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  employee_name text not null,
  descriptor jsonb not null,
  sample_count integer not null default 0,
  model text not null default '@vladmandic/human:faceres',
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  employee_name text not null,
  owner_email text not null,
  type text not null check (type in ('Vacaciones', 'Permiso', 'Licencia', 'Horas extra', 'Ausencia')),
  from_date date not null,
  to_date date not null,
  detail text default '',
  status text not null default 'Pendiente' check (status in ('Pendiente', 'Aprobada', 'Rechazada')),
  resolution_comment text default '',
  resolved_at timestamptz,
  evidence_file_name text default '',
  evidence_storage_path text default '',
  evidence_content_type text default '',
  evidence_size bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hr_requests add column if not exists resolution_comment text default '';
alter table public.hr_requests add column if not exists resolved_at timestamptz;
alter table public.hr_requests add column if not exists evidence_file_name text default '';
alter table public.hr_requests add column if not exists evidence_storage_path text default '';
alter table public.hr_requests add column if not exists evidence_content_type text default '';
alter table public.hr_requests add column if not exists evidence_size bigint not null default 0;

create table if not exists public.payroll (
  id text primary key,
  period text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  employee_name text not null,
  owner_email text not null,
  position text default '',
  base_salary numeric not null default 0,
  bonus numeric not null default 0,
  deductions numeric not null default 0,
  net_pay numeric not null default 0,
  status text not null default 'Borrador' check (status in ('Borrador', 'Listo para pago', 'Pendiente pago', 'Pagado')),
  payment_date date,
  payment_reference text default '',
  notes text default '',
  paid_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.payroll add column if not exists payment_date date;
alter table public.payroll add column if not exists payment_reference text default '';
alter table public.payroll add column if not exists notes text default '';
alter table public.payroll add column if not exists paid_at timestamptz;

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

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_uid uuid references auth.users(id) on delete cascade,
  owner_email text,
  title text not null,
  message text not null,
  severity text default 'warning',
  link text default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.documents enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_state enable row level security;
alter table public.biometric_profiles enable row level security;
alter table public.hr_requests enable row level security;
alter table public.payroll enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    case when lower(new.email) = 'cramirez@mossaspa.cl' then 'admin' else 'employee' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop policy if exists "profiles_read_own_or_admin" on public.profiles;
create policy "profiles_read_own_or_admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (display_name, bio, updated_at) on public.profiles to authenticated;

drop policy if exists "employees_admin_all" on public.employees;
create policy "employees_admin_all" on public.employees
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "employees_read_own" on public.employees;
create policy "employees_read_own" on public.employees
for select to authenticated
using (lower(email) = lower((select email from auth.users where id = auth.uid())));

drop policy if exists "documents_admin_all" on public.documents;
create policy "documents_admin_all" on public.documents
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "documents_read_own" on public.documents;
create policy "documents_read_own" on public.documents
for select to authenticated
using (lower(owner_email) = lower((select email from auth.users where id = auth.uid())));

drop policy if exists "attendance_admin_all" on public.attendance;
create policy "attendance_admin_all" on public.attendance
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "attendance_read_own" on public.attendance;
create policy "attendance_read_own" on public.attendance
for select to authenticated
using (user_uid = auth.uid() or lower(owner_email) = lower((select email from auth.users where id = auth.uid())));

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
using (lower(owner_email) = lower((select email from auth.users where id = auth.uid())));

drop policy if exists "requests_insert_own" on public.hr_requests;
create policy "requests_insert_own" on public.hr_requests
for insert to authenticated
with check (public.is_admin() or lower(owner_email) = lower((select email from auth.users where id = auth.uid())));

drop policy if exists "payroll_admin_all" on public.payroll;
create policy "payroll_admin_all" on public.payroll
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "payroll_read_own" on public.payroll;
create policy "payroll_read_own" on public.payroll
for select to authenticated
using (lower(owner_email) = lower((select email from auth.users where id = auth.uid())));

drop policy if exists "notifications_read_own_or_admin" on public.notifications;
create policy "notifications_read_own_or_admin" on public.notifications
for select to authenticated
using (public.is_admin() or recipient_uid = auth.uid() or lower(owner_email) = lower((select email from auth.users where id = auth.uid())));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update to authenticated
using (recipient_uid = auth.uid())
with check (recipient_uid = auth.uid());

revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'employees',
    'documents',
    'attendance',
    'attendance_state',
    'biometric_profiles',
    'hr_requests',
    'payroll',
    'notifications'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;
