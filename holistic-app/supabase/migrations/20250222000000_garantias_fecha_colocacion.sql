-- Fecha en que el cliente depositó la garantía (cuando se colocó)
ALTER TABLE garantias
ADD COLUMN IF NOT EXISTS fecha_colocacion DATE;

COMMENT ON COLUMN garantias.fecha_colocacion IS 'Fecha en que el cliente depositó/colocó la garantía';
