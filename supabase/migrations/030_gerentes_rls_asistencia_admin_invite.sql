-- Asistencia: no-admins solo ven y actualizan su fila en gerentes; perm_admin ve y edita todas.
-- Invitar miembros (INSERT en gerentes): solo perm_admin.
-- Requiere columnas perm_* de 029.

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

comment on function public.is_gerente_admin is 'True si el JWT es un gerente con perm_admin (ve toda la asistencia e invita).';

-- Quitar políticas antiguas que se combinan por OR y permitían listar a todos los gerentes.
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
