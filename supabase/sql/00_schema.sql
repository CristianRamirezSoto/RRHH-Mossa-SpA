-- Esquema base para RRHH Mossaspa usando Supabase Auth + Postgres.
-- Ejecutar en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text default '',
  bio text default '',
  avatar_storage_path text default '',
  avatar_file_name text default '',
  avatar_updated_at timestamptz,
  role text not null default 'employee' check (role in ('admin', 'employee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_storage_path text default '';
alter table public.profiles add column if not exists avatar_file_name text default '';
alter table public.profiles add column if not exists avatar_updated_at timestamptz;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text default '',
  personal_email text default '',
  address text default '',
  commune text default '',
  rut text default '',
  position text default '',
  area text default '',
  employee_code text default '',
  contract_type text default 'Indefinido',
  work_location text default '',
  schedule_end text default '18:00',
  weekly_hours numeric not null default 44,
  is_supervisor boolean not null default false,
  supervisor_id uuid references public.employees(id) on delete set null,
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
alter table public.employees add column if not exists is_supervisor boolean not null default false;
alter table public.employees add column if not exists supervisor_id uuid references public.employees(id) on delete set null;
alter table public.employees add column if not exists supervisor text default '';
alter table public.employees add column if not exists supervisor_whatsapp text default '';
alter table public.employees add column if not exists personal_email text default '';
alter table public.employees add column if not exists address text default '';
alter table public.employees add column if not exists commune text default '';
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
  notification_state text default 'pending',
  visible_to_worker boolean not null default true
);

alter table public.documents add column if not exists visible_to_worker boolean not null default true;

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
  type text not null check (type in (
    'Vacaciones',
    'Permiso',
    'Licencia',
    'Horas extra',
    'Ausencia',
    'Certificado laboral',
    'Regularización documental',
    'Actualización de datos',
    'Corrección de ficha laboral',
    'Consulta de remuneración'
  )),
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
  requested_changes jsonb not null default '{}'::jsonb,
  supervisor_id uuid references public.employees(id) on delete set null,
  supervisor_name text default '',
  supervisor_status text not null default 'No aplica' check (supervisor_status in ('No aplica', 'Pendiente', 'Aprobada', 'Rechazada')),
  supervisor_comment text default '',
  supervisor_reviewed_at timestamptz,
  supervisor_reviewed_by uuid references auth.users(id) on delete set null,
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
alter table public.hr_requests add column if not exists requested_changes jsonb not null default '{}'::jsonb;
alter table public.hr_requests add column if not exists supervisor_id uuid references public.employees(id) on delete set null;
alter table public.hr_requests add column if not exists supervisor_name text default '';
alter table public.hr_requests add column if not exists supervisor_status text not null default 'No aplica';
alter table public.hr_requests add column if not exists supervisor_comment text default '';
alter table public.hr_requests add column if not exists supervisor_reviewed_at timestamptz;
alter table public.hr_requests add column if not exists supervisor_reviewed_by uuid references auth.users(id) on delete set null;

create table if not exists public.payroll (
  id text primary key,
  period text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  employee_name text not null,
  owner_email text not null,
  position text default '',
  base_salary numeric not null default 0,
  bonus numeric not null default 0,
  advance numeric not null default 0,
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
alter table public.payroll add column if not exists advance numeric not null default 0;

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

create table if not exists public.employee_change_log (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  actor_uid uuid references auth.users(id) on delete set null,
  source text not null default 'system' check (source in ('admin', 'self_service', 'system')),
  changed_fields text[] not null default array[]::text[],
  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists employee_change_log_employee_date_idx
  on public.employee_change_log (employee_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.documents enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_state enable row level security;
alter table public.biometric_profiles enable row level security;
alter table public.hr_requests enable row level security;
alter table public.payroll enable row level security;
alter table public.notifications enable row level security;
alter table public.employee_change_log enable row level security;

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
grant update (display_name, bio, avatar_storage_path, avatar_file_name, avatar_updated_at, updated_at) on public.profiles to authenticated;

drop policy if exists "employees_admin_all" on public.employees;
create policy "employees_admin_all" on public.employees
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "employees_read_own" on public.employees;
create policy "employees_read_own" on public.employees
for select to authenticated
using (lower(email) = lower((select email from auth.users where id = auth.uid())));

drop policy if exists "employee_change_log_read_admin_or_own" on public.employee_change_log;
create policy "employee_change_log_read_admin_or_own" on public.employee_change_log
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.employees employee
    where employee.id = employee_change_log.employee_id
      and (
        employee.user_uid = auth.uid()
        or lower(employee.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

revoke all on public.employee_change_log from anon;
revoke insert, update, delete on public.employee_change_log from authenticated;
grant select on public.employee_change_log to authenticated;

create or replace function public.audit_employee_record_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  before_snapshot jsonb;
  after_snapshot jsonb;
  fields_changed text[];
  change_source text;
begin
  before_snapshot := jsonb_build_object(
    'name', old.name, 'email', old.email, 'phone', old.phone,
    'personalEmail', old.personal_email, 'rut', old.rut,
    'position', old.position, 'area', old.area,
    'isSupervisor', old.is_supervisor, 'supervisorId', old.supervisor_id,
    'supervisor', old.supervisor, 'workLocation', old.work_location,
    'contractType', old.contract_type, 'startDate', old.start_date,
    'contractDate', old.contract_date, 'scheduleStart', old.schedule_start,
    'scheduleEnd', old.schedule_end, 'weeklyHours', old.weekly_hours,
    'baseSalary', old.base_salary, 'address', old.address,
    'commune', old.commune, 'emergencyContact', old.emergency_contact,
    'emergencyPhone', old.emergency_phone,
    'biometricConsent', old.biometric_consent, 'status', old.status
  );

  after_snapshot := jsonb_build_object(
    'name', new.name, 'email', new.email, 'phone', new.phone,
    'personalEmail', new.personal_email, 'rut', new.rut,
    'position', new.position, 'area', new.area,
    'isSupervisor', new.is_supervisor, 'supervisorId', new.supervisor_id,
    'supervisor', new.supervisor, 'workLocation', new.work_location,
    'contractType', new.contract_type, 'startDate', new.start_date,
    'contractDate', new.contract_date, 'scheduleStart', new.schedule_start,
    'scheduleEnd', new.schedule_end, 'weeklyHours', new.weekly_hours,
    'baseSalary', new.base_salary, 'address', new.address,
    'commune', new.commune, 'emergencyContact', new.emergency_contact,
    'emergencyPhone', new.emergency_phone,
    'biometricConsent', new.biometric_consent, 'status', new.status
  );

  select coalesce(array_agg(field_name order by field_name), array[]::text[])
  into fields_changed
  from jsonb_object_keys(before_snapshot) fields(field_name)
  where before_snapshot -> field_name is distinct from after_snapshot -> field_name;

  if cardinality(fields_changed) = 0 then
    return new;
  end if;

  change_source := case
    when auth.uid() is null then 'system'
    when public.is_admin() then 'admin'
    else 'self_service'
  end;

  insert into public.employee_change_log (
    employee_id, actor_uid, source, changed_fields, before_values, after_values
  )
  values (
    new.id, auth.uid(), change_source, fields_changed, before_snapshot, after_snapshot
  );

  return new;
end;
$$;

drop trigger if exists audit_employee_record_change on public.employees;
create trigger audit_employee_record_change
after update on public.employees
for each row execute function public.audit_employee_record_change();

create or replace function public.update_own_employee_contact(
  p_phone text default null,
  p_personal_email text default null,
  p_address text default null,
  p_commune text default null,
  p_emergency_contact text default null,
  p_emergency_phone text default null
)
returns public.employees
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  employee_row public.employees;
  normalized_personal_email text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para actualizar tus datos'
      using errcode = '42501';
  end if;

  select *
  into employee_row
  from public.employees employee
  where employee.user_uid = auth.uid()
     or lower(employee.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by case when employee.user_uid = auth.uid() then 0 else 1 end
  limit 1
  for update;

  if not found then
    raise exception 'No existe una ficha laboral vinculada a tu cuenta'
      using errcode = 'P0002';
  end if;

  normalized_personal_email := lower(trim(coalesce(p_personal_email, employee_row.personal_email, '')));

  if normalized_personal_email <> ''
     and normalized_personal_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'El correo personal no tiene un formato válido'
      using errcode = '22023';
  end if;

  update public.employees
  set
    phone = case when p_phone is null then phone else left(trim(p_phone), 40) end,
    personal_email = case when p_personal_email is null then personal_email else left(normalized_personal_email, 160) end,
    address = case when p_address is null then address else left(trim(p_address), 240) end,
    commune = case when p_commune is null then commune else left(trim(p_commune), 100) end,
    emergency_contact = case when p_emergency_contact is null then emergency_contact else left(trim(p_emergency_contact), 100) end,
    emergency_phone = case when p_emergency_phone is null then emergency_phone else left(trim(p_emergency_phone), 40) end,
    updated_at = now()
  where id = employee_row.id
  returning * into employee_row;

  return employee_row;
end;
$$;

revoke all on function public.update_own_employee_contact(text, text, text, text, text, text) from public;
grant execute on function public.update_own_employee_contact(text, text, text, text, text, text) to authenticated;

drop policy if exists "documents_admin_all" on public.documents;
create policy "documents_admin_all" on public.documents
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "documents_read_own" on public.documents;
create policy "documents_read_own" on public.documents
for select to authenticated
using (
  visible_to_worker = true
  and lower(owner_email) = lower((select email from auth.users where id = auth.uid()))
);

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

drop policy if exists "requests_supervisor_read_team" on public.hr_requests;
create policy "requests_supervisor_read_team" on public.hr_requests
for select to authenticated
using (
  supervisor_id is not null
  and exists (
    select 1
    from public.employees reviewer
    where reviewer.id = hr_requests.supervisor_id
      and lower(reviewer.email) = lower((select email from auth.users where id = auth.uid()))
      and reviewer.status <> 'Inactivo'
  )
);

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
using (
  status in ('Pendiente pago', 'Pagado')
  and lower(owner_email) = lower((select email from auth.users where id = auth.uid()))
);

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
    'notifications',
    'employee_change_log'
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
