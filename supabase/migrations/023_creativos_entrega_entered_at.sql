-- Marca cuándo el proyecto entró a la columna "Entrega final" del pipeline (purga a 7 días).
alter table public.creativos_proyectos
  add column if not exists entrega_entered_at timestamptz;

comment on column public.creativos_proyectos.entrega_entered_at is
  'Timestamp en que el proyecto pasó a la etapa Entrega final en el pipeline; la app elimina el registro tras 7 días.';
