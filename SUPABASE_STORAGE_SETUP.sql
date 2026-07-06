-- Configuracion minima para usar Supabase Storage en Expediente Digital.
-- Ejecutar en Supabase > SQL Editor > New query > Run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-documents',
  'employee-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "employee_documents_anon_read" on storage.objects;
drop policy if exists "employee_documents_anon_upload" on storage.objects;
drop policy if exists "employee_documents_anon_delete" on storage.objects;
drop policy if exists "employee_documents_auth_read" on storage.objects;
drop policy if exists "employee_documents_auth_upload" on storage.objects;
drop policy if exists "employee_documents_auth_delete" on storage.objects;

create policy "employee_documents_auth_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'employee-documents');

create policy "employee_documents_auth_upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'employee-documents');

create policy "employee_documents_auth_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'employee-documents');
