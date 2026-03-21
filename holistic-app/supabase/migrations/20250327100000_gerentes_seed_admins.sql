-- Ver supabase/migrations/031_gerentes_seed_admins.sql

update public.gerentes
set perm_admin = true,
    perm_estandar = false
where lower(trim(email)) in (
  'attermayerbasiliorengifo@gmail.com',
  'victor.minas@unmsm.edu.pe'
);
