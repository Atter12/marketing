// Vercel Serverless Function para hacer proxy de imágenes/videos de Facebook
// Esto es necesario porque Facebook CDN bloquea descargas directas sin referer válido
export default async function handler(req, res) {
  console.log('=== FACEBOOK PROXY CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', req.query);
  
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request - returning CORS headers');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Método no permitido', method: req.method });
  }

  try {
    const { url } = req.query;
    console.log('Received URL to proxy:', url);

    if (!url) {
      console.log('ERROR: No URL provided');
      return res.status(400).json({ error: 'URL requerida' });
    }

    // Validar que sea una URL de Facebook CDN
    if (!url.includes('fbcdn.net') && !url.includes('facebook.com')) {
      console.log('ERROR: Invalid URL - must be from Facebook CDN:', url);
      return res.status(400).json({ error: 'URL debe ser de Facebook CDN' });
    }

    console.log('Fetching media from Facebook CDN...');
    
    // Hacer fetch con headers de navegador real para evitar bloqueo
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.facebook.com/',
        'Origin': 'https://www.facebook.com',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Dest': 'image',
      },
      redirect: 'follow'
    });

    console.log('Response status:', response.status);
    console.log('Response content-type:', response.headers.get('content-type'));

    if (!response.ok) {
      console.log('ERROR: Response not OK:', response.status, response.statusText);
      const errorText = await response.text().catch(() => '');
      console.log('Error response (first 500 chars):', errorText.substring(0, 500));
      return res.status(response.status).json({ 
        error: `Error al obtener el recurso: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200)
      });
    }

    // Obtener el contenido
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    
    console.log('Content-Type:', contentType);
    console.log('Content-Length:', contentLength);

    // Establecer headers de respuesta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 24 horas
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length');
    
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Stream el contenido directamente al cliente
    const buffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    console.log('Successfully fetched media, size:', uint8Array.length, 'bytes');
    console.log('Returning media to client...');
    
    return res.status(200).send(Buffer.from(uint8Array));

  } catch (error) {
    console.error('ERROR en Facebook Proxy:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

