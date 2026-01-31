// API: GET /api/profit-calculator/get?id=xxx — Obtiene un cálculo por ID

import { getSupabaseClient } from './supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, error: 'ID es requerido' });
        }

        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('profit_calculations')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            console.error('Error getting profit calculation:', error);
            return res.status(500).json({ success: false, error: 'Error al obtener el cálculo' });
        }

        if (!data) {
            return res.status(404).json({ success: false, error: 'Cálculo no encontrado' });
        }

        return res.status(200).json({
            success: true,
            data: {
                id: data.id,
                name: data.name,
                inputs: data.inputs,
                results: data.results,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            }
        });
    } catch (err) {
        console.error('Error en get profit:', err);
        if (err.message && err.message.includes('Supabase credentials')) {
            return res.status(500).json({ success: false, error: 'Error de configuración del servidor.' });
        }
        return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
}
