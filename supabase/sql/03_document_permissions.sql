-- Permisos definitivos para documentos y Storage.
-- Ejecutar después de 02_employee_portal.sql.
--
-- Administrador:
--   - puede subir, descargar, ocultar y eliminar documentos.
-- Trabajador:
--   - solo puede consultar y descargar sus documentos visibles;
--   - puede gestionar únicamente su propia foto de perfil.

alter table public.documents
  add column if not exists visible_to_worker boolean not null default true;

alter table public.payroll
  add column if not exists receipt_storage_path text default '';

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
  and lower(owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
);

drop policy if exists "employee_documents_anon_read" on storage.objects;
drop policy if exists "employee_documents_anon_upload" on storage.objects;
drop policy if exists "employee_documents_anon_delete" on storage.objects;
drop policy if exists "employee_documents_auth_read" on storage.objects;
drop policy if exists "employee_documents_auth_upload" on storage.objects;
drop policy if exists "employee_documents_auth_delete" on storage.objects;
drop policy if exists "employee_documents_auth_update" on storage.objects;

create policy "employee_documents_auth_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'employee-documents'
  and (
    public.is_admin()
    or name like ('profiles/' || auth.uid()::text || '/avatar/%')
    or exists (
      select 1
      from public.documents d
      where d.storage_path = name
        and d.visible_to_worker = true
        and lower(d.owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
    or exists (
      select 1
      from public.payroll p
      where p.receipt_storage_path = name
        and p.status in ('Pendiente pago', 'Pagado')
        and lower(p.owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
    or exists (
      select 1
      from public.hr_requests r
      where r.evidence_storage_path = name
        and lower(r.owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  )
);

create policy "employee_documents_auth_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'employee-documents'
  and (
    public.is_admin()
    or name like ('profiles/' || auth.uid()::text || '/avatar/%')
  )
);

create policy "employee_documents_auth_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'employee-documents'
  and (
    public.is_admin()
    or name like ('profiles/' || auth.uid()::text || '/avatar/%')
  )
);

create policy "employee_documents_auth_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'employee-documents'
  and (
    public.is_admin()
    or name like ('profiles/' || auth.uid()::text || '/avatar/%')
  )
)
with check (
  bucket_id = 'employee-documents'
  and (
    public.is_admin()
    or name like ('profiles/' || auth.uid()::text || '/avatar/%')
  )
);

notify pgrst, 'reload schema';
