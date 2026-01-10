// Vercel Serverless Function para descargar anuncios de Facebook Ads Library
export default async function handler(req, res) {
  console.log('=== FACEBOOK ADS API CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Body:', JSON.stringify(req.body));
  
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request - returning CORS headers');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Método no permitido', method: req.method });
  }
  
  console.log('Processing POST request...');

  try {
    console.log('Extracting request body...');
    const { url, type = 'ad' } = req.body;
    console.log('Received URL:', url);
    console.log('Received type:', type);

    if (!url) {
      console.log('ERROR: No URL provided');
      return res.status(400).json({ error: 'URL de Facebook Ads Library requerida' });
    }

    // Validar URL de Facebook Ads Library
    const facebookAdUrlPattern = /^https?:\/\/(www\.)?facebook\.com\/ads\/library/i;
    if (!facebookAdUrlPattern.test(url)) {
      console.log('ERROR: Invalid Facebook Ad URL:', url);
      return res.status(400).json({ error: 'URL de Facebook Ads Library inválida', receivedUrl: url });
    }

    // Extraer Ad ID de la URL
    const adIdMatch = url.match(/[?&]id=(\d+)/);
    if (!adIdMatch) {
      console.log('ERROR: Could not extract Ad ID from:', url);
      return res.status(400).json({ error: 'No se pudo extraer el ID del anuncio', url: url });
    }
    const adId = adIdMatch[1];
    console.log('Extracted Ad ID:', adId);

    console.log('Calling fetchFacebookAd...');
    const apiResponse = await fetchFacebookAd(url, adId, type);
    console.log('API Response:', JSON.stringify(apiResponse, null, 2));

    if (!apiResponse.success) {
      console.log('ERROR: fetchFacebookAd failed:', apiResponse.error);
      return res.status(500).json({ 
        error: apiResponse.error || 'Error al procesar el anuncio',
        details: apiResponse
      });
    }

    console.log('SUCCESS: Returning ad data');
    return res.status(200).json({
      success: true,
      adId,
      id: adId,
      videoUrl: apiResponse.videoUrl,
      imageUrl: apiResponse.imageUrl,
      thumbnail: apiResponse.thumbnail || apiResponse.imageUrl,
      pageName: apiResponse.pageName,
      author: apiResponse.pageName,
      adText: apiResponse.adText,
      title: apiResponse.adText,
      startDate: apiResponse.startDate
    });

  } catch (error) {
    console.error('ERROR en API Facebook Ads:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Función para obtener el anuncio de Facebook Ads Library
async function fetchFacebookAd(url, adId, type) {
  console.log('[fetchFacebookAd] Starting with URL:', url, 'AdID:', adId);
  try {
    // Opción 1: Intentar obtener datos del anuncio desde Facebook Ads Library directamente
    try {
      console.log('[fetchFacebookAd] Trying direct fetch from Facebook Ads Library...');
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'Referer': 'https://www.facebook.com/',
        },
        redirect: 'follow'
      });

      if (response.ok) {
        const html = await response.text();
        console.log('[fetchFacebookAd] HTML received, length:', html.length);
        
        // Buscar datos JSON embebidos en el HTML
        // Facebook puede inyectar datos en varias estructuras
        const jsonMatches = [
          html.match(/window\.__d\(["']([^"']+)["']\)/g),
          html.match(/"snapshot":\s*({[^}]+})/),
          html.match(/"video":\s*({[^}]+})/),
          html.match(/"image":\s*({[^}]+})/),
        ];

        // Intentar extraer video URL
        const videoMatch = html.match(/"video_url":\s*"([^"]+)"/) || 
                          html.match(/"src":\s*"([^"]*\.mp4[^"]*)"/) ||
                          html.match(/<video[^>]+src=["']([^"']+)["']/);
        
        // Intentar extraer imagen URL
        const imageMatch = html.match(/"image_url":\s*"([^"]+)"/) ||
                          html.match(/"thumbnail_url":\s*"([^"]+)"/) ||
                          html.match(/<img[^>]+src=["']([^"']*(?:jpg|jpeg|png|webp)[^"']*)["']/);
        
        // Intentar extraer nombre de página
        const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/) ||
                             html.match(/"advertiser_name":\s*"([^"]+)"/);
        
        // Intentar extraer texto del anuncio
        const adTextMatch = html.match(/"ad_creative_body":\s*"([^"]+)"/) ||
                           html.match(/"body":\s*"([^"]+)"/);

        if (videoMatch || imageMatch) {
          console.log('[fetchFacebookAd] SUCCESS from direct fetch');
          return {
            success: true,
            videoUrl: videoMatch ? videoMatch[1].replace(/\\\//g, '/') : null,
            imageUrl: imageMatch ? imageMatch[1].replace(/\\\//g, '/') : null,
            thumbnail: imageMatch ? imageMatch[1].replace(/\\\//g, '/') : null,
            pageName: pageNameMatch ? pageNameMatch[1].replace(/\\\//g, '/') : 'Página de Facebook',
            adText: adTextMatch ? adTextMatch[1].replace(/\\\//g, '/') : 'Anuncio de Facebook',
            startDate: new Date().toLocaleDateString('es-ES')
          };
        }
      } else {
        console.log('[fetchFacebookAd] Direct fetch: Response not OK:', response.status);
      }
    } catch (directError) {
      console.log('[fetchFacebookAd] Error con método direct fetch:', directError.message);
    }

    // Opción 2: Usar API pública de terceros (alternativa)
    try {
      console.log('[fetchFacebookAd] Trying alternative API...');
      // Nota: Aquí podrías usar un servicio de terceros si existe
      // Por ahora, devolvemos un mensaje indicando que se necesita implementar
      
    } catch (apiError) {
      console.log('[fetchFacebookAd] Error con API alternativa:', apiError.message);
    }

    // Si todas las opciones fallan
    console.log('[fetchFacebookAd] All methods failed');
    return {
      success: false,
      error: 'No se pudo obtener el anuncio. Por favor, verifica que la URL sea válida e intenta de nuevo. Nota: Facebook Ads Library puede requerir autenticación o tener restricciones de acceso.'
    };

  } catch (error) {
    console.error('[fetchFacebookAd] ERROR:', error);
    console.error('[fetchFacebookAd] Error stack:', error.stack);
    return {
      success: false,
      error: error.message || 'Error al procesar el anuncio'
    };
  }
}

