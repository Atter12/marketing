// API Endpoint: /api/url-shortener/stats
// Método: GET
// Descripción: Obtiene estadísticas de una URL acortada

import { getSupabaseClient } from './supabase.js';

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
            .single();

        if (fetchError || !shortUrl) {
            return res.status(404).json({ 
                success: false, 
                error: 'URL no encontrada' 
            });
        }

        // Obtener analytics
        const { data: analytics, error: analyticsError } = await supabase
            .from('url_analytics')
            .select('*')
            .eq('short_url_id', shortUrl.id)
            .order('clicked_at', { ascending: false })
            .limit(100);

        if (analyticsError) {
            console.error('Error fetching analytics:', analyticsError);
        }

        // Calcular top referrers
        const referrerMap = {};
        (analytics || []).forEach(click => {
            let source = 'direct';
            if (click.referer) {
                try {
                    const url = new URL(click.referer);
                    source = url.hostname.replace('www.', '');
                } catch {
                    source = click.referer;
                }
            }
            referrerMap[source] = (referrerMap[source] || 0) + 1;
        });

        const topReferrers = Object.entries(referrerMap)
            .map(([source, clicks]) => ({ source, clicks }))
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 10);

        // Clics por día
        const clicksByDayMap = {};
        (analytics || []).forEach(click => {
            const date = new Date(click.clicked_at).toISOString().split('T')[0];
            clicksByDayMap[date] = (clicksByDayMap[date] || 0) + 1;
        });

        const clicksByDay = Object.entries(clicksByDayMap)
            .map(([date, clicks]) => ({ date, clicks }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Clics por país
        const clicksByCountryMap = {};
        (analytics || []).forEach(click => {
            const country = click.country || 'unknown';
            clicksByCountryMap[country] = (clicksByCountryMap[country] || 0) + 1;
        });

        const clicksByCountry = Object.entries(clicksByCountryMap)
            .map(([country, clicks]) => ({ country, clicks }))
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 10);

        // Clics por dispositivo
        const clicksByDeviceMap = {};
        (analytics || []).forEach(click => {
            const device = click.device_type || 'unknown';
            clicksByDeviceMap[device] = (clicksByDeviceMap[device] || 0) + 1;
        });

        const clicksByDevice = Object.entries(clicksByDeviceMap)
            .map(([device, clicks]) => ({ device, clicks }));

        // Construir URL corta
        const domain = process.env.SHORT_DOMAIN || req.headers.host || 'tudominio.com';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const fullShortUrl = `${protocol}://${domain}/${alias}`;

        // Calcular días activo
        const createdAt = new Date(shortUrl.created_at);
        const daysActive = Math.floor((new Date() - createdAt) / (1000 * 60 * 60 * 24));

        return res.status(200).json({
            success: true,
            data: {
                alias: shortUrl.alias,
                originalUrl: shortUrl.original_url,
                shortUrl: fullShortUrl,
                clicks: shortUrl.clicks || 0,
                qrScans: shortUrl.qr_scans || 0,
                createdAt: shortUrl.created_at,
                expiresAt: shortUrl.expires_at,
                daysActive: daysActive,
                analytics: (analytics || []).slice(0, 100), // Últimos 100 clicks
                topReferrers,
                clicksByDay,
                clicksByCountry,
                clicksByDevice
            }
        });

    } catch (error) {
        console.error('Error en stats:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor' 
        });
    }
}
