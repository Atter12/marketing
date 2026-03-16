-- Salida (checkout) para cálculo de horas trabajadas
alter table public.tareas_equipo
  add column if not exists checkout_at timestamptz;

comment on column public.tareas_equipo.checkout_at is 'Hora de salida del día (para calcular horas trabajadas)';
