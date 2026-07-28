alter table public.hr_requests
  add column if not exists requested_changes jsonb not null default '{}'::jsonb;

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
    'Consulta de remuneración'
  ));

create or replace function public.resolve_employee_data_update(
  p_request_id uuid,
  p_status text,
  p_comment text default ''
)
returns public.hr_requests
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  request_row public.hr_requests;
  changes jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede resolver esta solicitud'
      using errcode = '42501';
  end if;

  if p_status not in ('Aprobada', 'Rechazada') then
    raise exception 'Estado de resolución inválido'
      using errcode = '22023';
  end if;

  select *
  into request_row
  from public.hr_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada'
      using errcode = 'P0002';
  end if;

  if request_row.type <> 'Actualización de datos' then
    raise exception 'La solicitud no corresponde a una actualización de datos'
      using errcode = '22023';
  end if;

  if request_row.status <> 'Pendiente' then
    raise exception 'La solicitud ya fue resuelta'
      using errcode = '23514';
  end if;

  changes := coalesce(request_row.requested_changes, '{}'::jsonb);

  if p_status = 'Aprobada' then
    if changes = '{}'::jsonb then
      raise exception 'La solicitud no contiene cambios'
        using errcode = '23514';
    end if;

    update public.employees
    set
      phone = case
        when changes ? 'phone' then left(trim(changes->>'phone'), 40)
        else phone
      end,
      emergency_contact = case
        when changes ? 'emergencyContact' then left(trim(changes->>'emergencyContact'), 100)
        else emergency_contact
      end,
      emergency_phone = case
        when changes ? 'emergencyPhone' then left(trim(changes->>'emergencyPhone'), 40)
        else emergency_phone
      end,
      updated_at = now()
    where id = request_row.employee_id;

    if not found then
      raise exception 'Ficha laboral no encontrada'
        using errcode = 'P0002';
    end if;
  end if;

  update public.hr_requests
  set
    status = p_status,
    resolution_comment = left(coalesce(p_comment, ''), 360),
    resolved_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = p_request_id
  returning * into request_row;

  return request_row;
end;
$$;

grant execute on function public.resolve_employee_data_update(uuid, text, text) to authenticated;
