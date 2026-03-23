-- Cobranza MVP: bandeja de correos, historial y regla anti-duplicado.
-- Ejecutar despues de schema base de credito y de permisos de gerentes.

create table if not exists public.cobranza_bandeja (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clientes(id) on delete set null,
  cliente_nombre text,
  email_destino text not null,
  monto_pendiente numeric not null default 0,
  moneda text not null default 'USD',
  fecha_limite date,
  dias_atraso integer not null default 0,
  link_pago text,
  resumen_servicios text,
  asunto text not null,
  cuerpo_html text not null,
  cuerpo_texto text,
  variables jsonb not null default '{}'::jsonb,
  estado text not null default 'pending_approval',
  motivo_rechazo text,
  aprobado_por text,
  aprobado_at timestamptz,
  rechazado_por text,
  rechazado_at timestamptz,
  enviado_at timestamptz,
  ultimo_error text,
  intentos integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cobranza_estado_chk check (
    estado in ('draft', 'pending_approval', 'approved', 'rejected', 'sending', 'sent', 'failed')
  )
);

create table if not exists public.cobranza_eventos (
  id uuid primary key default gen_random_uuid(),
  correo_id uuid not null references public.cobranza_bandeja(id) on delete cascade,
  evento text not null,
  detalle jsonb not null default '{}'::jsonb,
  actor_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cobranza_bandeja_estado on public.cobranza_bandeja(estado);
create index if not exists idx_cobranza_bandeja_email on public.cobranza_bandeja(lower(email_destino));
create index if not exists idx_cobranza_bandeja_client on public.cobranza_bandeja(client_id);
create index if not exists idx_cobranza_bandeja_enviado_at on public.cobranza_bandeja(enviado_at desc);
create index if not exists idx_cobranza_eventos_correo on public.cobranza_eventos(correo_id, created_at desc);

create or replace function public.cobranza_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_cobranza_touch_updated_at on public.cobranza_bandeja;
create trigger trg_cobranza_touch_updated_at
before update on public.cobranza_bandeja
for each row execute function public.cobranza_touch_updated_at();

create or replace function public.cobranza_ya_enviado_reciente(
  p_email text,
  p_client_id uuid,
  p_window interval default interval '24 hours'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cobranza_bandeja c
    where lower(trim(c.email_destino)) = lower(trim(p_email))
      and (
        p_client_id is null
        or c.client_id = p_client_id
      )
      and c.estado = 'sent'
      and c.enviado_at is not null
      and c.enviado_at >= now() - p_window
  );
$$;

alter table public.cobranza_bandeja enable row level security;
alter table public.cobranza_eventos enable row level security;

drop policy if exists "Gerente all cobranza_bandeja" on public.cobranza_bandeja;
create policy "Gerente all cobranza_bandeja"
  on public.cobranza_bandeja for all
  using (public.is_gerente())
  with check (public.is_gerente());

drop policy if exists "Gerente all cobranza_eventos" on public.cobranza_eventos;
create policy "Gerente all cobranza_eventos"
  on public.cobranza_eventos for all
  using (public.is_gerente())
  with check (public.is_gerente());

create or replace view public.cobranza_listos_para_enviar as
select
  c.id,
  c.client_id,
  c.cliente_nombre,
  c.email_destino,
  c.monto_pendiente,
  c.moneda,
  c.fecha_limite,
  c.dias_atraso,
  c.asunto,
  c.estado,
  c.aprobado_por,
  c.aprobado_at,
  c.created_at
from public.cobranza_bandeja c
where c.estado in ('pending_approval', 'approved', 'failed')
order by c.created_at desc;
