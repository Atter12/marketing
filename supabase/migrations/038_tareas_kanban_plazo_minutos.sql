-- Entregables en Tareas: guardar tiempo maximo de cumplimiento en minutos (15..1440 en UI).

alter table public.tareas_kanban
  add column if not exists plazo_minutos int;

comment on column public.tareas_kanban.plazo_minutos is 'Tiempo maximo para completar el entregable, en minutos.';
