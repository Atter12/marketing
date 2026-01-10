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
          'Referer': 'https://www.facebook.com/ads/library',
          'Origin': 'https://www.facebook.com',
        },
        redirect: 'follow'
      });

      console.log('[fetchFacebookAd] Response status:', response.status);
      console.log('[fetchFacebookAd] Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const html = await response.text();
        console.log('[fetchFacebookAd] HTML received, length:', html.length);
        console.log('[fetchFacebookAd] HTML preview (first 1000 chars):', html.substring(0, 1000));
        
        // Inicializar variables
        let videoUrl = null;
        let imageUrl = null;
        let pageName = 'Página de Facebook';
        let adText = 'Anuncio de Facebook';

        // Buscar URLs de CDN de Facebook directamente en el HTML
        // Facebook usa URLs como: scontent.xx.fbcdn.net/v/t15.5256-10/...
        // Estas son las más comunes y confiables
        const cdnVideoPattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net\/v\/t[^"'\s<>]+\.mp4[^"'\s<>]*/gi;
        const cdnImagePattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net\/v\/t[^"'\s<>]+\.(jpg|jpeg|png|webp)[^"'\s<>]*/gi;
        
        const videoMatches = html.match(cdnVideoPattern);
        const imageMatches = html.match(cdnImagePattern);

        if (videoMatches && videoMatches.length > 0) {
          videoUrl = videoMatches[0];
          console.log('[fetchFacebookAd] Found video URL from CDN pattern:', videoUrl.substring(0, 100));
        }

        if (imageMatches && imageMatches.length > 0) {
          imageUrl = imageMatches[0];
          console.log('[fetchFacebookAd] Found image URL from CDN pattern:', imageUrl.substring(0, 100));
        }

        // Si no encontramos con patrones de CDN, buscar con otros patrones
        if (!videoUrl && !imageUrl) {
          // Buscar video URLs con múltiples patrones
          const videoPatterns = [
            /"video":\s*\{[^}]*"uri":\s*"([^"]+)"/,
            /"video_url":\s*"([^"]+)"/,
            /"video_src":\s*"([^"]+)"/,
            /<video[^>]+src=["']([^"']+\.mp4[^"']*)["']/,
            /"src":\s*"([^"]+\.mp4[^"]*)"/,
            /https?:\/\/[^"'\s]+\.mp4/,
          ];

          for (const pattern of videoPatterns) {
            const match = html.match(pattern);
            if (match && match[1] && !videoUrl) {
              let foundUrl = match[1].replace(/\\\//g, '/').replace(/\\u002F/g, '/').replace(/\\/g, '');
              if (foundUrl.startsWith('http')) {
                videoUrl = foundUrl;
                console.log('[fetchFacebookAd] Found video URL from pattern:', videoUrl.substring(0, 100));
                break;
              }
            }
          }

          // Buscar imagen URLs con múltiples patrones
          const imagePatterns = [
            /"image":\s*\{[^}]*"uri":\s*"([^"]+)"/,
            /"image_url":\s*"([^"]+)"/,
            /"thumbnail_url":\s*"([^"]+)"/,
            /"photo":\s*\{[^}]*"uri":\s*"([^"]+)"/,
            /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/,
            /https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)/,
          ];

          for (const pattern of imagePatterns) {
            const match = html.match(pattern);
            if (match && match[1] && !imageUrl) {
              let foundUrl = match[1].replace(/\\\//g, '/').replace(/\\u002F/g, '/').replace(/\\/g, '');
              if (foundUrl.startsWith('http')) {
                imageUrl = foundUrl;
                console.log('[fetchFacebookAd] Found image URL from pattern:', imageUrl.substring(0, 100));
                break;
              }
            }
          }
        }

        // Buscar nombre de página
        const pageNamePatterns = [
          /"page_name":\s*"([^"]+)"/,
          /"advertiser_name":\s*"([^"]+)"/,
          /"advertiser":\s*\{[^}]*"name":\s*"([^"]+)"/,
          /"page":\s*\{[^}]*"name":\s*"([^"]+)"/,
        ];

        for (const pattern of pageNamePatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            pageName = match[1].replace(/\\\//g, '/').replace(/\\u002F/g, '/');
            console.log('[fetchFacebookAd] Found page name:', pageName);
            break;
          }
        }

        // Buscar texto del anuncio
        const adTextPatterns = [
          /"ad_creative_body":\s*"([^"]+)"/,
          /"body":\s*"([^"]+)"/,
          /"text":\s*"([^"]+)"/,
          /"message":\s*"([^"]+)"/,
        ];

        for (const pattern of adTextPatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            adText = match[1].replace(/\\\//g, '/').replace(/\\u002F/g, '/').replace(/\\n/g, ' ');
            if (adText.length > 200) adText = adText.substring(0, 200) + '...';
            console.log('[fetchFacebookAd] Found ad text:', adText.substring(0, 50));
            break;
          }
        }

        // Limpiar URLs encontradas
        if (videoUrl) {
          videoUrl = videoUrl.replace(/&amp;/g, '&').replace(/\\\//g, '/');
          if (!videoUrl.startsWith('http')) {
            videoUrl = 'https:' + videoUrl;
          }
        }
        if (imageUrl) {
          imageUrl = imageUrl.replace(/&amp;/g, '&').replace(/\\\//g, '/');
          if (!imageUrl.startsWith('http')) {
            imageUrl = 'https:' + imageUrl;
          }
        }

        // Si encontramos al menos video o imagen, consideramos éxito
        if (videoUrl || imageUrl) {
          console.log('[fetchFacebookAd] SUCCESS from direct fetch');
          console.log('[fetchFacebookAd] Final videoUrl:', videoUrl);
          console.log('[fetchFacebookAd] Final imageUrl:', imageUrl);
          return {
            success: true,
            videoUrl: videoUrl || null,
            imageUrl: imageUrl || null,
            thumbnail: imageUrl || null,
            pageName: pageName,
            adText: adText,
            startDate: new Date().toLocaleDateString('es-ES')
          };
        } else {
          console.log('[fetchFacebookAd] No video or image found in HTML');
          console.log('[fetchFacebookAd] Attempting to find any media URLs...');
          
          // Último intento: buscar cualquier URL que parezca media de Facebook
          const allUrls = html.match(/https?:\/\/[^"'\s<>]+\.(mp4|jpg|jpeg|png|webp)[^"'\s<>]*/gi);
          if (allUrls && allUrls.length > 0) {
            console.log('[fetchFacebookAd] Found potential media URLs:', allUrls.slice(0, 5));
            // Tomar la primera URL que sea de fbcdn.net
            const fbUrl = allUrls.find(url => url.includes('fbcdn.net'));
            if (fbUrl) {
              if (fbUrl.includes('.mp4')) {
                videoUrl = fbUrl;
              } else {
                imageUrl = fbUrl;
              }
              console.log('[fetchFacebookAd] Using found FB CDN URL:', fbUrl.substring(0, 100));
              return {
                success: true,
                videoUrl: videoUrl || null,
                imageUrl: imageUrl || null,
                thumbnail: imageUrl || null,
                pageName: pageName,
                adText: adText,
                startDate: new Date().toLocaleDateString('es-ES')
              };
            }
          }
        }
      } else {
        console.log('[fetchFacebookAd] Direct fetch: Response not OK:', response.status, response.statusText);
      }
    } catch (directError) {
      console.log('[fetchFacebookAd] Error con método direct fetch:', directError.message);
      console.error('[fetchFacebookAd] Direct fetch error stack:', directError.stack);
    }

    // Opción 2: Intentar usando Graph API pública (si es posible)
    try {
      console.log('[fetchFacebookAd] Trying Graph API approach...');
      // Facebook Graph API puede requerir token, pero intentemos ver si hay endpoints públicos
      const graphUrl = `https://graph.facebook.com/v18.0/${adId}`;
      // Nota: Esto probablemente no funcione sin token, pero intentémoslo
    } catch (graphError) {
      console.log('[fetchFacebookAd] Graph API error:', graphError.message);
    }

    // Si todas las opciones fallan
    console.log('[fetchFacebookAd] All methods failed');
    return {
      success: false,
      error: 'No se pudo obtener el anuncio. Por favor, verifica que la URL sea válida e intenta de nuevo. Facebook Ads Library puede requerir que el anuncio esté público y activo.'
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

