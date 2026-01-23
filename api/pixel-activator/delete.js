// API Endpoint: /api/pixel-activator/delete
// Método: DELETE
// Descripción: Elimina un pixel (soft delete)

import { getSupabaseClient } from './supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, error: 'ID del pixel es requerido' });
        }

        // Conectar a Supabase
        const supabase = getSupabaseClient();

        // Soft delete: marcar como inactivo
        const { data, error } = await supabase
            .from('pixels')
            .update({ 
                is_active: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error deleting pixel:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Error al eliminar el pixel' 
            });
        }

        if (!data) {
            return res.status(404).json({ 
                success: false, 
                error: 'Pixel no encontrado' 
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Pixel eliminado correctamente'
        });

    } catch (error) {
        console.error('Error en delete pixel:', error);
        
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
