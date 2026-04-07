-- Dashboard Finanzas: tablas nuevas, independientes de Crédito (clientes/gastos/cobros/manual).
-- RLS: cada fila pertenece al usuario autenticado (auth.uid()).

-- ─── Trigger: fija user_id en INSERT y evita cambiar user_id en UPDATE ───
create or replace function public.finanzas_app_enforce_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

-- ─── Ingresos ───
create table if not exists public.finanzas_app_ingresos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  cliente text not null default '—',
  concepto text not null default '',
  monto_usd numeric(14, 2) not null default 0,
  fecha_pago date not null,
  estado text not null default 'Pagado',
  created_at timestamptz not null default now()
);

create index if not exists finanzas_app_ingresos_user_fecha_idx
  on public.finanzas_app_ingresos (user_id, fecha desc);

drop trigger if exists finanzas_app_ingresos_user_id on public.finanzas_app_ingresos;
create trigger finanzas_app_ingresos_user_id
  before insert or update on public.finanzas_app_ingresos
  for each row execute function public.finanzas_app_enforce_user_id();

alter table public.finanzas_app_ingresos enable row level security;

create policy "finanzas_app_ingresos_select_own"
  on public.finanzas_app_ingresos for select to authenticated
  using (user_id = auth.uid());

create policy "finanzas_app_ingresos_insert_own"
  on public.finanzas_app_ingresos for insert to authenticated
  with check (true);

create policy "finanzas_app_ingresos_update_own"
  on public.finanzas_app_ingresos for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "finanzas_app_ingresos_delete_own"
  on public.finanzas_app_ingresos for delete to authenticated
  using (user_id = auth.uid());

-- ─── Gastos ───
create table if not exists public.finanzas_app_gastos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  categoria text not null default 'General',
  concepto text not null default '',
  proveedor text not null default '—',
  monto_usd numeric(14, 2) not null default 0,
  fecha_pago date not null,
  estado text not null default 'Pagado',
  created_at timestamptz not null default now()
);

create index if not exists finanzas_app_gastos_user_fecha_idx
  on public.finanzas_app_gastos (user_id, fecha desc);

drop trigger if exists finanzas_app_gastos_user_id on public.finanzas_app_gastos;
create trigger finanzas_app_gastos_user_id
  before insert or update on public.finanzas_app_gastos
  for each row execute function public.finanzas_app_enforce_user_id();

alter table public.finanzas_app_gastos enable row level security;

create policy "finanzas_app_gastos_select_own"
  on public.finanzas_app_gastos for select to authenticated
  using (user_id = auth.uid());

create policy "finanzas_app_gastos_insert_own"
  on public.finanzas_app_gastos for insert to authenticated
  with check (true);

create policy "finanzas_app_gastos_update_own"
  on public.finanzas_app_gastos for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "finanzas_app_gastos_delete_own"
  on public.finanzas_app_gastos for delete to authenticated
  using (user_id = auth.uid());

-- ─── Cuentas por cobrar ───
create table if not exists public.finanzas_app_cuentas_cobrar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cliente text not null default '—',
  servicio text not null default '—',
  monto_usd numeric(14, 2) not null default 0,
  fecha_emision date not null,
  fecha_vencimiento date not null,
  estado text not null default 'Al día',
  created_at timestamptz not null default now()
);

create index if not exists finanzas_app_cuentas_cobrar_user_venc_idx
  on public.finanzas_app_cuentas_cobrar (user_id, fecha_vencimiento);

drop trigger if exists finanzas_app_cuentas_cobrar_user_id on public.finanzas_app_cuentas_cobrar;
create trigger finanzas_app_cuentas_cobrar_user_id
  before insert or update on public.finanzas_app_cuentas_cobrar
  for each row execute function public.finanzas_app_enforce_user_id();

alter table public.finanzas_app_cuentas_cobrar enable row level security;

create policy "finanzas_app_cuentas_cobrar_select_own"
  on public.finanzas_app_cuentas_cobrar for select to authenticated
  using (user_id = auth.uid());

create policy "finanzas_app_cuentas_cobrar_insert_own"
  on public.finanzas_app_cuentas_cobrar for insert to authenticated
  with check (true);

create policy "finanzas_app_cuentas_cobrar_update_own"
  on public.finanzas_app_cuentas_cobrar for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "finanzas_app_cuentas_cobrar_delete_own"
  on public.finanzas_app_cuentas_cobrar for delete to authenticated
  using (user_id = auth.uid());

-- ─── Deudas ───
create table if not exists public.finanzas_app_deudas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
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

create index if not exists finanzas_app_deudas_user_idx
  on public.finanzas_app_deudas (user_id, prox_pago);

drop trigger if exists finanzas_app_deudas_user_id on public.finanzas_app_deudas;
create trigger finanzas_app_deudas_user_id
  before insert or update on public.finanzas_app_deudas
  for each row execute function public.finanzas_app_enforce_user_id();

alter table public.finanzas_app_deudas enable row level security;

create policy "finanzas_app_deudas_select_own"
  on public.finanzas_app_deudas for select to authenticated
  using (user_id = auth.uid());

create policy "finanzas_app_deudas_insert_own"
  on public.finanzas_app_deudas for insert to authenticated
  with check (true);

create policy "finanzas_app_deudas_update_own"
  on public.finanzas_app_deudas for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "finanzas_app_deudas_delete_own"
  on public.finanzas_app_deudas for delete to authenticated
  using (user_id = auth.uid());

-- ─── Sueldos ───
create table if not exists public.finanzas_app_sueldos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  empleado text not null default '',
  cargo text not null default '',
  bruto_usd numeric(14, 2) not null default 0,
  fecha_pago date not null,
  created_at timestamptz not null default now()
);

create index if not exists finanzas_app_sueldos_user_idx
  on public.finanzas_app_sueldos (user_id, fecha_pago desc);

drop trigger if exists finanzas_app_sueldos_user_id on public.finanzas_app_sueldos;
create trigger finanzas_app_sueldos_user_id
  before insert or update on public.finanzas_app_sueldos
  for each row execute function public.finanzas_app_enforce_user_id();

alter table public.finanzas_app_sueldos enable row level security;

create policy "finanzas_app_sueldos_select_own"
  on public.finanzas_app_sueldos for select to authenticated
  using (user_id = auth.uid());

create policy "finanzas_app_sueldos_insert_own"
  on public.finanzas_app_sueldos for insert to authenticated
  with check (true);

create policy "finanzas_app_sueldos_update_own"
  on public.finanzas_app_sueldos for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "finanzas_app_sueldos_delete_own"
  on public.finanzas_app_sueldos for delete to authenticated
  using (user_id = auth.uid());

-- ─── Impuestos ───
create table if not exists public.finanzas_app_impuestos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null default '',
  periodo text not null default '',
  base_usd numeric(14, 2),
  tasa numeric(10, 4),
  monto_usd numeric(14, 2) not null default 0,
  fecha_vencimiento date not null,
  estado text not null default 'Pendiente',
  created_at timestamptz not null default now()
);

create index if not exists finanzas_app_impuestos_user_idx
  on public.finanzas_app_impuestos (user_id, fecha_vencimiento);

drop trigger if exists finanzas_app_impuestos_user_id on public.finanzas_app_impuestos;
create trigger finanzas_app_impuestos_user_id
  before insert or update on public.finanzas_app_impuestos
  for each row execute function public.finanzas_app_enforce_user_id();

alter table public.finanzas_app_impuestos enable row level security;

create policy "finanzas_app_impuestos_select_own"
  on public.finanzas_app_impuestos for select to authenticated
  using (user_id = auth.uid());

create policy "finanzas_app_impuestos_insert_own"
  on public.finanzas_app_impuestos for insert to authenticated
  with check (true);

create policy "finanzas_app_impuestos_update_own"
  on public.finanzas_app_impuestos for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "finanzas_app_impuestos_delete_own"
  on public.finanzas_app_impuestos for delete to authenticated
  using (user_id = auth.uid());
