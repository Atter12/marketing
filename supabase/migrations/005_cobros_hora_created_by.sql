-- ═══════════════════════════════════════════════════════════════
-- Cobros: hora del cobro + quién lo registró (email del gerente)
-- Ejecutar después de 003_schema_clientes_gastos_cobros.sql
-- ═══════════════════════════════════════════════════════════════

alter table public.cobros
  add column if not exists created_by text,
  add column if not exists hora time;

comment on column public.cobros.created_by is 'Email del usuario (gerente) que registró el cobro';
comment on column public.cobros.hora is 'Hora del cobro (opcional)';
