/**
 * TikTok Video Proxy
 * Maneja descargas de videos que fallan por CORS
 */

export default async function handler(req, res) {
    console.log('=== TIKTOK PROXY CALLED ===');
    console.log('Method:', req.method);
    console.log('Query:', req.query);
    
    // Solo permitir GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    console.log('[PROXY] URL to download:', url);
    
    try {
        // Fetch del video con headers de TikTok
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.tiktok.com/',
                'Origin': 'https://www.tiktok.com',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive',
                'Range': 'bytes=0-'
            }
        });
        
        if (!response.ok) {
            console.error('[PROXY] Error fetching video:', response.status, response.statusText);
            return res.status(response.status).json({ 
                error: `Failed to fetch video: ${response.statusText}` 
            });
        }
        
        console.log('[PROXY] Video fetched successfully, status:', response.status);
        console.log('[PROXY] Content-Type:', response.headers.get('content-type'));
        console.log('[PROXY] Content-Length:', response.headers.get('content-length'));
        
        // Obtener el buffer del video
        const buffer = await response.arrayBuffer();
        console.log('[PROXY] Buffer size:', buffer.byteLength, 'bytes');
        
        // Configurar headers de respuesta
        res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');
        res.setHeader('Content-Length', buffer.byteLength);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        
        // Enviar el video
        res.status(200).send(Buffer.from(buffer));
        console.log('[PROXY] Video sent successfully');
        
    } catch (error) {
        console.error('[PROXY] Error:', error);
        return res.status(500).json({ 
            error: 'Failed to proxy video',
            details: error.message 
        });
    }
}

