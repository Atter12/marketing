-- Contactos de garante (personas de contacto / respaldo), mínimo 3 obligatorios en la app.
alter table public.clientes
  add column if not exists garantes_contactos jsonb not null default '[]'::jsonb;

comment on column public.clientes.garantes_contactos is
  'Lista JSON: [{ "nombre", "telefono", "email" }]. La app exige al menos 3 contactos con teléfono o email.';
