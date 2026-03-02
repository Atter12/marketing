-- Permitir cobros sin asignar a un gasto (opción "Ninguna" en Registrar Cobro)
ALTER TABLE cobros
  ALTER COLUMN gasto_id DROP NOT NULL;

COMMENT ON COLUMN cobros.gasto_id IS 'Gasto al que se aplica el cobro; NULL = cobro sin asignar (depósito general, etc.).';
