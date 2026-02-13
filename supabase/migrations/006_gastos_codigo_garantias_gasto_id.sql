-- Código de gasto + garantía opcionalmente vinculada a un gasto
-- Ejecutar después de 005_cobros_hora_created_by.sql

-- Gastos: código único (ej. G-A1B2C3D4)
alter table public.gastos add column if not exists codigo text;
update public.gastos set codigo = 'G-' || upper(substr(replace(id::text, '-', ''), 1, 12)) where codigo is null or codigo = '';
create unique index if not exists idx_gastos_codigo on public.gastos(codigo) where codigo is not null and codigo != '';

-- Garantías: opcionalmente vinculadas a un gasto
alter table public.garantias add column if not exists gasto_id uuid references public.gastos(id) on delete set null;
create index if not exists idx_garantias_gasto_id on public.garantias(gasto_id);
