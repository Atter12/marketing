-- ============================================================
-- Consultas para ver los clics exactos en Supabase
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1) Total de clics por slug (todos los links)
SELECT slug, COUNT(*) AS total_clics
FROM public.link_clicks
GROUP BY slug
ORDER BY total_clics DESC;

-- 2) Para UN slug concreto (cambia 'mi-link' por el tuyo): total y desglose por enlace
SELECT
  slug,
  link_index,
  COUNT(*) AS clics
FROM public.link_clicks
WHERE slug = 'mi-link'
GROUP BY slug, link_index
ORDER BY link_index;

-- 3) Total global de clics (toda la tabla)
SELECT COUNT(*) AS total_clics_global FROM public.link_clicks;

-- 4) Función para que el panel obtenga total y desglose exactos (sin límite de filas)
-- Ejecutar UNA VEZ para crear la función; luego el panel puede llamarla.
create or replace function public.get_link_stats(p_slug text)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total', (select count(*)::int from link_clicks where slug = p_slug),
    'by_index', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from (
        select link_index, count(*)::int as clics
        from link_clicks
        where slug = p_slug
        group by link_index
        order by link_index
      ) t
    )
  );
$$;

-- Dar permiso a anon para llamar la función
grant execute on function public.get_link_stats(text) to anon;
grant execute on function public.get_link_stats(text) to authenticated;
