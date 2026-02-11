-- ═══════════════════════════════════════════════════════════════
-- Solicitudes de clientes: alguien crea cuenta y el gerente acepta
-- Ejecutar después de 003_schema_clientes_gastos_cobros.sql
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.solicitudes_clientes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  phone text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptado', 'rechazado')),
  created_at timestamptz default now(),
  unique(email)
);

create index if not exists idx_solicitudes_estado on public.solicitudes_clientes(estado);

alter table public.solicitudes_clientes enable row level security;

-- El usuario autenticado solo puede insertar una solicitud con su propio email
drop policy if exists "Usuario inserta su solicitud" on public.solicitudes_clientes;
create policy "Usuario inserta su solicitud" on public.solicitudes_clientes for insert
  with check (lower(trim(auth.jwt()->>'email')) = lower(trim(email)));

-- El usuario puede ver solo su propia solicitud (para saber si está pendiente/aceptada)
drop policy if exists "Usuario ve su solicitud" on public.solicitudes_clientes;
create policy "Usuario ve su solicitud" on public.solicitudes_clientes for select
  using (lower(trim(auth.jwt()->>'email')) = lower(trim(email)));

-- Gerente ve y puede actualizar todas
drop policy if exists "Gerente all solicitudes" on public.solicitudes_clientes;
create policy "Gerente all solicitudes" on public.solicitudes_clientes for all using (public.is_gerente());
