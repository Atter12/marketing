// API Endpoint: /api/pixel-activator/get
// Método: GET
// Descripción: Obtiene un pixel específico por ID

import { getSupabaseClient } from './supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, error: 'ID del pixel es requerido' });
        }

        // Conectar a Supabase
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('pixels')
            .select('*')
            .eq('id', id)
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            console.error('Error getting pixel:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Error al obtener el pixel' 
            });
        }

        if (!data) {
            return res.status(404).json({ 
                success: false, 
                error: 'Pixel no encontrado' 
            });
        }

        // Formatear respuesta
        return res.status(200).json({
            success: true,
            data: {
                id: data.id,
                platform: data.platform,
                pixelId: data.pixel_id,
                name: data.name,
                metadata: data.metadata,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
                isActive: data.is_active
            }
        });

    } catch (error) {
        console.error('Error en get pixel:', error);
        
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
