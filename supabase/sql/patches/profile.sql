-- Parche para fotos de perfil.
-- Ejecutar en Supabase > SQL Editor.

alter table public.profiles add column if not exists avatar_storage_path text default '';
alter table public.profiles add column if not exists avatar_file_name text default '';
alter table public.profiles add column if not exists avatar_updated_at timestamptz;

grant update (
  display_name,
  bio,
  avatar_storage_path,
  avatar_file_name,
  avatar_updated_at,
  updated_at
) on public.profiles to authenticated;

select
  id,
  email,
  display_name,
  avatar_storage_path,
  avatar_file_name,
  avatar_updated_at
from public.profiles
order by updated_at desc
limit 10;
