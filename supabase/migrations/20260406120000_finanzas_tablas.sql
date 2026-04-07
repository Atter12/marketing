-- Tablas auxiliares del dashboard Finanzas (solo gerentes; is_gerente() en 003_schema)
create table if not exists public.finanzas_deudas (
  id uuid primary key default gen_random_uuid(),
  banco text not null default '',
  concepto text not null default '',
  monto_total numeric not null default 0,
  pagado numeric not null default 0,
  cuota_mensual numeric,
  prox_pago date,
  estado text not null default 'Al día',
  color text not null default 'blue',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.finanzas_impuestos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  periodo text not null default '',
  base_usd numeric,
  tasa numeric,
  monto_usd numeric not null default 0,
  fecha_vencimiento date,
  estado text not null default 'Pendiente',
  created_at timestamptz default now()
);

create table if not exists public.finanzas_sueldos (
  id uuid primary key default gen_random_uuid(),
  empleado text not null,
  cargo text default '',
  bruto_usd numeric not null default 0,
  fecha_pago date,
  created_at timestamptz default now()
);

alter table public.finanzas_deudas enable row level security;
alter table public.finanzas_impuestos enable row level security;
alter table public.finanzas_sueldos enable row level security;

drop policy if exists "finanzas_deudas_gerente" on public.finanzas_deudas;
create policy "finanzas_deudas_gerente" on public.finanzas_deudas
  for all using (public.is_gerente()) with check (public.is_gerente());

drop policy if exists "finanzas_impuestos_gerente" on public.finanzas_impuestos;
create policy "finanzas_impuestos_gerente" on public.finanzas_impuestos
  for all using (public.is_gerente()) with check (public.is_gerente());

drop policy if exists "finanzas_sueldos_gerente" on public.finanzas_sueldos;
create policy "finanzas_sueldos_gerente" on public.finanzas_sueldos
  for all using (public.is_gerente()) with check (public.is_gerente());

grant select, insert, update, delete on public.finanzas_deudas to authenticated;
grant select, insert, update, delete on public.finanzas_impuestos to authenticated;
grant select, insert, update, delete on public.finanzas_sueldos to authenticated;
