-- ═══════════════════════════════════════════════════════════════
-- Creativos (VideoForge): tablas creativos_* y RLS solo gerentes
-- Misma BD y auth que Crédito/Tareas. Requiere 001_gerentes y 003 (is_gerente)
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1.1 creativos_clientes ═══
create table if not exists public.creativos_clientes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  created_at timestamptz default now(),
  created_by text
);

-- ═══ 1.2 creativos_productos ═══
create table if not exists public.creativos_productos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  created_at timestamptz default now(),
  created_by text
);

-- ═══ 1.3 creativos_editores ═══
create table if not exists public.creativos_editores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text,
  created_at timestamptz default now(),
  created_by text
);

-- ═══ 1.4 creativos_proyectos (stages en JSONB) ═══
-- stages: { inspiracion: { status, files[], note, reviewer, reviewNote, reviewedAt }, guion: {...}, produccion: {...}, revision: {...}, entrega: {...} }
create table if not exists public.creativos_proyectos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid references public.creativos_clientes(id) on delete set null,
  product_id uuid references public.creativos_productos(id) on delete set null,
  editor_id uuid references public.creativos_editores(id) on delete set null,
  type text,
  platform text,
  format text,
  brief text,
  stages jsonb not null default '{"inspiracion":{"status":"pending","files":[],"note":"","reviewer":"","reviewNote":"","reviewedAt":null},"guion":{"status":"pending","files":[],"note":"","reviewer":"","reviewNote":"","reviewedAt":null},"produccion":{"status":"pending","files":[],"note":"","reviewer":"","reviewNote":"","reviewedAt":null},"revision":{"status":"pending","files":[],"note":"","reviewer":"","reviewNote":"","reviewedAt":null},"entrega":{"status":"pending","files":[],"note":"","reviewer":"","reviewNote":"","reviewedAt":null}}',
  cpa text default 'pendiente' check (cpa in ('pendiente','muy_bueno','bueno','malo')),
  published boolean not null default false,
  created_at timestamptz default now(),
  created_by text
);

create index if not exists idx_creativos_proyectos_client_id on public.creativos_proyectos(client_id);
create index if not exists idx_creativos_proyectos_editor_id on public.creativos_proyectos(editor_id);
create index if not exists idx_creativos_proyectos_created_at on public.creativos_proyectos(created_at desc);

-- ═══ 1.6 RLS: solo gerentes ═══
alter table public.creativos_clientes enable row level security;
alter table public.creativos_productos enable row level security;
alter table public.creativos_editores enable row level security;
alter table public.creativos_proyectos enable row level security;

drop policy if exists "Gerente all creativos_clientes" on public.creativos_clientes;
create policy "Gerente all creativos_clientes" on public.creativos_clientes for all using (public.is_gerente());

drop policy if exists "Gerente all creativos_productos" on public.creativos_productos;
create policy "Gerente all creativos_productos" on public.creativos_productos for all using (public.is_gerente());

drop policy if exists "Gerente all creativos_editores" on public.creativos_editores;
create policy "Gerente all creativos_editores" on public.creativos_editores for all using (public.is_gerente());

drop policy if exists "Gerente all creativos_proyectos" on public.creativos_proyectos;
create policy "Gerente all creativos_proyectos" on public.creativos_proyectos for all using (public.is_gerente());
