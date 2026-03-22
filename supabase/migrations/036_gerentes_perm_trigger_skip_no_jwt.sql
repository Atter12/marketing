-- El trigger 035 bloqueaba UPDATE ejecutados desde el SQL Editor (sin JWT de usuario).
-- Con esto solo se aplica la lógica cuando hay email en el JWT (peticiones PostgREST / cliente).

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
  -- Migraciones, SQL Editor y sesiones sin claim de email: no bloquear.
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

comment on function public.gerentes_enforce_perm_updates is 'Bloquea escalación de permisos vía API para no-admins. Omite comprobación sin JWT/email (SQL Editor, migraciones).';
