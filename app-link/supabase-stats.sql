-- ============================================================
-- Estadísticas de clics — ejecutar en Supabase SQL Editor
-- ============================================================

create table if not exists public.link_clicks (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  link_index int not null default 0,
  target_url text,
  country text,
  clicked_at timestamptz default now()
);

create index if not exists idx_link_clicks_slug on public.link_clicks (slug);
create index if not exists idx_link_clicks_clicked_at on public.link_clicks (clicked_at desc);

comment on table public.link_clicks is 'Registro de cada clic en un link corto (para estadísticas)';
comment on column public.link_clicks.link_index is 'Índice del enlace en rotación (0, 1, 2...) o 0 para modo común';

alter table public.link_clicks enable row level security;

create policy "link_clicks_select" on public.link_clicks for select using (true);
create policy "link_clicks_insert" on public.link_clicks for insert with check (true);
