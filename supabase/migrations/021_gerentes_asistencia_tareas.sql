-- Asistencia en Tareas: miembros = gerentes (Crédito). checkin/checkout en gerentes.
-- Los gerentes pueden listar todos los gerentes y actualizar checkin_at/checkout_at.

alter table public.gerentes
  add column if not exists checkin_at timestamptz,
  add column if not exists checkout_at timestamptz;

comment on column public.gerentes.checkin_at is 'Última entrada registrada (asistencia Tareas)';
comment on column public.gerentes.checkout_at is 'Última salida registrada (asistencia Tareas)';

-- Gerentes pueden ver la lista completa de gerentes (para la vista Asistencia en Tareas)
create policy "Gerente list all gerentes"
  on public.gerentes for select
  using (public.is_gerente());

-- Gerentes pueden actualizar checkin_at/checkout_at de cualquier gerente (registro de entrada/salida)
create policy "Gerente update gerentes asistencia"
  on public.gerentes for update
  using (public.is_gerente())
  with check (public.is_gerente());
