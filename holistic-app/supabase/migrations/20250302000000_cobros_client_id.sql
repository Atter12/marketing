  -- Cobros sin asignar gasto: guardar cliente para mostrar en la tabla
  ALTER TABLE cobros
    ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

  COMMENT ON COLUMN cobros.client_id IS 'Cliente del cobro cuando no está asignado a un gasto (gasto_id NULL).';

  CREATE INDEX IF NOT EXISTS idx_cobros_client_id ON cobros(client_id) WHERE client_id IS NOT NULL;

  -- Cliente puede ver cobros suyos sin asignar (client_id = my_client_id())
  DROP POLICY IF EXISTS "Cliente ver sus cobros" ON public.cobros;
  CREATE POLICY "Cliente ver sus cobros" ON public.cobros FOR SELECT
    USING (
      gasto_id IN (SELECT id FROM public.gastos WHERE client_id = public.my_client_id())
      OR (client_id = public.my_client_id())
    );

  -- Comprobante: cliente puede ver si el cobro es suyo por gasto o por client_id
  CREATE OR REPLACE FUNCTION public.comprobante_cobro_visible(p_cobro_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
    SELECT public.is_gerente()
      OR EXISTS (
        SELECT 1 FROM public.cobros c
        LEFT JOIN public.gastos g ON g.id = c.gasto_id
        WHERE c.id = p_cobro_id
          AND (g.client_id = public.my_client_id() OR c.client_id = public.my_client_id())
      );
  $$;
