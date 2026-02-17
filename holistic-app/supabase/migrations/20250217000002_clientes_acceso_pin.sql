-- Guardar la contraseña generada para que el gerente pueda verla siempre al abrir "Dar acceso"
ALTER TABLE clientes_acceso
  ADD COLUMN IF NOT EXISTS pin text;

COMMENT ON COLUMN clientes_acceso.pin IS 'Contraseña generada por el sistema; el gerente la ve al abrir Dar acceso.';
