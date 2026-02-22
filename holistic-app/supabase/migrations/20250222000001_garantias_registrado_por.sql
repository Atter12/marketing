-- Quién y cuándo registró la garantía
ALTER TABLE garantias
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE garantias
ADD COLUMN IF NOT EXISTS created_by TEXT;

COMMENT ON COLUMN garantias.created_at IS 'Fecha y hora en que se registró la garantía';
COMMENT ON COLUMN garantias.created_by IS 'Email del usuario que registró la garantía';
