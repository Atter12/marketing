-- Dar acceso al cliente (hoja de ruta 2): upsert por email en clientes_acceso
-- La Edge Function dar-acceso-cliente hace upsert con onConflict: "email".
-- Ejecutar en Supabase si la tabla no tiene restricción unique en email.

ALTER TABLE clientes_acceso
  ADD CONSTRAINT clientes_acceso_email_key UNIQUE (email);
-- Si ya existe la constraint, ignorar el error o usar: CREATE UNIQUE INDEX IF NOT EXISTS ...
