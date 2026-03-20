-- ═══════════════════════════════════════════════════════════════
-- Tareas tickets + comentarios: política para rol anon (clave anon)
-- La app Tareas suele usar __SUPABASE_ANON_KEY__ sin sesión JWT.
-- 017 ya permite tareas_kanban a anon; los tickets solo tenían
-- "Gerente all" → is_gerente() false → DELETE devolvía 0 filas sin error.
-- Esta migración alinea tickets/comentarios con el mismo modelo que kanban.
-- ═══════════════════════════════════════════════════════════════

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
