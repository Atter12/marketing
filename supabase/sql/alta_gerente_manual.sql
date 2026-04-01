-- ═══════════════════════════════════════════════════════════════
-- Alta manual de gerente (equipo: Pendientes, Crédito, Creativos)
-- ═══════════════════════════════════════════════════════════════
--
-- 1) En Supabase Dashboard → Authentication → Users → "Add user"
--    Creá el usuario con el MISMO correo y la contraseña que quieras.
--
-- 2) En SQL Editor ejecutá el INSERT de abajo (correo ya definido para este alta).
--
-- Sin fila en public.gerentes, la app no reconoce al usuario como gerente
-- (AuthGate / is_gerente), aunque exista en Authentication.
--
-- perm_admin: true = administrador (invitar equipo, etc.). Miembros normales: false.
-- perm_estandar: true = acceso operativo habitual (valor por defecto en BD).
--
-- ═══════════════════════════════════════════════════════════════

-- Stefanny — miembro estándar (ajustá nombre/apellido o perm_admin si hace falta)
insert into public.gerentes (email, nombre, apellido, perm_admin, perm_estandar)
values (
  lower(trim('stefannyumed17@gmail.com')),
  'Stefanny',
  '',
  false,
  true
)
on conflict (email) do update set
  nombre     = excluded.nombre,
  apellido   = excluded.apellido,
  perm_admin = excluded.perm_admin,
  perm_estandar = excluded.perm_estandar;

-- Opcional: si también querés que aparezca en Pendientes · Equipo de trabajo,
-- agregá una fila en tareas_equipo (id suele ser un string estable, p. ej. slug del nombre).
-- Descomentá y adaptá:
--
-- insert into public.tareas_equipo (id, nombre, rol, activo, gerente_email)
-- values (
--   'equipo_stefannyumed17',
--   'Stefanny',
--   'Miembro',
--   true,
--   lower(trim('stefannyumed17@gmail.com'))
-- )
-- on conflict (id) do update set
--   nombre = excluded.nombre,
--   gerente_email = excluded.gerente_email,
--   activo = true;
