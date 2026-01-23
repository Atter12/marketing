// Helper para conectar con Supabase
import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

export function getSupabaseClient() {
    if (supabaseClient) {
        return supabaseClient;
    }

    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase credentials not configured. Please set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment variables.');
    }

    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    return supabaseClient;
}
