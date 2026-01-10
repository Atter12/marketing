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
    console.log('Original URL:', url);
    
    // Intentar limpiar parámetros que pueden causar problemas de firma
    // A veces Facebook acepta URLs sin todos los parámetros
    let cleanUrl = url;
    
    // Estrategia 1: Intentar con la URL original
    let response = null;
    let lastError = null;
    
    const fetchStrategies = [
      // Estrategia 1: URL completa con todos los headers de navegador
      {
        url: cleanUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.facebook.com/ads/library/',
          'Origin': 'https://www.facebook.com',
          'Connection': 'keep-alive',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Dest': 'image',
          'DNT': '1',
          'Cache-Control': 'no-cache',
        }
      },
      // Estrategia 2: URL sin parámetros de firma (oe, oh) - estos causan "signature mismatch"
      {
        url: cleanUrl.split('&oe=')[0].split('&oh=')[0].split('?oe=')[0].split('?oh=')[0],
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.facebook.com/ads/library/',
          'Origin': 'https://www.facebook.com',
          'Accept': 'image/*,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Dest': 'image',
        }
      },
      // Estrategia 3: URL sin parámetros stp (tamaño) y sin firma (oe, oh)
      {
        url: (() => {
          const urlParts = cleanUrl.split('?');
          if (urlParts.length > 1) {
            const params = urlParts[1].split('&');
            const cleanParams = params.filter(p => 
              !p.includes('stp=') && 
              !p.includes('oe=') && 
              !p.includes('oh=') &&
              !p.includes('s50x50') &&
              !p.includes('s100x100')
            );
            return urlParts[0] + (cleanParams.length > 0 ? '?' + cleanParams.join('&') : '');
          }
          return cleanUrl;
        })(),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.facebook.com/ads/library/',
          'Accept': 'image/*',
          'Sec-Fetch-Site': 'cross-site',
        }
      },
      // Estrategia 4: URL base completamente sin parámetros (último recurso)
      {
        url: cleanUrl.split('?')[0],
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.facebook.com/',
          'Accept': '*/*',
        }
      }
    ];
    
    for (let i = 0; i < fetchStrategies.length; i++) {
      const strategy = fetchStrategies[i];
      console.log(`[Proxy] Trying strategy ${i + 1} with URL: ${strategy.url.substring(0, 150)}`);
      
      try {
        response = await fetch(strategy.url, {
          headers: strategy.headers,
          redirect: 'follow'
        });
        
        console.log(`[Proxy] Strategy ${i + 1} - Response status:`, response.status);
        
        if (response.ok) {
          console.log(`[Proxy] Strategy ${i + 1} - SUCCESS!`);
          break;
        } else {
          const errorText = await response.text().catch(() => '');
          console.log(`[Proxy] Strategy ${i + 1} - Failed:`, response.status, errorText.substring(0, 100));
          lastError = { status: response.status, text: errorText.substring(0, 100) };
          response = null;
        }
      } catch (err) {
        console.log(`[Proxy] Strategy ${i + 1} - Error:`, err.message);
        lastError = { error: err.message };
        response = null;
      }
    }

    if (!response || !response.ok) {
      console.log('ERROR: All proxy strategies failed');
      if (lastError) {
        console.log('Last error:', lastError);
      }
      return res.status(403).json({ 
        error: 'Facebook CDN está bloqueando el acceso. La URL puede tener una firma expirada o requerir autenticación adicional.',
        details: lastError || 'No se pudo obtener el recurso con ninguna estrategia',
        suggestion: 'Por favor, intenta obtener el anuncio nuevamente para generar una nueva URL con firma válida.'
      });
    }
    
    console.log('Response status:', response.status);
    console.log('Response content-type:', response.headers.get('content-type'));

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

