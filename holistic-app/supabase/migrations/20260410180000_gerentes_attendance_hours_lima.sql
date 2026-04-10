-- Igual que supabase/migrations/048_gerentes_attendance_hours_lima.sql

create or replace function public.gerentes_enforce_attendance_hours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lima_time time;
  in_window boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if (new.checkin_at is not distinct from old.checkin_at)
     and (new.checkout_at is not distinct from old.checkout_at) then
    return new;
  end if;

  lima_time := (now() at time zone 'America/Lima')::time;
  in_window := lima_time >= time '09:00' and lima_time < time '18:00';

  if not in_window then
    raise exception 'Asistencia permitida solo entre 9:00 y 17:59 (hora Perú/Lima).'
      using errcode = 'P0001';
  end if;

  if new.checkin_at is distinct from old.checkin_at and new.checkin_at is not null then
    new.checkin_at := now();
  end if;
  if new.checkout_at is distinct from old.checkout_at and new.checkout_at is not null then
    new.checkout_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_gerentes_attendance_hours on public.gerentes;
create trigger trg_gerentes_attendance_hours
  before update on public.gerentes
  for each row
  execute function public.gerentes_enforce_attendance_hours();

comment on function public.gerentes_enforce_attendance_hours() is
  'Restringe cambios de checkin_at/checkout_at a 9:00–17:59 hora Lima y fuerza timestamptz del servidor.';
