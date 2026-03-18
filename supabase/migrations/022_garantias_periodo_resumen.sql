-- Mes en que la garantía cuenta en el resumen del cliente (análogo a cobros.periodo_resumen).
alter table public.garantias add column if not exists periodo_resumen text;

comment on column public.garantias.periodo_resumen is 'YYYY-MM: mes en que aparece en resumen/filtrado; si null, se deriva de gasto_id, fecha_colocacion o created_at';

-- Backfill: gasto → fecha colocación → mes de alta
update public.garantias g
set periodo_resumen = coalesce(
  (select g2.mes from public.gastos g2 where g2.id = g.gasto_id limit 1),
  case when g.fecha_colocacion is not null then to_char(g.fecha_colocacion::date, 'YYYY-MM') end,
  to_char(coalesce(g.created_at, now()) at time zone 'UTC', 'YYYY-MM')
)
where g.periodo_resumen is null or trim(g.periodo_resumen) = '';
