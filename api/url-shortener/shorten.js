// API Endpoint: /api/url-shortener/shorten
// Método: POST
// Descripción: Acorta una URL y la guarda en Supabase

import { getSupabaseClient, generateUniqueAlias } from './supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { originalUrl, customAlias, userId, expiresAt } = req.body;

        // Validaciones
        if (!originalUrl) {
            return res.status(400).json({ success: false, error: 'URL original es requerida' });
        }

        // Validar formato de URL
        try {
            const url = new URL(originalUrl);
            // Validar que sea http o https
            if (!['http:', 'https:'].includes(url.protocol)) {
                return res.status(400).json({ success: false, error: 'URL debe usar HTTP o HTTPS' });
            }
        } catch {
            return res.status(400).json({ success: false, error: 'URL inválida' });
        }

        // Validar alias si se proporciona
        if (customAlias) {
            if (!/^[a-zA-Z0-9-_]+$/.test(customAlias)) {
                return res.status(400).json({ success: false, error: 'Alias inválido. Solo letras, números, guiones y guiones bajos' });
            }
            if (customAlias.length > 100) {
                return res.status(400).json({ success: false, error: 'El alias no puede tener más de 100 caracteres' });
            }
        }

        // Conectar a Supabase
        const supabase = getSupabaseClient();

        // Generar alias único
        let alias;
        try {
            alias = await generateUniqueAlias(customAlias || null);
        } catch (error) {
            if (error.message.includes('ya está en uso')) {
                return res.status(409).json({ success: false, error: error.message });
            }
            throw error;
        }

        // Preparar datos para insertar
        const shortUrlData = {
            alias,
            original_url: originalUrl,
            user_id: userId || null,
            expires_at: expiresAt || null,
            clicks: 0,
            qr_scans: 0,
            is_active: true,
            metadata: {}
        };

        // Insertar en Supabase
        const { data, error } = await supabase
            .from('short_urls')
            .insert(shortUrlData)
            .select()
            .single();

        if (error) {
            console.error('Error inserting into Supabase:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Error al guardar la URL en la base de datos' 
            });
        }

        // Construir URL corta
        const domain = process.env.SHORT_DOMAIN || req.headers.host || 'tudominio.com';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const fullShortUrl = `${protocol}://${domain}/${alias}`;

        // Retornar respuesta exitosa
        return res.status(200).json({
            success: true,
            data: {
                shortUrl: fullShortUrl,
                alias: data.alias,
                originalUrl: data.original_url,
                createdAt: data.created_at,
                expiresAt: data.expires_at,
                clicks: data.clicks,
                qrScans: data.qr_scans
            }
        });

    } catch (error) {
        console.error('Error en shorten:', error);
        
        // Si es error de configuración de Supabase
        if (error.message.includes('Supabase credentials')) {
            return res.status(500).json({ 
                success: false, 
                error: 'Error de configuración del servidor. Contacta al administrador.' 
            });
        }
        
        return res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor' 
        });
    }
}
