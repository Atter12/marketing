-- Ver supabase/migrations/029_gerentes_miembro_permisos.sql

alter table public.gerentes add column if not exists nombre text;
alter table public.gerentes add column if not exists apellido text;
alter table public.gerentes add column if not exists avatar_url text;
alter table public.gerentes add column if not exists perm_admin boolean not null default false;
alter table public.gerentes add column if not exists perm_estandar boolean not null default true;
alter table public.gerentes add column if not exists perm_gestor_financiero boolean not null default false;
alter table public.gerentes add column if not exists perm_analista_financiero boolean not null default false;

drop policy if exists "Gerente insert gerentes" on public.gerentes;
create policy "Gerente insert gerentes"
  on public.gerentes for insert
  to authenticated
  with check (public.is_gerente());
