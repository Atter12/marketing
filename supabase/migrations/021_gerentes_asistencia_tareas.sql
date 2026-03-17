-- ═══════════════════════════════════════════════════════════════
-- Asistencia en Tareas: miembros = gerentes (Crédito).
-- checkin/checkout + datos de actividad para verificación.
-- ═══════════════════════════════════════════════════════════════

-- 1. Columnas de asistencia
alter table public.gerentes
  add column if not exists checkin_at  timestamptz,
  add column if not exists checkout_at timestamptz;

-- 2. Columnas de verificación anti-fraude
alter table public.gerentes
  add column if not exists att_active_seconds int default 0,
  add column if not exists att_trust         text default null,
  add column if not exists att_ip            text,
  add column if not exists att_device        text,
  add column if not exists att_last_heartbeat timestamptz;

-- Constraint para valores válidos de att_trust
do $$ begin
  alter table public.gerentes add constraint gerentes_att_trust_chk
    check (att_trust is null or att_trust in ('high','medium','low'));
exception when duplicate_object then null;
end $$;

-- 3. Policies: gerentes pueden listar TODOS los gerentes y actualizar asistencia
drop policy if exists "Gerente list all gerentes"      on public.gerentes;
drop policy if exists "Gerente update gerentes asistencia" on public.gerentes;

create policy "Gerente list all gerentes"
  on public.gerentes for select
  using (public.is_gerente());

create policy "Gerente update gerentes asistencia"
  on public.gerentes for update
  using (public.is_gerente())
  with check (public.is_gerente());
