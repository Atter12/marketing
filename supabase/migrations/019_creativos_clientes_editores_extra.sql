-- Más datos en clientes y correo en editores (Creativos)
alter table if exists public.creativos_clientes
  add column if not exists phone text,
  add column if not exists contact_name text,
  add column if not exists notes text;

alter table if exists public.creativos_editores
  add column if not exists email text;
