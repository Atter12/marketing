-- ═══════════════════════════════════════════════════════════════
-- Tablas: clientes, gastos, cobros, garantias, manual, clientes_acceso
-- RLS: gerente = todo; cliente = solo su client_id (lectura + insert cobros)
-- Ejecutar en Supabase SQL Editor después de 001_gerentes.sql
-- ═══════════════════════════════════════════════════════════════

-- ═══ TABLAS (primero tablas, luego funciones que las usan) ═══
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ig text,
  phones jsonb default '[]',
  emails jsonb default '[]',
  biz text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  mes text not null,
  camp text,
  gasto numeric not null default 0,
  fee numeric not null default 10,
  notas text,
  created_at timestamptz default now()
);

create table if not exists public.cobros (
  id uuid primary key default gen_random_uuid(),
  gasto_id uuid not null references public.gastos(id) on delete cascade,
  monto numeric not null default 0,
  fecha date not null default current_date,
  metodo text not null,
  notas text,
  created_at timestamptz default now()
);

create table if not exists public.garantias (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null default 'Cuenta TikTok',
  descripcion text,
  valor numeric not null default 0,
  estado text not null default 'Vigente',
  created_at timestamptz default now()
);

create table if not exists public.manual (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clientes(id) on delete set null,
  fecha date not null default current_date,
  conc text not null,
  monto numeric not null default 0,
  tipo text not null default 'Gasto',
  nota text,
  created_at timestamptz default now()
);

-- Vincula email de Auth con un cliente (para que el cliente vea solo sus datos)
create table if not exists public.clientes_acceso (
  email text primary key,
  client_id uuid not null references public.clientes(id) on delete cascade,
  created_at timestamptz default now()
);

-- Índices
create index if not exists idx_gastos_client_id on public.gastos(client_id);
create index if not exists idx_cobros_gasto_id on public.cobros(gasto_id);
create index if not exists idx_garantias_client_id on public.garantias(client_id);
create index if not exists idx_manual_client_id on public.manual(client_id);

-- ═══ Helpers para RLS (después de que existan las tablas) ═══
create or replace function public.is_gerente()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gerentes
    where lower(trim(email)) = lower(trim(auth.jwt()->>'email'))
  );
$$;

create or replace function public.my_client_id()
returns uuid language sql stable security definer
set search_path = public
as $$
  select client_id from public.clientes_acceso
  where lower(trim(email)) = lower(trim(auth.jwt()->>'email'))
  limit 1;
$$;

-- ═══ RLS clientes ═══
alter table public.clientes enable row level security;
drop policy if exists "Gerente all clientes" on public.clientes;
create policy "Gerente all clientes" on public.clientes for all using (public.is_gerente());
drop policy if exists "Cliente solo su registro" on public.clientes;
create policy "Cliente solo su registro" on public.clientes for select using (id = public.my_client_id());

-- ═══ RLS gastos ═══
alter table public.gastos enable row level security;
drop policy if exists "Gerente all gastos" on public.gastos;
create policy "Gerente all gastos" on public.gastos for all using (public.is_gerente());
drop policy if exists "Cliente solo sus gastos" on public.gastos;
create policy "Cliente solo sus gastos" on public.gastos for select using (client_id = public.my_client_id());

-- ═══ RLS cobros ═══
alter table public.cobros enable row level security;
drop policy if exists "Gerente all cobros" on public.cobros;
create policy "Gerente all cobros" on public.cobros for all using (public.is_gerente());
drop policy if exists "Cliente ver sus cobros" on public.cobros;
create policy "Cliente ver sus cobros" on public.cobros for select
  using (gasto_id in (select id from public.gastos where client_id = public.my_client_id()));
drop policy if exists "Cliente insertar cobro" on public.cobros;
create policy "Cliente insertar cobro" on public.cobros for insert
  with check (gasto_id in (select id from public.gastos where client_id = public.my_client_id()));

-- ═══ RLS garantias ═══
alter table public.garantias enable row level security;
drop policy if exists "Gerente all garantias" on public.garantias;
create policy "Gerente all garantias" on public.garantias for all using (public.is_gerente());
drop policy if exists "Cliente solo sus garantias" on public.garantias;
create policy "Cliente solo sus garantias" on public.garantias for select using (client_id = public.my_client_id());

-- ═══ RLS manual ═══
alter table public.manual enable row level security;
drop policy if exists "Gerente all manual" on public.manual;
create policy "Gerente all manual" on public.manual for all using (public.is_gerente());
drop policy if exists "Cliente solo su manual" on public.manual;
create policy "Cliente solo su manual" on public.manual for select using (client_id = public.my_client_id());

-- ═══ RLS clientes_acceso ═══
alter table public.clientes_acceso enable row level security;
drop policy if exists "Gerente all clientes_acceso" on public.clientes_acceso;
create policy "Gerente all clientes_acceso" on public.clientes_acceso for all using (public.is_gerente());
drop policy if exists "Cliente ver su acceso" on public.clientes_acceso;
create policy "Cliente ver su acceso" on public.clientes_acceso for select
  using (lower(trim(email)) = lower(trim(auth.jwt()->>'email')));

-- ═══ ACCESO DIRECTO AL CREAR CUENTA (cliente) ═══
-- El usuario que se registra puede crear su propio cliente y acceso en un solo paso.
create or replace function public.crear_cliente_desde_registro(p_name text, p_email text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_email text;
  v_client_id uuid;
begin
  v_email := lower(trim(p_email));
  if v_email is null or v_email = '' then
    raise exception 'Email requerido';
  end if;
  if lower(trim(auth.jwt()->>'email')) <> v_email then
    raise exception 'Solo puedes crear acceso con tu propio correo';
  end if;
  insert into public.clientes (name, emails)
  values (coalesce(nullif(trim(p_name), ''), v_email), jsonb_build_array(v_email))
  returning id into v_client_id;
  insert into public.clientes_acceso (email, client_id)
  values (v_email, v_client_id)
  on conflict (email) do update set client_id = excluded.client_id;
  return v_client_id;
end;
$$;

grant execute on function public.crear_cliente_desde_registro(text, text) to authenticated;
grant execute on function public.crear_cliente_desde_registro(text, text) to service_role;
