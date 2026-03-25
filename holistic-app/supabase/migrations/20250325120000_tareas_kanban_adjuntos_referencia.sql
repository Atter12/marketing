-- Ver supabase/migrations/039_tareas_kanban_adjuntos_referencia.sql
alter table public.tareas_kanban
  add column if not exists adjuntos_referencia jsonb default '[]'::jsonb;

comment on column public.tareas_kanban.adjuntos_referencia is 'Adjuntos en bucket tareas_adjuntos; JSON [{path, file_name}] para ver el problema o referencia visual.';
