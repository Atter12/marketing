-- Gastos: quién registró el gasto (email del gerente)
-- Ejecutar después de 006_gastos_codigo_garantias_gasto_id.sql

alter table public.gastos add column if not exists created_by text;
comment on column public.gastos.created_by is 'Email del usuario (gerente) que registró el gasto';
