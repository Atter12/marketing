-- Finanzas: moneda por movimiento (USD o PEN). Los importes en columnas *_usd / monto_usd / bruto_usd son NOMINALES en esa moneda.

alter table public.finanzas_app_ingresos add column if not exists moneda text not null default 'USD';
alter table public.finanzas_app_gastos add column if not exists moneda text not null default 'USD';
alter table public.finanzas_app_cuentas_cobrar add column if not exists moneda text not null default 'USD';
alter table public.finanzas_app_deudas add column if not exists moneda text not null default 'USD';
alter table public.finanzas_app_sueldos add column if not exists moneda text not null default 'USD';
alter table public.finanzas_app_impuestos add column if not exists moneda text not null default 'USD';
