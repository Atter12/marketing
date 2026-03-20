-- ═══════════════════════════════════════════════════════════════
-- Tareas: políticas para rol authenticated (JWT con sesión)
-- Las políticas "Gerente all …" solo pasan si is_gerente() es true.
-- Con la clave anon, 017 permite kanban; los tickets siguen siendo
-- solo gerente salvo que añadas política similar.
-- Si entras con email/password y NO estás en gerentes, DELETE/UPDATE
-- devolvía 0 filas. Estas políticas permiten CRUD a cualquier usuario
-- autenticado en kanban, tickets y comentarios (OR con las existentes).
-- ═══════════════════════════════════════════════════════════════

drop policy if exists "Authenticated all tareas_kanban" on public.tareas_kanban;
create policy "Authenticated all tareas_kanban"
  on public.tareas_kanban for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated all tareas_tickets" on public.tareas_tickets;
create policy "Authenticated all tareas_tickets"
  on public.tareas_tickets for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated all tareas_ticket_comentarios" on public.tareas_ticket_comentarios;
create policy "Authenticated all tareas_ticket_comentarios"
  on public.tareas_ticket_comentarios for all
  to authenticated
  using (true)
  with check (true);
