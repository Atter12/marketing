-- Imágenes de referencia al crear un entregable (mismo formato que adjuntos en tickets: [{path, file_name}]).
alter table public.tareas_kanban
  add column if not exists adjuntos_referencia jsonb default '[]'::jsonb;

comment on column public.tareas_kanban.adjuntos_referencia is 'Adjuntos en bucket tareas_adjuntos; JSON [{path, file_name}] para ver el problema o referencia visual.';
