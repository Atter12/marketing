-- URL tienda (Shopify / web) en Pendientes.
alter table public.tareas_clientes
  add column if not exists url_tienda text;

comment on column public.tareas_clientes.url_tienda is
  'URL pública de la tienda (ej. Shopify). Guardar con https://';
