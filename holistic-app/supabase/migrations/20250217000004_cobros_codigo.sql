-- Código de cobro (hoja de ruta 4): código único por cobro
ALTER TABLE cobros
  ADD COLUMN IF NOT EXISTS codigo text;

COMMENT ON COLUMN cobros.codigo IS 'Código único del cobro (generado automáticamente).';
