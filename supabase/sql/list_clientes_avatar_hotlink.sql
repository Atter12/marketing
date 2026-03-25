-- Ejecutar manualmente en Supabase SQL Editor (no es migración automática).
-- Clientes cuyo avatar_url suele fallar al mostrarse (403) fuera de WhatsApp/Meta.

SELECT id, codigo, name, avatar_url
FROM public.clientes
WHERE avatar_url IS NOT NULL
  AND btrim(avatar_url) <> ''
  AND (
    lower(avatar_url) LIKE '%whatsapp.net%'
    OR lower(avatar_url) LIKE '%fbcdn.net%'
    OR lower(avatar_url) LIKE '%cdninstagram.com%'
  )
ORDER BY name;

-- Opcional: dejar sin URL para forzar re-subida desde Crédito (Editar cliente → Cambiar foto).
-- Revisá el SELECT antes. Descomentá solo si querés limpiar masivamente.
--
-- UPDATE public.clientes
-- SET avatar_url = NULL
-- WHERE avatar_url IS NOT NULL
--   AND (
--     lower(avatar_url) LIKE '%whatsapp.net%'
--     OR lower(avatar_url) LIKE '%fbcdn.net%'
--     OR lower(avatar_url) LIKE '%cdninstagram.com%'
--   );
