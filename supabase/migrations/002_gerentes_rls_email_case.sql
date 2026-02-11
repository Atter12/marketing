-- Ejecuta esto si el login “parece entrar” pero no pasa: ajusta RLS para que el email coincida sin importar mayúsculas.
drop policy if exists "Users can check if they are gerente" on public.gerentes;
create policy "Users can check if they are gerente"
  on public.gerentes for select
  using (lower(trim(auth.jwt()->>'email')) = lower(trim(email)));
