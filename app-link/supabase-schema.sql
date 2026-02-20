-- ============================================================
-- Hecom / Panel de enlaces — esquema Supabase
-- Ejecutar en: Supabase → SQL Editor → New query
-- ============================================================

-- Tabla: configuración de cada link corto (slug)
create table if not exists public.link_configs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  mode text not null check (mode in ('rotation', 'common')),
  config jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índice para buscar por slug (redirects)
create index if not exists idx_link_configs_slug on public.link_configs (slug);

-- Comentarios
comment on table public.link_configs is 'Configuración de links cortos: rotación por clics o enlace común';
comment on column public.link_configs.slug is 'Segmento del link, ej: victor → hecom.club/victor';
comment on column public.link_configs.mode is 'rotation = rotación por clics; common = un solo destino';
comment on column public.link_configs.config is 'rotation: {"links":[{"url":"...","clicks":4},...]} | common: {"url":"https://..."}';

-- Trigger para actualizar updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists link_configs_updated_at on public.link_configs;
create trigger link_configs_updated_at
  before update on public.link_configs
  for each row execute function public.set_updated_at();

-- RLS: habilitar
alter table public.link_configs enable row level security;

-- Políticas:
-- 1) Cualquiera puede LEER por slug (para la página de redirect)
create policy "link_configs_select"
  on public.link_configs for select
  using (true);

-- 2) Cualquiera puede INSERT/UPDATE/DELETE (panel sin login por ahora; luego puedes restringir con auth)
create policy "link_configs_insert"
  on public.link_configs for insert
  with check (true);

create policy "link_configs_update"
  on public.link_configs for update
  using (true);

create policy "link_configs_delete"
  on public.link_configs for delete
  using (true);

-- Opcional: fila de ejemplo (puedes borrarla después)
-- insert into public.link_configs (slug, mode, config) values
--   ('victor', 'common', '{"url":"https://facebook.com"}');
