-- ═══════════════════════════════════════════════════════════════
-- Storage: bucket para fotos de perfil de clientes (subida desde archivos)
-- Rutas: avatars/{client_id}/avatar (una imagen por cliente)
-- Ejecutar después de 010_clientes_avatar_url.sql
--
-- Si el INSERT al bucket falla, crea el bucket en Dashboard:
-- Storage → New bucket → Name/ID = avatars, Public = true,
-- File size limit = 5 MB, Allowed MIME types = image/jpeg, image/png, image/webp, image/gif.
-- Luego ejecuta solo las políticas (desde "RLS en storage.objects").
-- ═══════════════════════════════════════════════════════════════

-- Crear bucket público (lectura para mostrar fotos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS en storage.objects: gerente puede todo; cliente solo su carpeta (client_id = primer segmento del path)
-- SELECT: cualquiera puede leer (bucket público)
drop policy if exists "Avatar public read" on storage.objects;
create policy "Avatar public read" on storage.objects for select
  using (bucket_id = 'avatars');

-- INSERT: gerente o cliente subiendo solo en su carpeta {client_id}/...
drop policy if exists "Avatar insert" on storage.objects;
create policy "Avatar insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      public.is_gerente()
      or (storage.foldername(name))[1] = (public.my_client_id())::text
    )
  );

-- UPDATE: mismo criterio (sobrescribir foto)
drop policy if exists "Avatar update" on storage.objects;
create policy "Avatar update" on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (
      public.is_gerente()
      or (storage.foldername(name))[1] = (public.my_client_id())::text
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      public.is_gerente()
      or (storage.foldername(name))[1] = (public.my_client_id())::text
    )
  );

-- DELETE: mismo criterio
drop policy if exists "Avatar delete" on storage.objects;
create policy "Avatar delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (
      public.is_gerente()
      or (storage.foldername(name))[1] = (public.my_client_id())::text
    )
  );
