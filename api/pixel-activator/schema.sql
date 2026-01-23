-- Schema para Pixel Activator en Supabase
-- Ejecutar este SQL en el SQL Editor de Supabase

-- Tabla principal de pixels guardados
CREATE TABLE IF NOT EXISTS pixels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform VARCHAR(50) NOT NULL, -- 'facebook', 'tiktok', 'google'
    pixel_id VARCHAR(255) NOT NULL, -- El ID del pixel
    name VARCHAR(255), -- Nombre personalizado del pixel
    user_id UUID, -- Opcional, para usuarios autenticados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb -- Para datos adicionales (eventos configurados, etc.)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pixels_platform ON pixels(platform);
CREATE INDEX IF NOT EXISTS idx_pixels_user_id ON pixels(user_id);
CREATE INDEX IF NOT EXISTS idx_pixels_created_at ON pixels(created_at);
CREATE INDEX IF NOT EXISTS idx_pixels_pixel_id ON pixels(pixel_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_pixels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_pixels_updated_at_trigger
    BEFORE UPDATE ON pixels
    FOR EACH ROW
    EXECUTE FUNCTION update_pixels_updated_at();

-- Política RLS (Row Level Security)
ALTER TABLE pixels ENABLE ROW LEVEL SECURITY;

-- Política: Cualquiera puede leer pixels activos
CREATE POLICY "Public can read active pixels"
    ON pixels FOR SELECT
    USING (is_active = true);

-- Política: Cualquiera puede insertar pixels
CREATE POLICY "Public can insert pixels"
    ON pixels FOR INSERT
    WITH CHECK (true);

-- Política: Cualquiera puede actualizar sus propios pixels (por ahora permitimos todos)
CREATE POLICY "Public can update pixels"
    ON pixels FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Política: Cualquiera puede eliminar pixels
CREATE POLICY "Public can delete pixels"
    ON pixels FOR DELETE
    USING (true);

-- Comentarios para documentación
COMMENT ON TABLE pixels IS 'Almacena los pixels configurados (Facebook, TikTok, Google)';
COMMENT ON COLUMN pixels.platform IS 'Plataforma: facebook, tiktok, google';
COMMENT ON COLUMN pixels.pixel_id IS 'ID del pixel (ej: 123456789012345 para Facebook, G-XXXXXXXXXX para GA4)';
COMMENT ON COLUMN pixels.metadata IS 'JSON con datos adicionales como eventos configurados';
