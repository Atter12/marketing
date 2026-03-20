-- Ver supabase/migrations/027_tareas_tickets_asignado_email.sql

alter table public.tareas_tickets add column if not exists asignado_email text;

comment on column public.tareas_tickets.asignado_email is 'Email del gerente asignado (coincide con gerentes.email).';
