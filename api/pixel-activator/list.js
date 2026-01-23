// API Endpoint: /api/pixel-activator/list
// Método: GET
// Descripción: Lista todos los pixels guardados

import { getSupabaseClient } from './supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { platform, userId } = req.query;

        // Conectar a Supabase
        const supabase = getSupabaseClient();

        // Construir query
        let query = supabase
            .from('pixels')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        // Filtrar por plataforma si se proporciona
        if (platform && ['facebook', 'tiktok', 'google'].includes(platform)) {
            query = query.eq('platform', platform);
        }

        // Filtrar por usuario si se proporciona
        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error listing pixels:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Error al listar los pixels' 
            });
        }

        // Formatear respuesta
        const pixels = (data || []).map(pixel => ({
            id: pixel.id,
            platform: pixel.platform,
            pixelId: pixel.pixel_id,
            name: pixel.name,
            metadata: pixel.metadata,
            createdAt: pixel.created_at,
            updatedAt: pixel.updated_at,
            isActive: pixel.is_active
        }));

        return res.status(200).json({
            success: true,
            data: pixels,
            count: pixels.length
        });

    } catch (error) {
        console.error('Error en list pixels:', error);
        
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
