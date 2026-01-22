// API Endpoint: /api/url-shortener/redirect
// Método: GET
// Descripción: Redirige desde una URL acortada a la URL original y registra el click

/**
 * Query Parameters:
 * - alias: El alias de la URL acortada (ej: "abc123")
 * 
 * Response:
 * - Redirección 302 a la URL original
 * - O 404 si el alias no existe
 * - O 410 si el link ha expirado
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
        // 2. Verificar si existe
        // 3. Verificar si ha expirado
        // 4. Registrar el click (analytics)
        // 5. Redirigir a la URL original

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

        // Verificar expiración
        if (shortUrl.expiresAt && new Date(shortUrl.expiresAt) < new Date()) {
            return res.status(410).json({ 
                success: false, 
                error: 'Este link ha expirado' 
            });
        }

        // Registrar click
        const clickData = {
            alias,
            timestamp: new Date(),
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            referer: req.headers['referer'] || null
        };

        await db.collection('shortUrls').updateOne(
            { alias },
            { 
                $inc: { clicks: 1 },
                $push: { analytics: clickData }
            }
        );

        // Redirigir
        return res.redirect(302, shortUrl.originalUrl);
        */

        // Por ahora, respuesta de ejemplo
        return res.status(501).json({ 
            success: false, 
            error: 'Backend no implementado aún. Esta es solo la estructura preparada.' 
        });

    } catch (error) {
        console.error('Error en redirect:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor' 
        });
    }
}
