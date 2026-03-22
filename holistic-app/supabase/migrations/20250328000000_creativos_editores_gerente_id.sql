-- Mirror de marketing/supabase/migrations/034_creativos_editores_gerente_id.sql

alter table public.creativos_editores
  add column if not exists gerente_id uuid references public.gerentes (id) on delete set null;

comment on column public.creativos_editores.gerente_id is 'Gerente (asistencia / Tareas) asociado a este editor en Creativos; prioridad sobre coincidencia solo por email.';

create index if not exists idx_creativos_editores_gerente_id
  on public.creativos_editores (gerente_id)
  where gerente_id is not null;

update public.creativos_editores ce
set gerente_id = g.id
from public.gerentes g
where ce.gerente_id is null
  and ce.email is not null
  and length(trim(ce.email)) > 0
  and lower(trim(ce.email)) = lower(trim(g.email));
