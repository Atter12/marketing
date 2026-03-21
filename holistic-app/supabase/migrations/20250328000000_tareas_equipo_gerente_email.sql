-- Ver supabase/migrations/032_tareas_equipo_gerente_email.sql

alter table public.tareas_equipo add column if not exists gerente_email text;

create index if not exists idx_tareas_equipo_gerente_email_lower on public.tareas_equipo (lower(trim(gerente_email)));
