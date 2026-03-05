-- ═══════════════════════════════════════════════════════════════
-- Tareas (AgencyFlow): tablas tareas_* y RLS solo gerentes
-- Misma BD y auth que Crédito/Creativos. Requiere 001_gerentes y 003 (is_gerente)
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1.1 tareas_equipo ═══
create table if not exists public.tareas_equipo (
  id text primary key,
  nombre text not null,
  rol text,
  color text,
  servicio text,
  activo boolean not null default true,
  asistencia text,
  checkin_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══ 1.2 tareas_clientes ═══
create table if not exists public.tareas_clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text,
  color text,
  fases jsonb default '[]',
  fase_actual int default 0,
  servicios jsonb default '[]',
  equipo_ids jsonb default '[]',
  entregables int default 0,
  entregables_hechos int default 0,
  tickets_count int default 0,
  meetings_count int default 0,
  satisfaccion int,
  presupuesto text,
  gastado text,
  contacto_nombre text,
  email text,
  telefono text,
  proxima_accion text,
  contrato_inicio text,
  contrato_fin text,
  fee_mensual text,
  health int,
  health_txt text,
  notes text,
  status text default 'activo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══ 1.3 tareas_kanban ═══
create table if not exists public.tareas_kanban (
  id uuid primary key default gen_random_uuid(),
  columna text not null default 'todo' check (columna in ('todo','progress','review','done')),
  titulo text not null,
  descripcion text,
  servicio text,
  prioridad text default 'md' check (prioridad in ('hi','md','lo')),
  fecha_entrega date,
  estado_fecha text check (estado_fecha in ('lt','sn','dn') or estado_fecha is null),
  progreso int default 0 check (progreso >= 0 and progreso <= 100),
  equipo_ids jsonb default '[]',
  cliente_id uuid references public.tareas_clientes(id) on delete set null,
  cliente_nombre text,
  subtareas text,
  orden int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tareas_kanban_columna_orden on public.tareas_kanban(columna, orden);

-- ═══ 1.4 tareas_tickets + tareas_ticket_comentarios ═══
create table if not exists public.tareas_tickets (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null,
  subtitulo text,
  cliente_nombre text,
  cliente_color text,
  status text not null default 'open' check (status in ('open','progress','closed')),
  prioridad text default 'media',
  categoria text,
  canal text,
  asignado_id text references public.tareas_equipo(id) on delete set null,
  sla_horas int,
  sla_vencimiento timestamptz,
  sla_status text,
  entregable_vinculado text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tareas_ticket_comentarios (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tareas_tickets(id) on delete cascade,
  quien text not null,
  que text,
  cuando text,
  tipo text default 'comment' check (tipo in ('system','comment')),
  created_at timestamptz default now()
);

create index if not exists idx_tareas_ticket_comentarios_ticket_id on public.tareas_ticket_comentarios(ticket_id);

-- ═══ 1.5 tareas_workload ═══
create table if not exists public.tareas_workload (
  id uuid primary key default gen_random_uuid(),
  equipo_id text not null references public.tareas_equipo(id) on delete cascade,
  titulo text not null,
  dias int not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_tareas_workload_equipo_id on public.tareas_workload(equipo_id);

-- ═══ 1.6 tareas_calendario ═══
create table if not exists public.tareas_calendario (
  id uuid primary key default gen_random_uuid(),
  dia int not null check (dia >= 1 and dia <= 31),
  mes int not null check (mes >= 1 and mes <= 12),
  anio int not null,
  titulo text not null,
  clase_css text,
  cliente_id uuid references public.tareas_clientes(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_tareas_calendario_mes_anio on public.tareas_calendario(mes, anio);

-- ═══ 1.7 tareas_workflows ═══
create table if not exists public.tareas_workflows (
  id uuid primary key default gen_random_uuid(),
  icono text,
  titulo text not null,
  descripcion text,
  pasos jsonb default '[]',
  activo int default 0,
  badges jsonb default '[]',
  orden int default 0,
  created_at timestamptz default now()
);

-- ═══ 1.8 RLS: solo gerentes ═══
alter table public.tareas_equipo enable row level security;
alter table public.tareas_clientes enable row level security;
alter table public.tareas_kanban enable row level security;
alter table public.tareas_tickets enable row level security;
alter table public.tareas_ticket_comentarios enable row level security;
alter table public.tareas_workload enable row level security;
alter table public.tareas_calendario enable row level security;
alter table public.tareas_workflows enable row level security;

drop policy if exists "Gerente all tareas_equipo" on public.tareas_equipo;
create policy "Gerente all tareas_equipo" on public.tareas_equipo for all using (public.is_gerente());

drop policy if exists "Gerente all tareas_clientes" on public.tareas_clientes;
create policy "Gerente all tareas_clientes" on public.tareas_clientes for all using (public.is_gerente());

drop policy if exists "Gerente all tareas_kanban" on public.tareas_kanban;
create policy "Gerente all tareas_kanban" on public.tareas_kanban for all using (public.is_gerente());

drop policy if exists "Gerente all tareas_tickets" on public.tareas_tickets;
create policy "Gerente all tareas_tickets" on public.tareas_tickets for all using (public.is_gerente());

drop policy if exists "Gerente all tareas_ticket_comentarios" on public.tareas_ticket_comentarios;
create policy "Gerente all tareas_ticket_comentarios" on public.tareas_ticket_comentarios for all using (public.is_gerente());

drop policy if exists "Gerente all tareas_workload" on public.tareas_workload;
create policy "Gerente all tareas_workload" on public.tareas_workload for all using (public.is_gerente());

drop policy if exists "Gerente all tareas_calendario" on public.tareas_calendario;
create policy "Gerente all tareas_calendario" on public.tareas_calendario for all using (public.is_gerente());

drop policy if exists "Gerente all tareas_workflows" on public.tareas_workflows;
create policy "Gerente all tareas_workflows" on public.tareas_workflows for all using (public.is_gerente());
