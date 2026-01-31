// API: POST /api/profit-calculator/save — Guarda un cálculo

import { getSupabaseClient } from './supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { name, userId, inputs, results } = req.body;

        if (!inputs || typeof inputs !== 'object') {
            return res.status(400).json({ success: false, error: 'inputs es requerido (objeto)' });
        }

        const supabase = getSupabaseClient();

        const row = {
            name: name && String(name).trim() ? String(name).trim().slice(0, 255) : null,
            user_id: userId || null,
            inputs: {
                precioVenta: Number(inputs.precioVenta) || 0,
                costoProducto: Number(inputs.costoProducto) || 0,
                costoEnvio: Number(inputs.costoEnvio) || 0,
                comisionPasarela: Number(inputs.comisionPasarela) || 0,
                gastoAds: Number(inputs.gastoAds) || 0,
                unidadesVendidas: Number(inputs.unidadesVendidas) || 0
            },
            results: results && typeof results === 'object' ? results : {}
        };

        const { data, error } = await supabase
            .from('profit_calculations')
            .insert(row)
            .select()
            .single();

        if (error) {
            console.error('Error saving profit calculation:', error);
            return res.status(500).json({ success: false, error: 'Error al guardar el cálculo' });
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
        console.error('Error en save profit:', err);
        if (err.message && err.message.includes('Supabase credentials')) {
            return res.status(500).json({ success: false, error: 'Error de configuración del servidor.' });
        }
        return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
}
