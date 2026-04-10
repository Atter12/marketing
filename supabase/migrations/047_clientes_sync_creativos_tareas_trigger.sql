-- Clientes Crédito → siempre reflejados en creativos_clientes y tareas_clientes (Pendientes).
-- La migración 016 solo backfilleara una vez; los altas/ediciones posteriores en clientes no creaban filas.
-- Este trigger mantiene la fuente de verdad (public.clientes) alineada con Creativos y Pendientes.

create or replace function public.sync_cliente_creativos_tareas_from_credito()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_phone text;
begin
  v_email := coalesce(
    case
      when jsonb_typeof(NEW.emails) = 'array' and jsonb_array_length(NEW.emails) > 0
      then nullif(trim(both from (NEW.emails->>0)), '')
      else null
    end,
    ''
  );

  v_phone := case
    when jsonb_typeof(NEW.phones) = 'array' and jsonb_array_length(NEW.phones) > 0
    then nullif(trim(both from (NEW.phones->>0)), '')
    else null
  end;

  if not exists (select 1 from public.creativos_clientes cc where cc.credito_client_id = NEW.id) then
    insert into public.creativos_clientes (credito_client_id, name, company, email, phone, contact_name)
    values (NEW.id, NEW.name, coalesce(NEW.biz, ''), v_email, v_phone, NEW.name);
  end if;

  update public.creativos_clientes
  set
    name = NEW.name,
    company = coalesce(NEW.biz, ''),
    email = v_email,
    phone = v_phone,
    contact_name = NEW.name
  where credito_client_id = NEW.id;

  if not exists (select 1 from public.tareas_clientes tc where tc.credito_client_id = NEW.id) then
    insert into public.tareas_clientes (nombre, contacto_nombre, email, telefono, credito_client_id, avatar_url)
    values (NEW.name, NEW.name, v_email, v_phone, NEW.id, NEW.avatar_url);
  end if;

  update public.tareas_clientes
  set
    nombre = NEW.name,
    contacto_nombre = NEW.name,
    email = v_email,
    telefono = v_phone,
    avatar_url = NEW.avatar_url
  where credito_client_id = NEW.id;

  return NEW;
end;
$$;

drop trigger if exists trg_clientes_sync_creativos_tareas on public.clientes;
create trigger trg_clientes_sync_creativos_tareas
  after insert or update on public.clientes
  for each row
  execute function public.sync_cliente_creativos_tareas_from_credito();

comment on function public.sync_cliente_creativos_tareas_from_credito() is
  'Crea o actualiza filas en creativos_clientes y tareas_clientes ligadas a public.clientes (credito_client_id).';

-- Backfill: clientes sin fila enlazada (misma lógica que 016, con teléfono y avatar en Pendientes).
insert into public.creativos_clientes (credito_client_id, name, company, email, phone, contact_name)
select
  c.id,
  c.name,
  coalesce(c.biz, ''),
  coalesce(
    case
      when jsonb_typeof(c.emails) = 'array' and jsonb_array_length(c.emails) > 0
      then nullif(trim(both from (c.emails->>0)), '')
      else null
    end,
    ''
  ),
  case
    when jsonb_typeof(c.phones) = 'array' and jsonb_array_length(c.phones) > 0
    then nullif(trim(both from (c.phones->>0)), '')
    else null
  end,
  c.name
from public.clientes c
where not exists (
  select 1 from public.creativos_clientes cc where cc.credito_client_id = c.id
);

insert into public.tareas_clientes (nombre, contacto_nombre, email, telefono, credito_client_id, avatar_url)
select
  c.name,
  c.name,
  coalesce(
    case
      when jsonb_typeof(c.emails) = 'array' and jsonb_array_length(c.emails) > 0
      then nullif(trim(both from (c.emails->>0)), '')
      else null
    end,
    ''
  ),
  case
    when jsonb_typeof(c.phones) = 'array' and jsonb_array_length(c.phones) > 0
    then nullif(trim(both from (c.phones->>0)), '')
    else null
  end,
  c.id,
  c.avatar_url
from public.clientes c
where not exists (
  select 1 from public.tareas_clientes tc where tc.credito_client_id = c.id
);

-- Propagar datos actuales de Crédito a filas ya existentes (nombre, email, empresa, foto, teléfono).
update public.creativos_clientes cc
set
  name = c.name,
  company = coalesce(c.biz, ''),
  email = coalesce(
    case
      when jsonb_typeof(c.emails) = 'array' and jsonb_array_length(c.emails) > 0
      then nullif(trim(both from (c.emails->>0)), '')
      else null
    end,
    ''
  ),
  phone = case
    when jsonb_typeof(c.phones) = 'array' and jsonb_array_length(c.phones) > 0
    then nullif(trim(both from (c.phones->>0)), '')
    else null
  end,
  contact_name = c.name
from public.clientes c
where cc.credito_client_id = c.id;

update public.tareas_clientes tc
set
  nombre = c.name,
  contacto_nombre = c.name,
  email = coalesce(
    case
      when jsonb_typeof(c.emails) = 'array' and jsonb_array_length(c.emails) > 0
      then nullif(trim(both from (c.emails->>0)), '')
      else null
    end,
    ''
  ),
  telefono = case
    when jsonb_typeof(c.phones) = 'array' and jsonb_array_length(c.phones) > 0
    then nullif(trim(both from (c.phones->>0)), '')
    else null
  end,
  avatar_url = c.avatar_url
from public.clientes c
where tc.credito_client_id = c.id;
