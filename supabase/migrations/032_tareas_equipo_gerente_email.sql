-- Enlaza filas de tareas_equipo con gerentes.email para mostrar rol real (p. ej. Administrador).
alter table public.tareas_equipo add column if not exists gerente_email text;

comment on column public.tareas_equipo.gerente_email is 'Correo del gerente (misma clave que gerentes.email); usado en Tareas para rol en carga de trabajo / equipo.';

create index if not exists idx_tareas_equipo_gerente_email_lower on public.tareas_equipo (lower(trim(gerente_email)));
