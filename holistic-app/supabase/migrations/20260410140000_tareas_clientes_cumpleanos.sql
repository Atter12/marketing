-- Fecha de cumpleaños (persona de contacto / titular) en clientes de Pendientes.
alter table public.tareas_clientes
  add column if not exists cumpleanos date;

comment on column public.tareas_clientes.cumpleanos is 'Fecha de nacimiento (opcional), editable desde Pendientes.';
