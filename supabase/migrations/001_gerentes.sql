-- ═══════════════════════════════════════════════════════════════
-- Login solo gerente: tabla de emails autorizados (gerentes)
-- Ejecuta este SQL en Supabase: SQL Editor → New query → Pegar → Run
-- ═══════════════════════════════════════════════════════════════

-- Tabla de gerentes (solo estos emails pueden entrar a la app)
create table if not exists public.gerentes (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz default now()
);

-- RLS: cada usuario solo puede ver si SU email está en la lista (no ve el listado completo)
alter table public.gerentes enable row level security;

-- Email en JWT puede venir en distinto caso; comparar en minúsculas
drop policy if exists "Users can check if they are gerente" on public.gerentes;
create policy "Users can check if they are gerente"
  on public.gerentes for select
  using (lower(trim(auth.jwt()->>'email')) = lower(trim(email)));

-- ═══ INSERTAR AL GERENTE ═══
-- Reemplaza 'tu-email@dominio.com' por el email del dueño/gerente.
-- Ese mismo email debe estar registrado en Supabase Auth (Dashboard → Authentication → Users).
insert into public.gerentes (email) values ('tu-email@dominio.com')
  on conflict (email) do nothing;
