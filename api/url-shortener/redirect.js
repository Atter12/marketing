// API Endpoint: /api/url-shortener/redirect
// Método: GET
// Descripción: Redirige desde una URL acortada a la URL original y registra el click

import { getSupabaseClient, getLocationFromIP, detectDevice } from './supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { alias } = req.query;

        if (!alias) {
            return res.status(400).json({ success: false, error: 'Alias requerido' });
        }

        // Conectar a Supabase
        const supabase = getSupabaseClient();

        // Buscar la URL acortada
        const { data: shortUrl, error: fetchError } = await supabase
            .from('short_urls')
            .select('*')
            .eq('alias', alias)
            .eq('is_active', true)
            .single();

        if (fetchError || !shortUrl) {
            return res.status(404).json({ 
                success: false, 
                error: 'URL no encontrada' 
            });
        }

        // Verificar expiración
        if (shortUrl.expires_at) {
            const expiresAt = new Date(shortUrl.expires_at);
            if (expiresAt < new Date()) {
                // Marcar como inactivo
                await supabase
                    .from('short_urls')
                    .update({ is_active: false })
                    .eq('id', shortUrl.id);
                
                return res.status(410).json({ 
                    success: false, 
                    error: 'Este link ha expirado' 
                });
            }
        }

        // Obtener información del request
        const ipRaw = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                      req.headers['x-real-ip'] || 
                      req.connection?.remoteAddress || 
                      null;
        
        // Limpiar IP (remover puerto si existe)
        const ip = ipRaw ? ipRaw.split(':')[0] : null;
        const userAgent = req.headers['user-agent'] || '';
        const referer = req.headers['referer'] || req.headers['referrer'] || null;

        // Detectar dispositivo y ubicación (asíncrono, no bloquea redirección)
        Promise.all([
            getLocationFromIP(ip || ''),
            Promise.resolve(detectDevice(userAgent))
        ]).then(([location, deviceInfo]) => {
            const { device, browser, os } = deviceInfo;
            const { country, city } = location;

            // Registrar el click en analytics
            const analyticsData = {
                short_url_id: shortUrl.id,
                ip_address: ip || null,
                user_agent: userAgent || null,
                referer: referer || null,
                country: country || null,
                city: city || null,
                device_type: device || null,
                browser: browser || null,
                os: os || null
            };

            // Insertar analytics e incrementar clicks
            supabase
                .from('url_analytics')
                .insert(analyticsData)
                .then(() => {
                    // Incrementar contador de clicks
                    return supabase
                        .from('short_urls')
                        .update({ clicks: (shortUrl.clicks || 0) + 1 })
                        .eq('id', shortUrl.id);
                })
                .catch(err => {
                    console.error('Error registrando analytics:', err);
                });
        }).catch(err => {
            console.error('Error procesando analytics:', err);
        });

        // Redirigir inmediatamente
        return res.redirect(302, shortUrl.original_url);

    } catch (error) {
        console.error('Error en redirect:', error);
        
        if (error.message.includes('Supabase credentials')) {
            return res.status(500).json({ 
                success: false, 
                error: 'Error de configuración del servidor' 
            });
        }
        
        return res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor' 
        });
    }
}
