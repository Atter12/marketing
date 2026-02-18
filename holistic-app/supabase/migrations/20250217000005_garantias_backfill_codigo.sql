-- Rellena código de verificación en garantías que no lo tienen (registros antiguos)
UPDATE garantias
SET codigo_verificacion = 'GV-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 9))
WHERE codigo_verificacion IS NULL OR TRIM(codigo_verificacion) = '';
