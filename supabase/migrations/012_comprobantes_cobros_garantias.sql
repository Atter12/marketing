-- ═══════════════════════════════════════════════════════════════
-- Comprobantes: columnas en cobros/garantias + bucket storage
-- Cobros: comprobantes de pago (imágenes/PDF). Garantías: imágenes correspondientes.
-- Rutas: comprobantes/cobros/{cobro_id}/{filename}, comprobantes/garantias/{garantia_id}/{filename}
-- Ejecutar después de 011_storage_avatars.sql
-- ═══════════════════════════════════════════════════════════════

-- Columnas: guardamos rutas en storage (bucket privado; URLs firmadas en el cliente)
alter table public.cobros add column if not exists comprobante_urls jsonb not null default '[]';
comment on column public.cobros.comprobante_urls is 'Rutas en bucket comprobantes (ej. ["cobros/<id>/archivo.jpg"]); se usan para generar signed URLs';

alter table public.garantias add column if not exists imagen_urls jsonb not null default '[]';
comment on column public.garantias.imagen_urls is 'Rutas en bucket comprobantes (ej. ["garantias/<id>/archivo.jpg"]); se usan para generar signed URLs';

-- Funciones para RLS de storage: quién puede ver archivos de un cobro o una garantía
create or replace function public.comprobante_cobro_visible(p_cobro_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_gerente()
    or exists (
      select 1 from public.cobros c
      join public.gastos g on g.id = c.gasto_id
      where c.id = p_cobro_id and g.client_id = public.my_client_id()
    );
$$;

create or replace function public.comprobante_garantia_visible(p_garantia_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_gerente()
    or exists (select 1 from public.garantias where id = p_garantia_id and client_id = public.my_client_id());
$$;

-- Path visible: primer segmento = cobros | garantias, segundo = uuid
create or replace function public.comprobante_path_visible(bucket_id text, obj_name text)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare
  parts text[];
  seg1 text;
  seg2 uuid;
begin
  if bucket_id is null or bucket_id <> 'comprobantes' or obj_name is null then
    return false;
  end if;
  parts := string_to_array(trim(both '/' from obj_name), '/');
  if array_length(parts, 1) < 2 then
    return false;
  end if;
  seg1 := parts[1];
  begin
    seg2 := parts[2]::uuid;
  exception when others then
    return false;
  end;
  if seg1 = 'cobros' then
    return public.comprobante_cobro_visible(seg2);
  elsif seg1 = 'garantias' then
    return public.comprobante_garantia_visible(seg2);
  end if;
  return false;
end;
$$;

-- Bucket privado (lectura vía RLS; el cliente usará signed URLs o requests autenticados)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS storage.objects: SELECT (lectura)
drop policy if exists "Comprobantes select" on storage.objects;
create policy "Comprobantes select" on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (public.is_gerente() or public.comprobante_path_visible(bucket_id, name))
  );

-- INSERT
drop policy if exists "Comprobantes insert" on storage.objects;
create policy "Comprobantes insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (public.is_gerente() or public.comprobante_path_visible(bucket_id, name))
  );

-- UPDATE
drop policy if exists "Comprobantes update" on storage.objects;
create policy "Comprobantes update" on storage.objects for update to authenticated
  using (
    bucket_id = 'comprobantes'
    and (public.is_gerente() or public.comprobante_path_visible(bucket_id, name))
  )
  with check (
    bucket_id = 'comprobantes'
    and (public.is_gerente() or public.comprobante_path_visible(bucket_id, name))
  );

-- DELETE
drop policy if exists "Comprobantes delete" on storage.objects;
create policy "Comprobantes delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'comprobantes'
    and (public.is_gerente() or public.comprobante_path_visible(bucket_id, name))
  );
