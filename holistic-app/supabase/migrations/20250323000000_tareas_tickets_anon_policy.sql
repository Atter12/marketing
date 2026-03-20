-- Ver supabase/migrations/026_tareas_tickets_anon_policy.sql

drop policy if exists "Anon all tareas_tickets" on public.tareas_tickets;
create policy "Anon all tareas_tickets"
  on public.tareas_tickets for all
  to anon
  using (true)
  with check (true);

drop policy if exists "Anon all tareas_ticket_comentarios" on public.tareas_ticket_comentarios;
create policy "Anon all tareas_ticket_comentarios"
  on public.tareas_ticket_comentarios for all
  to anon
  using (true)
  with check (true);
