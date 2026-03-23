-- Tickets: notas + múltiples asignados. Kanban: notas internas por entregable.

alter table public.tareas_tickets
  add column if not exists notas text,
  add column if not exists asignados_emails jsonb default jsonb_build_array();

comment on column public.tareas_tickets.notas is 'Notas internas del ticket (contexto para el equipo).';
comment on column public.tareas_tickets.asignados_emails is 'Lista de emails asignados al ticket (multi-asignación).';

alter table public.tareas_kanban
  add column if not exists notas text;

comment on column public.tareas_kanban.notas is 'Notas internas del entregable en el tablero.';
