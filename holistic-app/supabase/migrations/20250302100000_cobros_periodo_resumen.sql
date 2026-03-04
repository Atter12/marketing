-- Período para resumen: mes (YYYY-MM) en que cuenta el cobro en reportes cuando no coincide con la fecha de pago (cobros sin asignar).
ALTER TABLE cobros
  ADD COLUMN IF NOT EXISTS periodo_resumen text;

COMMENT ON COLUMN cobros.periodo_resumen IS 'Mes YYYY-MM en que el cobro cuenta en el resumen del cliente. Si NULL, se usa la fecha del cobro.';
