-- Bucket para entregables de Creativos (videos/archivos por etapa y versión)
-- Ruta sugerida: {project_id}/{stage}/v{version}_{filename}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creativos_entregables',
  'creativos_entregables',
  false,
  524288000,
  null
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- Solo gerentes pueden subir/actualizar/borrar/leer
drop policy if exists "Gerente insert creativos_entregables" on storage.objects;
create policy "Gerente insert creativos_entregables" on storage.objects for insert to authenticated
  with check (bucket_id = 'creativos_entregables' and public.is_gerente());

drop policy if exists "Gerente update creativos_entregables" on storage.objects;
create policy "Gerente update creativos_entregables" on storage.objects for update to authenticated
  using (bucket_id = 'creativos_entregables' and public.is_gerente());

drop policy if exists "Gerente delete creativos_entregables" on storage.objects;
create policy "Gerente delete creativos_entregables" on storage.objects for delete to authenticated
  using (bucket_id = 'creativos_entregables' and public.is_gerente());

drop policy if exists "Gerente select creativos_entregables" on storage.objects;
create policy "Gerente select creativos_entregables" on storage.objects for select to authenticated
  using (bucket_id = 'creativos_entregables' and public.is_gerente());
