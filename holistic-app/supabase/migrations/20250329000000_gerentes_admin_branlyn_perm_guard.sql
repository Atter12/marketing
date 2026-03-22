-- Igual que supabase/migrations/035_gerentes_admin_branlyn_perm_guard.sql

update public.gerentes
set perm_admin = true,
    perm_estandar = false
where lower(trim(email)) in (
  'branlyn.lopez.r@gmail.com',
  'attermayerbasiliorengifo@gmail.com',
  'victor.minas@unmsm.edu.pe'
);

update public.gerentes
set perm_estandar = false
where coalesce(perm_admin, false) = true;

create or replace function public.gerentes_enforce_perm_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if (auth.jwt() ->> 'email') is null or length(trim(coalesce(auth.jwt() ->> 'email', ''))) = 0 then
    return new;
  end if;
  if public.is_gerente_admin() then
    return new;
  end if;
  if lower(trim(old.email)) is distinct from lower(trim(auth.jwt() ->> 'email')) then
    raise exception 'Solo puedes actualizar tu propia ficha de miembro';
  end if;
  if (new.perm_admin is distinct from old.perm_admin)
     or (new.perm_estandar is distinct from old.perm_estandar)
     or (new.perm_gestor_financiero is distinct from old.perm_gestor_financiero)
     or (new.perm_analista_financiero is distinct from old.perm_analista_financiero) then
    raise exception 'Solo un administrador puede cambiar roles (admin / asistente / finanzas).';
  end if;
  return new;
end;
$$;

drop trigger if exists gerentes_enforce_perm_updates_trg on public.gerentes;
create trigger gerentes_enforce_perm_updates_trg
before update on public.gerentes
for each row
execute function public.gerentes_enforce_perm_updates();
