-- Agregar gerente: anniealejandrova6@gmail.com
-- La contraseña se configura en Supabase Auth (Authentication → Users); aquí solo se autoriza el email en la tabla gerentes.
-- Ejecutar en Supabase → SQL Editor (o aplicar migración).

insert into public.gerentes (email) values
  ('anniealejandrova6@gmail.com')
on conflict (email) do nothing;
