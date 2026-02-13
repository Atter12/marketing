-- Foto de perfil por cliente (gerente la asigna; cliente puede actualizar la suya)
alter table public.clientes add column if not exists avatar_url text;
comment on column public.clientes.avatar_url is 'URL de la foto de perfil del cliente';

-- Cliente puede actualizar su propio registro (ej. para cambiar su foto)
drop policy if exists "Cliente update own" on public.clientes;
create policy "Cliente update own" on public.clientes for update
  using (id = public.my_client_id())
  with check (id = public.my_client_id());
