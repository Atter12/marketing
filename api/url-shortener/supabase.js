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

// Función helper para generar alias aleatorio
export function generateRandomAlias(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Función para generar alias único
export async function generateUniqueAlias(customAlias = null) {
    const supabase = getSupabaseClient();
    
    if (customAlias) {
        // Verificar si el alias personalizado ya existe
        const { data, error } = await supabase
            .from('short_urls')
            .select('alias')
            .eq('alias', customAlias)
            .maybeSingle();
        
        // Si encuentra un registro, el alias ya está en uso
        if (data) {
            throw new Error('Este alias ya está en uso');
        }
        
        // Si hay un error que no sea "not found", lanzarlo
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        return customAlias;
    }
    
    // Generar alias aleatorio único
    let alias;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
        alias = generateRandomAlias();
        const { data, error } = await supabase
            .from('short_urls')
            .select('alias')
            .eq('alias', alias)
            .maybeSingle();
        
        // Si no encuentra registro (error PGRST116 o no data), el alias está disponible
        if (!data || (error && error.code === 'PGRST116')) {
            return alias; // Alias único encontrado
        }
        
        attempts++;
    } while (attempts < maxAttempts);
    
    throw new Error('No se pudo generar un alias único. Intenta de nuevo.');
}

// Función para obtener información del usuario desde IP (opcional)
export async function getLocationFromIP(ip) {
    try {
        // Usar un servicio de geolocalización por IP
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        if (response.ok) {
            const data = await response.json();
            return {
                country: data.country_code || null,
                city: data.city || null
            };
        }
    } catch (error) {
        console.error('Error getting location from IP:', error);
    }
    return { country: null, city: null };
}

// Función para detectar dispositivo desde user agent
export function detectDevice(userAgent) {
    if (!userAgent) return { device: 'unknown', browser: 'unknown', os: 'unknown' };
    
    const ua = userAgent.toLowerCase();
    
    // Dispositivo
    let device = 'desktop';
    if (/mobile|android|iphone|ipad/.test(ua)) {
        device = /tablet|ipad/.test(ua) ? 'tablet' : 'mobile';
    }
    
    // Navegador
    let browser = 'unknown';
    if (ua.includes('chrome')) browser = 'chrome';
    else if (ua.includes('firefox')) browser = 'firefox';
    else if (ua.includes('safari')) browser = 'safari';
    else if (ua.includes('edge')) browser = 'edge';
    else if (ua.includes('opera')) browser = 'opera';
    
    // OS
    let os = 'unknown';
    if (ua.includes('windows')) os = 'windows';
    else if (ua.includes('mac')) os = 'macos';
    else if (ua.includes('linux')) os = 'linux';
    else if (ua.includes('android')) os = 'android';
    else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'ios';
    
    return { device, browser, os };
}
