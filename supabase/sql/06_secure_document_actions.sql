-- Operaciones documentales seguras y trazables.
-- Ejecutar después de 05_account_management.sql.

begin;

create table if not exists public.document_audit_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid,
  employee_id uuid,
  employee_name text not null default '',
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  action text not null check (action in ('document.downloaded', 'document.deleted')),
  file_name text not null default '',
  storage_path text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_audit_log_created_at_idx
  on public.document_audit_log (created_at desc);

create index if not exists document_audit_log_employee_idx
  on public.document_audit_log (employee_id, created_at desc);

alter table public.document_audit_log enable row level security;

drop policy if exists "document_audit_admin_read" on public.document_audit_log;
create policy "document_audit_admin_read"
on public.document_audit_log
for select
to authenticated
using (public.is_admin());

revoke all on public.document_audit_log from anon;
revoke all on public.document_audit_log from public;
revoke all on public.document_audit_log from authenticated;
grant select on public.document_audit_log to authenticated;

notify pgrst, 'reload schema';

commit;
