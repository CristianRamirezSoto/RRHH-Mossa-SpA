alter table public.employees
  add column if not exists supervisor_id uuid references public.employees(id) on delete set null;

create index if not exists employees_supervisor_id_idx
  on public.employees(supervisor_id);

update public.employees employee
set supervisor_id = (
  select supervisor.id
  from public.employees supervisor
  where lower(trim(supervisor.name)) = lower(trim(employee.supervisor))
    and supervisor.id <> employee.id
  order by supervisor.created_at asc
  limit 1
)
where employee.supervisor_id is null
  and nullif(trim(employee.supervisor), '') is not null;

alter table public.hr_requests
  add column if not exists supervisor_id uuid references public.employees(id) on delete set null,
  add column if not exists supervisor_name text default '',
  add column if not exists supervisor_status text not null default 'No aplica',
  add column if not exists supervisor_comment text default '',
  add column if not exists supervisor_reviewed_at timestamptz,
  add column if not exists supervisor_reviewed_by uuid references auth.users(id) on delete set null;

alter table public.hr_requests
  drop constraint if exists hr_requests_supervisor_status_check;

alter table public.hr_requests
  add constraint hr_requests_supervisor_status_check
  check (supervisor_status in ('No aplica', 'Pendiente', 'Aprobada', 'Rechazada'));

create index if not exists hr_requests_supervisor_id_idx
  on public.hr_requests(supervisor_id, supervisor_status, created_at desc);

drop policy if exists "requests_supervisor_read_team" on public.hr_requests;
create policy "requests_supervisor_read_team"
on public.hr_requests
for select
to authenticated
using (
  supervisor_id is not null
  and exists (
    select 1
    from public.employees reviewer
    where reviewer.id = hr_requests.supervisor_id
      and lower(reviewer.email) = lower(coalesce(auth.jwt()->>'email', ''))
      and reviewer.status <> 'Inactivo'
  )
);

create or replace function public.review_team_request(
  p_request_id uuid,
  p_decision text,
  p_comment text default ''
)
returns public.hr_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.hr_requests;
  reviewer_employee_id uuid;
begin
  if p_decision not in ('Aprobada', 'Rechazada') then
    raise exception 'Decisión inválida'
      using errcode = '22023';
  end if;

  select id
  into reviewer_employee_id
  from public.employees
  where lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
    and status <> 'Inactivo'
  limit 1;

  select *
  into request_row
  from public.hr_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada'
      using errcode = 'P0002';
  end if;

  if not public.is_admin()
    and (reviewer_employee_id is null or reviewer_employee_id <> request_row.supervisor_id) then
    raise exception 'No eres el supervisor asignado a esta solicitud'
      using errcode = '42501';
  end if;

  if request_row.status <> 'Pendiente'
    or request_row.supervisor_status <> 'Pendiente' then
    raise exception 'La solicitud ya fue revisada'
      using errcode = '23514';
  end if;

  update public.hr_requests
  set
    supervisor_status = p_decision,
    supervisor_comment = left(trim(coalesce(p_comment, '')), 360),
    supervisor_reviewed_at = now(),
    supervisor_reviewed_by = auth.uid(),
    status = case when p_decision = 'Rechazada' then 'Rechazada' else status end,
    resolution_comment = case
      when p_decision = 'Rechazada' then left(trim(coalesce(p_comment, '')), 360)
      else resolution_comment
    end,
    resolved_at = case when p_decision = 'Rechazada' then now() else resolved_at end,
    reviewed_by = case when p_decision = 'Rechazada' then auth.uid() else reviewed_by end,
    updated_at = now()
  where id = p_request_id
  returning * into request_row;

  return request_row;
end;
$$;

revoke all on function public.review_team_request(uuid, text, text) from public;
grant execute on function public.review_team_request(uuid, text, text) to authenticated;

create or replace function public.enforce_request_approval_chain()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.supervisor_status = 'Pendiente'
    and new.status = 'Aprobada' then
    raise exception 'La solicitud requiere aprobación previa del supervisor'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_request_approval_chain on public.hr_requests;
create trigger enforce_request_approval_chain
before update on public.hr_requests
for each row
execute function public.enforce_request_approval_chain();

notify pgrst, 'reload schema';
