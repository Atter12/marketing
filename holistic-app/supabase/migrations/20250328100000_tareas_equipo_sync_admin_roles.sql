-- Ver supabase/migrations/033_tareas_equipo_sync_admin_roles.sql

update public.tareas_equipo te
set
  gerente_email = lower(trim(g.email)),
  rol = 'Administrador'
from public.gerentes g
where g.perm_admin is true
  and lower(trim(g.email)) in (
    'attermayerbasiliorengifo@gmail.com',
    'victor.minas@unmsm.edu.pe'
  )
  and lower(regexp_replace(trim(te.nombre), '\s+', ' ', 'g'))
    = lower(regexp_replace(trim(concat_ws(' ', nullif(trim(g.nombre), ''), nullif(trim(g.apellido), ''))), '\s+', ' ', 'g'))
  and trim(te.nombre) <> '';
