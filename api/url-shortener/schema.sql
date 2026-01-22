-- Schema para Acortador de Links en Supabase
-- Ejecutar este SQL en el SQL Editor de Supabase

-- Tabla principal de URLs acortadas
CREATE TABLE IF NOT EXISTS short_urls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alias VARCHAR(100) UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    user_id UUID, -- Opcional, para usuarios autenticados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Opcional, para links con expiración
    clicks INTEGER DEFAULT 0,
    qr_scans INTEGER DEFAULT 0,
    password_hash TEXT, -- Opcional, para links protegidos con contraseña
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb -- Para datos adicionales (píxeles, etc.)
);

-- Tabla de analytics (clicks)
CREATE TABLE IF NOT EXISTS url_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    short_url_id UUID REFERENCES short_urls(id) ON DELETE CASCADE,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    referer TEXT,
    country VARCHAR(2), -- Código de país ISO
    city VARCHAR(100),
    device_type VARCHAR(50), -- mobile, desktop, tablet
    browser VARCHAR(100),
    os VARCHAR(100)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_short_urls_alias ON short_urls(alias);
CREATE INDEX IF NOT EXISTS idx_short_urls_user_id ON short_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_short_urls_created_at ON short_urls(created_at);
CREATE INDEX IF NOT EXISTS idx_short_urls_expires_at ON short_urls(expires_at);
CREATE INDEX IF NOT EXISTS idx_url_analytics_short_url_id ON url_analytics(short_url_id);
CREATE INDEX IF NOT EXISTS idx_url_analytics_clicked_at ON url_analytics(clicked_at);

-- Función para incrementar clicks automáticamente
CREATE OR REPLACE FUNCTION increment_url_clicks(url_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE short_urls
    SET clicks = clicks + 1
    WHERE id = url_id;
END;
$$ LANGUAGE plpgsql;

-- Función para incrementar QR scans
CREATE OR REPLACE FUNCTION increment_qr_scans(url_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE short_urls
    SET qr_scans = qr_scans + 1
    WHERE id = url_id;
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar links expirados (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_expired_urls()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE short_urls
    SET is_active = false
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW()
      AND is_active = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Política RLS (Row Level Security) - Permitir lectura pública
ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_analytics ENABLE ROW LEVEL SECURITY;

-- Política: Cualquiera puede leer URLs activas
CREATE POLICY "Public can read active short URLs"
    ON short_urls FOR SELECT
    USING (is_active = true);

-- Política: Cualquiera puede insertar analytics
CREATE POLICY "Public can insert analytics"
    ON url_analytics FOR INSERT
    WITH CHECK (true);

-- Política: Solo el servicio puede insertar/actualizar URLs (usar service_role key)
-- Esta política se aplica cuando usas el service_role_key en el backend

-- Vista para estadísticas agregadas
CREATE OR REPLACE VIEW url_stats AS
SELECT 
    s.id,
    s.alias,
    s.original_url,
    s.clicks,
    s.qr_scans,
    s.created_at,
    s.expires_at,
    COUNT(DISTINCT a.id) as total_clicks,
    COUNT(DISTINCT CASE WHEN a.clicked_at >= NOW() - INTERVAL '24 hours' THEN a.id END) as clicks_24h,
    COUNT(DISTINCT CASE WHEN a.clicked_at >= NOW() - INTERVAL '7 days' THEN a.id END) as clicks_7d,
    COUNT(DISTINCT CASE WHEN a.clicked_at >= NOW() - INTERVAL '30 days' THEN a.id END) as clicks_30d
FROM short_urls s
LEFT JOIN url_analytics a ON s.id = a.short_url_id
GROUP BY s.id, s.alias, s.original_url, s.clicks, s.qr_scans, s.created_at, s.expires_at;

-- Comentarios para documentación
COMMENT ON TABLE short_urls IS 'Almacena las URLs acortadas';
COMMENT ON TABLE url_analytics IS 'Almacena los clicks y analytics de cada URL';
COMMENT ON COLUMN short_urls.alias IS 'Alias único de la URL (ej: abc123)';
COMMENT ON COLUMN short_urls.metadata IS 'JSON con datos adicionales como píxeles de seguimiento';
