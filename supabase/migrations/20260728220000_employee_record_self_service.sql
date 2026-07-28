-- Separa la ficha laboral administrativa del autoservicio personal.
-- El trabajador mantiene sus datos de contacto y cada cambio queda auditado.

alter table public.employees
  add column if not exists personal_email text default '',
  add column if not exists address text default '',
  add column if not exists commune text default '';

create table if not exists public.employee_change_log (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  actor_uid uuid references auth.users(id) on delete set null,
  source text not null default 'system'
    check (source in ('admin', 'self_service', 'system')),
  changed_fields text[] not null default array[]::text[],
  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists employee_change_log_employee_date_idx
  on public.employee_change_log (employee_id, created_at desc);

alter table public.employee_change_log enable row level security;

drop policy if exists "employee_change_log_read_admin_or_own" on public.employee_change_log;
create policy "employee_change_log_read_admin_or_own"
on public.employee_change_log
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.employees employee
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
    'name', old.name,
    'email', old.email,
    'phone', old.phone,
    'personalEmail', old.personal_email,
    'rut', old.rut,
    'position', old.position,
    'area', old.area,
    'isSupervisor', old.is_supervisor,
    'supervisorId', old.supervisor_id,
    'supervisor', old.supervisor,
    'workLocation', old.work_location,
    'contractType', old.contract_type,
    'startDate', old.start_date,
    'contractDate', old.contract_date,
    'scheduleStart', old.schedule_start,
    'scheduleEnd', old.schedule_end,
    'weeklyHours', old.weekly_hours,
    'baseSalary', old.base_salary,
    'address', old.address,
    'commune', old.commune,
    'emergencyContact', old.emergency_contact,
    'emergencyPhone', old.emergency_phone,
    'biometricConsent', old.biometric_consent,
    'status', old.status
  );

  after_snapshot := jsonb_build_object(
    'name', new.name,
    'email', new.email,
    'phone', new.phone,
    'personalEmail', new.personal_email,
    'rut', new.rut,
    'position', new.position,
    'area', new.area,
    'isSupervisor', new.is_supervisor,
    'supervisorId', new.supervisor_id,
    'supervisor', new.supervisor,
    'workLocation', new.work_location,
    'contractType', new.contract_type,
    'startDate', new.start_date,
    'contractDate', new.contract_date,
    'scheduleStart', new.schedule_start,
    'scheduleEnd', new.schedule_end,
    'weeklyHours', new.weekly_hours,
    'baseSalary', new.base_salary,
    'address', new.address,
    'commune', new.commune,
    'emergencyContact', new.emergency_contact,
    'emergencyPhone', new.emergency_phone,
    'biometricConsent', new.biometric_consent,
    'status', new.status
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
    employee_id,
    actor_uid,
    source,
    changed_fields,
    before_values,
    after_values
  )
  values (
    new.id,
    auth.uid(),
    change_source,
    fields_changed,
    before_snapshot,
    after_snapshot
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

alter table public.hr_requests
  drop constraint if exists hr_requests_type_check;

alter table public.hr_requests
  add constraint hr_requests_type_check
  check (type in (
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
  ));

do $$
begin
  alter publication supabase_realtime add table public.employee_change_log;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
