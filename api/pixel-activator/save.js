// API Endpoint: /api/pixel-activator/save
// Método: POST
// Descripción: Guarda o actualiza un pixel en Supabase

import { getSupabaseClient } from './supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { platform, pixelId, name, metadata, userId } = req.body;

        // Validaciones
        if (!platform) {
            return res.status(400).json({ success: false, error: 'Plataforma es requerida' });
        }

        if (!['facebook', 'tiktok', 'google'].includes(platform)) {
            return res.status(400).json({ success: false, error: 'Plataforma inválida. Debe ser: facebook, tiktok o google' });
        }

        if (!pixelId || pixelId.trim() === '') {
            return res.status(400).json({ success: false, error: 'Pixel ID es requerido' });
        }

        // Validar formato según plataforma
        if (platform === 'facebook' && !/^\d{15,16}$/.test(pixelId)) {
            return res.status(400).json({ success: false, error: 'Facebook Pixel ID debe ser un número de 15-16 dígitos' });
        }

        if (platform === 'google') {
            if (!/^(G-[A-Z0-9]+|GTM-[A-Z0-9]+|AW-\d+)$/i.test(pixelId)) {
                return res.status(400).json({ success: false, error: 'Google ID debe tener formato G-XXX, GTM-XXX o AW-XXX' });
            }
        }

        // Conectar a Supabase
        const supabase = getSupabaseClient();

        // Verificar si ya existe un pixel con la misma plataforma e ID
        const { data: existingPixel, error: checkError } = await supabase
            .from('pixels')
            .select('id, name, metadata')
            .eq('platform', platform)
            .eq('pixel_id', pixelId.trim())
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking existing pixel:', checkError);
            return res.status(500).json({ 
                success: false, 
                error: 'Error al verificar pixel existente' 
            });
        }

        const pixelData = {
            platform,
            pixel_id: pixelId.trim(),
            name: name || `${platform.charAt(0).toUpperCase() + platform.slice(1)} Pixel`,
            user_id: userId || null,
            is_active: true,
            metadata: metadata || {}
        };

        let result;

        if (existingPixel) {
            // Actualizar pixel existente
            const { data, error } = await supabase
                .from('pixels')
                .update({
                    name: pixelData.name,
                    metadata: pixelData.metadata,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingPixel.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating pixel:', error);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Error al actualizar el pixel' 
                });
            }

            result = data;
        } else {
            // Insertar nuevo pixel
            const { data, error } = await supabase
                .from('pixels')
                .insert(pixelData)
                .select()
                .single();

            if (error) {
                console.error('Error inserting pixel:', error);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Error al guardar el pixel' 
                });
            }

            result = data;
        }

        // Retornar respuesta exitosa
        return res.status(200).json({
            success: true,
            data: {
                id: result.id,
                platform: result.platform,
                pixelId: result.pixel_id,
                name: result.name,
                metadata: result.metadata,
                createdAt: result.created_at,
                updatedAt: result.updated_at,
                isActive: result.is_active
            }
        });

    } catch (error) {
        console.error('Error en save pixel:', error);
        
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
