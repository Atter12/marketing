-- Dashboard Finanzas: tablas nuevas, independientes de Crédito.
-- Una sola organización (Marketing Holistic): cualquier usuario autenticado comparte el mismo dataset.

-- ─── Ingresos ───
create table if not exists public.finanzas_app_ingresos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  cliente text not null default '—',
  concepto text not null default '',
  monto_usd numeric(14, 2) not null default 0,
  fecha_pago date not null,
  estado text not null default 'Pagado',
  created_at timestamptz not null default now()
);

create index if not exists finanzas_app_ingresos_fecha_idx
  on public.finanzas_app_ingresos (fecha desc);

alter table public.finanzas_app_ingresos enable row level security;

drop policy if exists "finanzas_app_ingresos_org_all" on public.finanzas_app_ingresos;
create policy "finanzas_app_ingresos_org_all"
  on public.finanzas_app_ingresos for all to authenticated
  using (true) with check (true);

-- ─── Gastos ───
create table if not exists public.finanzas_app_gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  categoria text not null default 'General',
  concepto text not null default '',
  proveedor text not null default '—',
  monto_usd numeric(14, 2) not null default 0,
  fecha_pago date not null,
  estado text not null default 'Pagado',
  created_at timestamptz not null default now()
);

create index if not exists finanzas_app_gastos_fecha_idx
  on public.finanzas_app_gastos (fecha desc);

alter table public.finanzas_app_gastos enable row level security;

drop policy if exists "finanzas_app_gastos_org_all" on public.finanzas_app_gastos;
create policy "finanzas_app_gastos_org_all"
  on public.finanzas_app_gastos for all to authenticated
  using (true) with check (true);

-- ─── Cuentas por cobrar ───
create table if not exists public.finanzas_app_cuentas_cobrar (
  id uuid primary key default gen_random_uuid(),
  cliente text not null default '—',
  servicio text not null default '—',
  monto_usd numeric(14, 2) not null default 0,
  fecha_emision date not null,
  fecha_vencimiento date not null,
  estado text not null default 'Al día',
  created_at timestamptz not null default now()
);

create index if not exists finanzas_app_cuentas_cobrar_venc_idx
  on public.finanzas_app_cuentas_cobrar (fecha_vencimiento);

alter table public.finanzas_app_cuentas_cobrar enable row level security;

drop policy if exists "finanzas_app_cuentas_cobrar_org_all" on public.finanzas_app_cuentas_cobrar;
create policy "finanzas_app_cuentas_cobrar_org_all"
  on public.finanzas_app_cuentas_cobrar for all to authenticated
  using (true) with check (true);

-- ─── Deudas ───
create table if not exists public.finanzas_app_deudas (
  id uuid primary key default gen_random_uuid(),
  banco text not null default '',
  concepto text not null default '',
  monto_total numeric(14, 2) not null default 0,
  pagado numeric(14, 2) not null default 0,
  cuota_mensual numeric(14, 2),
  prox_pago date not null,
  estado text not null default 'Al día',
  color text not null default 'blue',
  created_at timestamptz not null default now()
);

create index if not exists finanzas_app_deudas_prox_idx
  on public.finanzas_app_deudas (prox_pago);

alter table public.finanzas_app_deudas enable row level security;

drop policy if exists "finanzas_app_deudas_org_all" on public.finanzas_app_deudas;
create policy "finanzas_app_deudas_org_all"
  on public.finanzas_app_deudas for all to authenticated
  using (true) with check (true);

-- ─── Sueldos ───
create table if not exists public.finanzas_app_sueldos (
  id uuid primary key default gen_random_uuid(),
  empleado text not null default '',
  cargo text not null default '',
  bruto_usd numeric(14, 2) not null default 0,
  fecha_pago date not null,
  created_at timestamptz not null default now()
);

create index if not exists finanzas_app_sueldos_fecha_idx
  on public.finanzas_app_sueldos (fecha_pago desc);

alter table public.finanzas_app_sueldos enable row level security;

drop policy if exists "finanzas_app_sueldos_org_all" on public.finanzas_app_sueldos;
create policy "finanzas_app_sueldos_org_all"
  on public.finanzas_app_sueldos for all to authenticated
  using (true) with check (true);

-- ─── Impuestos ───
create table if not exists public.finanzas_app_impuestos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default '',
  periodo text not null default '',
  base_usd numeric(14, 2),
  tasa numeric(10, 4),
  monto_usd numeric(14, 2) not null default 0,
  fecha_vencimiento date not null,
  estado text not null default 'Pendiente',
  created_at timestamptz not null default now()
);

create index if not exists finanzas_app_impuestos_venc_idx
  on public.finanzas_app_impuestos (fecha_vencimiento);

alter table public.finanzas_app_impuestos enable row level security;

drop policy if exists "finanzas_app_impuestos_org_all" on public.finanzas_app_impuestos;
create policy "finanzas_app_impuestos_org_all"
  on public.finanzas_app_impuestos for all to authenticated
  using (true) with check (true);
