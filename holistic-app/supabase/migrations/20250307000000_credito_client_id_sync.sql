-- Sincronización clientes Crédito → Creativos y Tareas (Opción A).
-- Fuente de verdad: public.clientes.
-- Si las tablas creativos/tareas están en el mismo proyecto, ejecutar esta migración allí
-- o aplicar el contenido de supabase/migrations/016_credito_client_id_sync.sql en el proyecto compartido.

alter table public.creativos_clientes
  add column if not exists credito_client_id uuid references public.clientes(id) on delete set null;
create index if not exists idx_creativos_clientes_credito_client_id on public.creativos_clientes(credito_client_id);

alter table public.tareas_clientes
  add column if not exists credito_client_id uuid references public.clientes(id) on delete set null;
create index if not exists idx_tareas_clientes_credito_client_id on public.tareas_clientes(credito_client_id);

insert into public.creativos_clientes (credito_client_id, name, company, email)
select c.id, c.name, coalesce(c.biz, ''), coalesce(case when jsonb_typeof(c.emails) = 'array' and jsonb_array_length(c.emails) > 0 then c.emails->>0 else null end, '')
from public.clientes c
where not exists (select 1 from public.creativos_clientes cc where cc.credito_client_id = c.id);

insert into public.tareas_clientes (nombre, contacto_nombre, email, credito_client_id)
select c.name, c.name, coalesce(case when jsonb_typeof(c.emails) = 'array' and jsonb_array_length(c.emails) > 0 then c.emails->>0 else null end, ''), c.id
from public.clientes c
where not exists (select 1 from public.tareas_clientes tc where tc.credito_client_id = c.id);
