-- Gastos: prepago (permite asociar cobro); Garantías: código de verificación
-- Ejecutar después de 007_gastos_created_by.sql

alter table public.gastos add column if not exists prepago boolean not null default false;
comment on column public.gastos.prepago is 'Si es true, es recarga/prepago y se puede registrar cobro';

alter table public.garantias add column if not exists codigo_verificacion text;
comment on column public.garantias.codigo_verificacion is 'Código de verificación de la garantía';
