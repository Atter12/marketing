-- Tickets: creador (email), adjuntos de solicitud/resolución, SLA en minutos; Kanban: vínculo a ticket.

alter table public.tareas_tickets
  add column if not exists creado_por_email text,
  add column if not exists adjuntos_solicitud jsonb default '[]'::jsonb,
  add column if not exists adjuntos_resolucion jsonb default '[]'::jsonb,
  add column if not exists resolucion_detalle text,
  add column if not exists sla_minutos int;

comment on column public.tareas_tickets.creado_por_email is 'Email del usuario que creó el ticket (sesión Supabase).';
comment on column public.tareas_tickets.adjuntos_solicitud is 'JSON [{path, file_name}] en bucket tareas_adjuntos.';
comment on column public.tareas_tickets.adjuntos_resolucion is 'JSON [{path, file_name}] evidencia al resolver.';
comment on column public.tareas_tickets.sla_minutos is 'Plazo desde creación; sla_vencimiento debe coincidir.';

alter table public.tareas_kanban
  add column if not exists ticket_id uuid references public.tareas_tickets(id) on delete set null;

create index if not exists idx_tareas_kanban_ticket_id on public.tareas_kanban(ticket_id);

-- Bucket privado para capturas de tickets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tareas_adjuntos',
  'tareas_adjuntos',
  false,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do nothing;

drop policy if exists "Gerente select tareas_adjuntos" on storage.objects;
create policy "Gerente select tareas_adjuntos"
  on storage.objects for select to authenticated
  using (bucket_id = 'tareas_adjuntos' and public.is_gerente());

drop policy if exists "Gerente insert tareas_adjuntos" on storage.objects;
create policy "Gerente insert tareas_adjuntos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tareas_adjuntos' and public.is_gerente());

drop policy if exists "Gerente update tareas_adjuntos" on storage.objects;
create policy "Gerente update tareas_adjuntos"
  on storage.objects for update to authenticated
  using (bucket_id = 'tareas_adjuntos' and public.is_gerente());

drop policy if exists "Gerente delete tareas_adjuntos" on storage.objects;
create policy "Gerente delete tareas_adjuntos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tareas_adjuntos' and public.is_gerente());
