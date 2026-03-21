-- Ver supabase/migrations/030_gerentes_rls_asistencia_admin_invite.sql

create or replace function public.is_gerente_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select g.perm_admin
    from public.gerentes g
    where lower(trim(g.email)) = lower(trim(auth.jwt()->>'email'))
    limit 1
  ), false);
$$;

drop policy if exists "Users can check if they are gerente" on public.gerentes;
drop policy if exists "Gerente list all gerentes" on public.gerentes;

create policy "Gerente select propio o todo si admin"
  on public.gerentes for select
  using (
    auth.jwt()->>'email' is not null
    and public.is_gerente()
    and (
      public.is_gerente_admin()
      or lower(trim(email)) = lower(trim(auth.jwt()->>'email'))
    )
  );

drop policy if exists "Gerente update gerentes asistencia" on public.gerentes;
create policy "Gerente update propio o todo si admin"
  on public.gerentes for update
  using (
    public.is_gerente()
    and (
      public.is_gerente_admin()
      or lower(trim(email)) = lower(trim(auth.jwt()->>'email'))
    )
  )
  with check (
    public.is_gerente()
    and (
      public.is_gerente_admin()
      or lower(trim(email)) = lower(trim(auth.jwt()->>'email'))
    )
  );

drop policy if exists "Gerente insert gerentes" on public.gerentes;
create policy "Gerente insert gerentes"
  on public.gerentes for insert
  to authenticated
  with check (public.is_gerente() and public.is_gerente_admin());
