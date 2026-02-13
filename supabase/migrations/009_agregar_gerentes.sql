-- Agregar gerentes (emails que ya están en Auth pero faltaban en la tabla gerentes)
-- Ejecutar en Supabase → SQL Editor

insert into public.gerentes (email) values
  ('Nicollulloamed@gmail.com'),
  ('Branlyn.lopez.r@gmail.com')
on conflict (email) do nothing;
