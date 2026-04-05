-- Ver supabase/migrations/041_tareas_calendario_descripcion_responsables.sql

alter table public.tareas_calendario add column if not exists descripcion text;
alter table public.tareas_calendario add column if not exists responsables_emails jsonb default '[]'::jsonb;

comment on column public.tareas_calendario.descripcion is 'Qué es el evento (tareas internas, no reuniones con clientes).';
comment on column public.tareas_calendario.responsables_emails is 'Correos de gerentes asignados al evento (misma convención que tickets).';
