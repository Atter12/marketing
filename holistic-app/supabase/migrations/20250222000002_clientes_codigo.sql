-- Código único por cliente (ej. CL-ABC12X)
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS codigo TEXT;

-- Rellena códigos en clientes que no lo tienen (hash del id = único por cliente)
UPDATE clientes
SET codigo = 'CL-' || UPPER(SUBSTRING(MD5(id::text) FROM 1 FOR 6))
WHERE codigo IS NULL OR TRIM(codigo) = '';

COMMENT ON COLUMN clientes.codigo IS 'Código único del cliente (ej. CL-ABC12X)';
