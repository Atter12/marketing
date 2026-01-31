// API: DELETE /api/profit-calculator/delete?id=xxx — Elimina un cálculo

import { getSupabaseClient } from './supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, error: 'ID es requerido' });
        }

        const supabase = getSupabaseClient();

        const { error } = await supabase
            .from('profit_calculations')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting profit calculation:', error);
            return res.status(500).json({ success: false, error: 'Error al eliminar el cálculo' });
        }

        return res.status(200).json({ success: true, message: 'Cálculo eliminado' });
    } catch (err) {
        console.error('Error en delete profit:', err);
        if (err.message && err.message.includes('Supabase credentials')) {
            return res.status(500).json({ success: false, error: 'Error de configuración del servidor.' });
        }
        return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
}
