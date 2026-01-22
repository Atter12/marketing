// API Endpoint: /api/url-shortener/stats
// Método: GET
// Descripción: Obtiene estadísticas de una URL acortada

/**
 * Query Parameters:
 * - alias: El alias de la URL acortada
 * 
 * Response (éxito):
 * {
 *   "success": true,
 *   "data": {
 *     "alias": "abc123",
 *     "originalUrl": "https://ejemplo.com",
 *     "shortUrl": "https://tudominio.com/abc123",
 *     "clicks": 150,
 *     "qrScans": 25,
 *     "createdAt": "2024-01-15T10:30:00Z",
 *     "expiresAt": null,
 *     "analytics": [
 *       {
 *         "timestamp": "2024-01-15T11:00:00Z",
 *         "ip": "192.168.1.1",
 *         "userAgent": "Mozilla/5.0...",
 *         "referer": "https://facebook.com"
 *       }
 *     ],
 *     "topReferrers": [
 *       { "source": "facebook.com", "clicks": 50 },
 *       { "source": "twitter.com", "clicks": 30 }
 *     ],
 *     "clicksByDay": [
 *       { "date": "2024-01-15", "clicks": 20 },
 *       { "date": "2024-01-16", "clicks": 30 }
 *     ]
 *   }
 * }
 */

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { alias } = req.query;

        if (!alias) {
            return res.status(400).json({ success: false, error: 'Alias requerido' });
        }

        // TODO: Implementar lógica de base de datos
        // 1. Buscar el alias en la base de datos
        // 2. Calcular estadísticas agregadas
        // 3. Agrupar por referrers, fechas, etc.
        // 4. Retornar datos formateados

        // Ejemplo de implementación:
        /*
        const db = await connectToDatabase();
        
        const shortUrl = await db.collection('shortUrls').findOne({ alias });
        
        if (!shortUrl) {
            return res.status(404).json({ 
                success: false, 
                error: 'URL no encontrada' 
            });
        }

        // Calcular estadísticas
        const analytics = shortUrl.analytics || [];
        
        // Top referrers
        const referrerMap = {};
        analytics.forEach(click => {
            const source = click.referer ? new URL(click.referer).hostname : 'direct';
            referrerMap[source] = (referrerMap[source] || 0) + 1;
        });
        
        const topReferrers = Object.entries(referrerMap)
            .map(([source, clicks]) => ({ source, clicks }))
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 10);

        // Clics por día
        const clicksByDayMap = {};
        analytics.forEach(click => {
            const date = new Date(click.timestamp).toISOString().split('T')[0];
            clicksByDayMap[date] = (clicksByDayMap[date] || 0) + 1;
        });
        
        const clicksByDay = Object.entries(clicksByDayMap)
            .map(([date, clicks]) => ({ date, clicks }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const domain = process.env.SHORT_DOMAIN || 'tudominio.com';
        const fullShortUrl = `https://${domain}/${alias}`;

        return res.status(200).json({
            success: true,
            data: {
                alias: shortUrl.alias,
                originalUrl: shortUrl.originalUrl,
                shortUrl: fullShortUrl,
                clicks: shortUrl.clicks || 0,
                qrScans: shortUrl.qrScans || 0,
                createdAt: shortUrl.createdAt,
                expiresAt: shortUrl.expiresAt,
                analytics: analytics.slice(-100), // Últimos 100 clicks
                topReferrers,
                clicksByDay
            }
        });
        */

        // Por ahora, respuesta de ejemplo
        return res.status(501).json({ 
            success: false, 
            error: 'Backend no implementado aún. Esta es solo la estructura preparada.' 
        });

    } catch (error) {
        console.error('Error en stats:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor' 
        });
    }
}
