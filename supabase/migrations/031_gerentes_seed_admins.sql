-- Administradores de asistencia / Tareas (ajusta si tus correos difieren).
update public.gerentes
set perm_admin = true,
    perm_estandar = false
where lower(trim(email)) in (
  'attermayerbasiliorengifo@gmail.com',
  'victor.minas@unmsm.edu.pe'
);
