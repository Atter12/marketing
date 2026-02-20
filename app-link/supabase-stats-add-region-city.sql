-- Añadir provincia/región y ciudad a estadísticas de clics
-- Ejecutar en Supabase → SQL Editor (una vez)

alter table public.link_clicks
  add column if not exists region text,
  add column if not exists city text;

comment on column public.link_clicks.region is 'Región / provincia / estado (ipapi.co)';
comment on column public.link_clicks.city is 'Ciudad / distrito (ipapi.co)';
