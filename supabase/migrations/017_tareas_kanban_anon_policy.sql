-- ═══════════════════════════════════════════════════════════════
-- Tareas Kanban: política para acceso anon (sin login)
-- Si la app Tareas usa la clave anon y no hay auth de gerente,
-- el RLS "Gerente all tareas_kanban" bloquea SELECT/UPDATE y las
-- filas "desaparecen" al mover (update devuelve 0 rows).
-- Esta política permite a anon leer y escribir tareas_kanban.
-- Aplícala solo si tu app Tareas no usa login de gerente.
-- ═══════════════════════════════════════════════════════════════

drop policy if exists "Anon all tareas_kanban" on public.tareas_kanban;
create policy "Anon all tareas_kanban"
  on public.tareas_kanban for all
  to anon
  using (true)
  with check (true);
