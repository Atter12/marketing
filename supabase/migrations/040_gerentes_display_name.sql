-- Nombre preferido tal como lo escribe el miembro en Pendientes (aviso al entrar / «Cambiar nombre»).
-- Tiene prioridad sobre nombre+apellido sueltos en listas de asignación y equipo.

alter table public.gerentes add column if not exists display_name text;

comment on column public.gerentes.display_name is 'Nombre visible preferido (texto completo del formulario de bienvenida); si no es null, la UI lo usa antes que nombre+apellido.';

update public.gerentes
set display_name = btrim(concat_ws(' ',
  nullif(btrim(coalesce(nombre, '')), ''),
  nullif(btrim(coalesce(apellido, '')), '')
))
where (display_name is null or btrim(display_name) = '')
  and (
    nullif(btrim(coalesce(nombre, '')), '') is not null
    or nullif(btrim(coalesce(apellido, '')), '') is not null
  );
