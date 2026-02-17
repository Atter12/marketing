-- Fechas y períodos (hoja de ruta 3)
-- Fecha de movimiento: fecha completa (dd/mm/aaaa)
-- Período (mes): mm/aaaa — se mantiene en columna mes

ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS fecha_movimiento date;

-- Para registros existentes: usar mes + día 15 como fecha_movimiento
UPDATE gastos
  SET fecha_movimiento = (mes || '-15')::date
  WHERE fecha_movimiento IS NULL AND mes IS NOT NULL AND length(mes) >= 7;

COMMENT ON COLUMN gastos.fecha_movimiento IS 'Fecha completa de movimiento (dd/mm/aaaa). El período mm/aaaa está en mes.';
