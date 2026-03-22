-- Administradores de asistencia / Tareas (ajusta si tus correos difieren).
-- Si falla con el trigger de permisos, aplica antes supabase/migrations/036_gerentes_perm_trigger_skip_no_jwt.sql (SQL Editor sin JWT).
update public.gerentes
set perm_admin = true,
    perm_estandar = false
where lower(trim(email)) in (
  'attermayerbasiliorengifo@gmail.com',
  'victor.minas@unmsm.edu.pe',
  'branlyn.lopez.r@gmail.com'
);
