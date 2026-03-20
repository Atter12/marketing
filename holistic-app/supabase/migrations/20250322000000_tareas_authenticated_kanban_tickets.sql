-- Ver supabase/migrations/025_tareas_authenticated_kanban_tickets.sql (mismo contenido).

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
