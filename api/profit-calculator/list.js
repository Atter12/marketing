// API: GET /api/profit-calculator/list — Lista cálculos guardados

import { getSupabaseClient } from './supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { limit } = req.query;

        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('profit_calculations')
            .select('id, name, inputs, results, created_at')
            .order('created_at', { ascending: false })
            .limit(Math.min(parseInt(limit, 10) || 50, 100));

        if (error) {
            console.error('Error listing profit calculations:', error);
            return res.status(500).json({ success: false, error: 'Error al listar los cálculos' });
        }

        const list = (data || []).map((r) => ({
            id: r.id,
            name: r.name,
            inputs: r.inputs,
            results: r.results,
            createdAt: r.created_at
        }));

        return res.status(200).json({ success: true, data: list, count: list.length });
    } catch (err) {
        console.error('Error en list profit:', err);
        if (err.message && err.message.includes('Supabase credentials')) {
            return res.status(500).json({ success: false, error: 'Error de configuración del servidor.' });
        }
        return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
}
