-- Asignación de tickets por correo de gerente (tabla gerentes), sin depender de tareas_equipo.
-- La UI guarda el email en asignado_email y deja asignado_id en null para tickets nuevos.

alter table public.tareas_tickets add column if not exists asignado_email text;

comment on column public.tareas_tickets.asignado_email is 'Email del gerente asignado (coincide con gerentes.email).';
