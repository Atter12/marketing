// API Endpoint: /api/url-shortener/shorten
// Método: POST
// Descripción: Acorta una URL y la guarda en la base de datos

/**
 * Estructura del Request:
 * {
 *   "originalUrl": "https://ejemplo.com/pagina-muy-larga",
 *   "customAlias": "mi-link" (opcional),
 *   "userId": "user123" (opcional, para tracking)
 * }
 * 
 * Estructura del Response (éxito):
 * {
 *   "success": true,
 *   "data": {
 *     "shortUrl": "https://tudominio.com/abc123",
 *     "alias": "abc123",
 *     "originalUrl": "https://ejemplo.com/pagina-muy-larga",
 *     "createdAt": "2024-01-15T10:30:00Z",
 *     "expiresAt": null, // o fecha si tiene expiración
 *     "clicks": 0,
 *     "qrScans": 0
 *   }
 * }
 * 
 * Estructura del Response (error):
 * {
 *   "success": false,
 *   "error": "Mensaje de error"
 * }
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { originalUrl, customAlias, userId } = req.body;

        // Validaciones
        if (!originalUrl) {
            return res.status(400).json({ success: false, error: 'URL original es requerida' });
        }

        // Validar formato de URL
        try {
            new URL(originalUrl);
        } catch {
            return res.status(400).json({ success: false, error: 'URL inválida' });
        }

        // Validar alias si se proporciona
        if (customAlias && !/^[a-zA-Z0-9-_]+$/.test(customAlias)) {
            return res.status(400).json({ success: false, error: 'Alias inválido. Solo letras, números, guiones y guiones bajos' });
        }

        // TODO: Implementar lógica de base de datos
        // 1. Verificar si el alias ya existe (si se proporciona)
        // 2. Generar alias aleatorio si no se proporciona
        // 3. Guardar en base de datos (MongoDB, PostgreSQL, etc.)
        // 4. Retornar la URL acortada

        // Ejemplo de implementación:
        /*
        const db = await connectToDatabase();
        
        let alias = customAlias;
        if (!alias) {
            // Generar alias único
            do {
                alias = generateRandomAlias();
            } while (await db.collection('shortUrls').findOne({ alias }));
        } else {
            // Verificar que no exista
            const existing = await db.collection('shortUrls').findOne({ alias });
            if (existing) {
                return res.status(409).json({ 
                    success: false, 
                    error: 'Este alias ya está en uso' 
                });
            }
        }

        // Guardar en base de datos
        const shortUrl = {
            alias,
            originalUrl,
            userId: userId || null,
            createdAt: new Date(),
            expiresAt: null, // o calcular expiración
            clicks: 0,
            qrScans: 0,
            analytics: []
        };

        await db.collection('shortUrls').insertOne(shortUrl);

        const domain = process.env.SHORT_DOMAIN || 'tudominio.com';
        const fullShortUrl = `https://${domain}/${alias}`;

        return res.status(200).json({
            success: true,
            data: {
                shortUrl: fullShortUrl,
                alias,
                originalUrl,
                createdAt: shortUrl.createdAt,
                expiresAt: shortUrl.expiresAt,
                clicks: 0,
                qrScans: 0
            }
        });
        */

        // Por ahora, respuesta de ejemplo
        return res.status(501).json({ 
            success: false, 
            error: 'Backend no implementado aún. Esta es solo la estructura preparada.' 
        });

    } catch (error) {
        console.error('Error en shorten:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor' 
        });
    }
}

// Función helper para generar alias aleatorio
function generateRandomAlias(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
