-- ============================================================
-- Rotación global (independiente de IP/dispositivo)
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1) Añadir contador global de rotación por link
alter table public.link_configs
  add column if not exists rotation_counter int not null default 0;

comment on column public.link_configs.rotation_counter is 'Contador global de clics para rotación; mismo para todos los visitantes (no depende de IP ni dispositivo)';

-- 2) Función atómica: incrementa y devuelve el siguiente número de posición para ese slug
create or replace function public.next_rotation_position(p_slug text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  update link_configs
  set rotation_counter = rotation_counter + 1
  where slug = p_slug
  returning rotation_counter into new_count;
  if new_count is null then
    return null;
  end if;
  return new_count - 1;
end;
$$;

grant execute on function public.next_rotation_position(text) to anon;
grant execute on function public.next_rotation_position(text) to authenticated;
