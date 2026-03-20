-- Bucket avatars: asegurar público y lectura con rol anon (listados / Tareas sin JWT gerente).
-- tareas_clientes.avatar_url: copia de respaldo de la foto de Crédito (clientes.avatar_url).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar anon read" on storage.objects;
create policy "Avatar anon read" on storage.objects
  for select to anon
  using (bucket_id = 'avatars');

alter table public.tareas_clientes add column if not exists avatar_url text;
comment on column public.tareas_clientes.avatar_url is 'URL pública de foto (sincronizada con clientes.avatar_url si hay credito_client_id).';

update public.tareas_clientes tc
set avatar_url = nullif(btrim(c.avatar_url), '')
from public.clientes c
where tc.credito_client_id = c.id
  and c.avatar_url is not null
  and btrim(c.avatar_url) <> ''
  and (tc.avatar_url is null or btrim(tc.avatar_url) = '');
