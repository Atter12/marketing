-- Finanzas app: una sola organización — todos los usuarios autenticados comparten las mismas filas.
-- Quita user_id y políticas por usuario; reemplaza por acceso completo para rol authenticated.

-- ─── Quitar políticas y triggers anteriores ───
drop policy if exists "finanzas_app_ingresos_select_own" on public.finanzas_app_ingresos;
drop policy if exists "finanzas_app_ingresos_insert_own" on public.finanzas_app_ingresos;
drop policy if exists "finanzas_app_ingresos_update_own" on public.finanzas_app_ingresos;
drop policy if exists "finanzas_app_ingresos_delete_own" on public.finanzas_app_ingresos;
drop trigger if exists finanzas_app_ingresos_user_id on public.finanzas_app_ingresos;

drop policy if exists "finanzas_app_gastos_select_own" on public.finanzas_app_gastos;
drop policy if exists "finanzas_app_gastos_insert_own" on public.finanzas_app_gastos;
drop policy if exists "finanzas_app_gastos_update_own" on public.finanzas_app_gastos;
drop policy if exists "finanzas_app_gastos_delete_own" on public.finanzas_app_gastos;
drop trigger if exists finanzas_app_gastos_user_id on public.finanzas_app_gastos;

drop policy if exists "finanzas_app_cuentas_cobrar_select_own" on public.finanzas_app_cuentas_cobrar;
drop policy if exists "finanzas_app_cuentas_cobrar_insert_own" on public.finanzas_app_cuentas_cobrar;
drop policy if exists "finanzas_app_cuentas_cobrar_update_own" on public.finanzas_app_cuentas_cobrar;
drop policy if exists "finanzas_app_cuentas_cobrar_delete_own" on public.finanzas_app_cuentas_cobrar;
drop trigger if exists finanzas_app_cuentas_cobrar_user_id on public.finanzas_app_cuentas_cobrar;

drop policy if exists "finanzas_app_deudas_select_own" on public.finanzas_app_deudas;
drop policy if exists "finanzas_app_deudas_insert_own" on public.finanzas_app_deudas;
drop policy if exists "finanzas_app_deudas_update_own" on public.finanzas_app_deudas;
drop policy if exists "finanzas_app_deudas_delete_own" on public.finanzas_app_deudas;
drop trigger if exists finanzas_app_deudas_user_id on public.finanzas_app_deudas;

drop policy if exists "finanzas_app_sueldos_select_own" on public.finanzas_app_sueldos;
drop policy if exists "finanzas_app_sueldos_insert_own" on public.finanzas_app_sueldos;
drop policy if exists "finanzas_app_sueldos_update_own" on public.finanzas_app_sueldos;
drop policy if exists "finanzas_app_sueldos_delete_own" on public.finanzas_app_sueldos;
drop trigger if exists finanzas_app_sueldos_user_id on public.finanzas_app_sueldos;

drop policy if exists "finanzas_app_impuestos_select_own" on public.finanzas_app_impuestos;
drop policy if exists "finanzas_app_impuestos_insert_own" on public.finanzas_app_impuestos;
drop policy if exists "finanzas_app_impuestos_update_own" on public.finanzas_app_impuestos;
drop policy if exists "finanzas_app_impuestos_delete_own" on public.finanzas_app_impuestos;
drop trigger if exists finanzas_app_impuestos_user_id on public.finanzas_app_impuestos;

drop function if exists public.finanzas_app_enforce_user_id();

alter table public.finanzas_app_ingresos drop column if exists user_id;
alter table public.finanzas_app_gastos drop column if exists user_id;
alter table public.finanzas_app_cuentas_cobrar drop column if exists user_id;
alter table public.finanzas_app_deudas drop column if exists user_id;
alter table public.finanzas_app_sueldos drop column if exists user_id;
alter table public.finanzas_app_impuestos drop column if exists user_id;

-- Idempotente si se re-ejecuta el script
drop policy if exists "finanzas_app_ingresos_org_all" on public.finanzas_app_ingresos;
drop policy if exists "finanzas_app_gastos_org_all" on public.finanzas_app_gastos;
drop policy if exists "finanzas_app_cuentas_cobrar_org_all" on public.finanzas_app_cuentas_cobrar;
drop policy if exists "finanzas_app_deudas_org_all" on public.finanzas_app_deudas;
drop policy if exists "finanzas_app_sueldos_org_all" on public.finanzas_app_sueldos;
drop policy if exists "finanzas_app_impuestos_org_all" on public.finanzas_app_impuestos;

create policy "finanzas_app_ingresos_org_all"
  on public.finanzas_app_ingresos for all to authenticated
  using (true) with check (true);

create policy "finanzas_app_gastos_org_all"
  on public.finanzas_app_gastos for all to authenticated
  using (true) with check (true);

create policy "finanzas_app_cuentas_cobrar_org_all"
  on public.finanzas_app_cuentas_cobrar for all to authenticated
  using (true) with check (true);

create policy "finanzas_app_deudas_org_all"
  on public.finanzas_app_deudas for all to authenticated
  using (true) with check (true);

create policy "finanzas_app_sueldos_org_all"
  on public.finanzas_app_sueldos for all to authenticated
  using (true) with check (true);

create policy "finanzas_app_impuestos_org_all"
  on public.finanzas_app_impuestos for all to authenticated
  using (true) with check (true);
