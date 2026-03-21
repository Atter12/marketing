-- Datos de miembro (asistencia) + permisos tipo centro de negocios (Tareas / Crédito).
-- perm_admin: acceso total e invitar equipo.
-- perm_estandar: operación habitual sin privilegios financieros ni administración.
-- perm_gestor_financiero / perm_analista_financiero: datos financieros en clientes (UI Tareas).

alter table public.gerentes add column if not exists nombre text;
alter table public.gerentes add column if not exists apellido text;
alter table public.gerentes add column if not exists avatar_url text;
alter table public.gerentes add column if not exists perm_admin boolean not null default false;
alter table public.gerentes add column if not exists perm_estandar boolean not null default true;
alter table public.gerentes add column if not exists perm_gestor_financiero boolean not null default false;
alter table public.gerentes add column if not exists perm_analista_financiero boolean not null default false;

comment on column public.gerentes.nombre is 'Nombre del miembro (asistencia / equipo).';
comment on column public.gerentes.apellido is 'Apellido del miembro.';
comment on column public.gerentes.perm_admin is 'Administrador: acceso completo e invitar miembros.';
comment on column public.gerentes.perm_estandar is 'Miembro estándar: cuentas/tareas asignadas sin admin ni finanzas avanzadas.';
comment on column public.gerentes.perm_gestor_financiero is 'Gestor financiero: editar presupuestos/fees en clientes.';
comment on column public.gerentes.perm_analista_financiero is 'Analista financiero: ver datos financieros (solo lectura).';

drop policy if exists "Gerente insert gerentes" on public.gerentes;
create policy "Gerente insert gerentes"
  on public.gerentes for insert
  to authenticated
  with check (public.is_gerente());
