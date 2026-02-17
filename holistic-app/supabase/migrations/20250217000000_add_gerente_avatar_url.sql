-- Foto de perfil del gerente (hoja de ruta 1)
-- Ejecutar en el SQL Editor de Supabase si la columna no existe.

ALTER TABLE gerentes
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Opcional: permitir que el gerente actualice solo su fila (RLS)
-- Si ya tienes políticas, asegúrate de que UPDATE en gerentes permita
-- actualizar la fila donde email = auth.jwt() ->> 'email'.

COMMENT ON COLUMN gerentes.avatar_url IS 'URL pública de la foto de perfil del gerente (bucket avatars).';
