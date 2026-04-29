-- Identificador del cliente en UI: DNI o Id. Conserva datos existentes de clientes.codigo.
alter table public.clientes rename column codigo to dni;

comment on column public.clientes.dni is
  'DNI, CE, pasaporte u otro identificador del titular (antes columna codigo).';
