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
    // Facebook Ads Library puede tener diferentes formatos:
    // - ?id=123456789
    // - ?active_status=all&ad_type=all&country=ALL&id=123456789
    const adIdMatch = url.match(/[?&]id=(\d+)/);
    if (!adIdMatch) {
      console.log('ERROR: Could not extract Ad ID from:', url);
      return res.status(400).json({ error: 'No se pudo extraer el ID del anuncio. Asegúrate de usar una URL válida de Facebook Ads Library con el parámetro id=...', url: url });
    }
    const adId = adIdMatch[1];
    console.log('Extracted Ad ID:', adId);
    
    // Normalizar URL a formato estándar de Facebook Ads Library
    const normalizedUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&id=${adId}&search_type=keyword_unordered&media_type=all`;
    console.log('Normalized URL:', normalizedUrl);

    console.log('Calling fetchFacebookAd...');
    const apiResponse = await fetchFacebookAd(normalizedUrl, adId, type);
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
    // Opción 1: Intentar obtener datos usando el endpoint de búsqueda de Facebook Ads Library
    // Este endpoint puede ser más accesible que la página HTML
    try {
      console.log('[fetchFacebookAd] Trying Facebook Ads Library search endpoint...');
      
      // Usar el endpoint de búsqueda que Facebook usa internamente
      const searchUrl = `https://www.facebook.com/ads/library/async/search_ads/?active_status=all&ad_type=all&country=ALL&search_type=keyword_unordered&q=${adId}&media_type=all`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Referer': 'https://www.facebook.com/ads/library',
          'X-Requested-With': 'XMLHttpRequest',
        },
        redirect: 'follow'
      });
      
      console.log('[fetchFacebookAd] Search endpoint response status:', searchResponse.status);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.text();
        console.log('[fetchFacebookAd] Search endpoint data received, length:', searchData.length);
        
        // Intentar parsear como JSON
        try {
          const jsonData = JSON.parse(searchData);
          console.log('[fetchFacebookAd] Parsed JSON from search endpoint');
          
          // Buscar URLs de media en el JSON
          const jsonStr = JSON.stringify(jsonData);
          const videoMatch = jsonStr.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/);
          const imageMatch = jsonStr.match(/https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)[^"'\s]*/);
          
          if (videoMatch || imageMatch) {
            console.log('[fetchFacebookAd] SUCCESS from search endpoint');
            return {
              success: true,
              videoUrl: videoMatch ? videoMatch[0] : null,
              imageUrl: imageMatch ? imageMatch[0] : null,
              thumbnail: imageMatch ? imageMatch[0] : null,
              pageName: 'Página de Facebook',
              adText: 'Anuncio de Facebook',
              startDate: new Date().toLocaleDateString('es-ES')
            };
          }
        } catch (parseError) {
          console.log('[fetchFacebookAd] Could not parse as JSON, trying as HTML');
          // Si no es JSON, tratar como HTML
          const html = searchData;
          
          // Buscar URLs de CDN en el HTML
          const cdnVideoPattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net\/v\/t[^"'\s<>]+\.mp4[^"'\s<>]*/gi;
          const cdnImagePattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net\/v\/t[^"'\s<>]+\.(jpg|jpeg|png|webp)[^"'\s<>]*/gi;
          
          const videoMatches = html.match(cdnVideoPattern);
          const imageMatches = html.match(cdnImagePattern);
          
          if (videoMatches && videoMatches.length > 0) {
            console.log('[fetchFacebookAd] SUCCESS from search endpoint HTML (video)');
            return {
              success: true,
              videoUrl: videoMatches[0],
              imageUrl: null,
              thumbnail: null,
              pageName: 'Página de Facebook',
              adText: 'Anuncio de Facebook',
              startDate: new Date().toLocaleDateString('es-ES')
            };
          }
          
          if (imageMatches && imageMatches.length > 0) {
            console.log('[fetchFacebookAd] SUCCESS from search endpoint HTML (image)');
            return {
              success: true,
              videoUrl: null,
              imageUrl: imageMatches[0],
              thumbnail: imageMatches[0],
              pageName: 'Página de Facebook',
              adText: 'Anuncio de Facebook',
              startDate: new Date().toLocaleDateString('es-ES')
            };
          }
        }
      }
    } catch (searchError) {
      console.log('[fetchFacebookAd] Search endpoint error:', searchError.message);
    }
    
    // Opción 2: Intentar obtener datos del anuncio desde Facebook Ads Library directamente (HTML)
    try {
      console.log('[fetchFacebookAd] Trying direct fetch from Facebook Ads Library HTML...');
      
      // Headers más completos para simular un navegador real
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.facebook.com/ads/library',
        'Origin': 'https://www.facebook.com',
      };
      
      const response = await fetch(url, {
        headers: headers,
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
        
        // Si es 400, intentar obtener el body del error para más información
        if (response.status === 400) {
          try {
            const errorText = await response.text();
            console.log('[fetchFacebookAd] Error response body (first 500 chars):', errorText.substring(0, 500));
          } catch (e) {
            console.log('[fetchFacebookAd] Could not read error response body');
          }
        }
      }
    } catch (directError) {
      console.log('[fetchFacebookAd] Error con método direct fetch:', directError.message);
      console.error('[fetchFacebookAd] Direct fetch error stack:', directError.stack);
      
      // Si es error de timeout o red, intentar método alternativo
      if (directError.name === 'AbortError' || directError.message.includes('timeout')) {
        console.log('[fetchFacebookAd] Timeout error, trying alternative method...');
      }
    }

    // Opción 2: Intentar usando el endpoint de Facebook Ads Library con formato diferente
    try {
      console.log('[fetchFacebookAd] Trying alternative URL format...');
      // Intentar con formato diferente de URL
      const altUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${adId}`;
      
      const altResponse = await fetch(altUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Referer': 'https://www.facebook.com/',
        },
        redirect: 'follow'
      });
      
      if (altResponse.ok) {
        const altHtml = await altResponse.text();
        console.log('[fetchFacebookAd] Alternative URL HTML received, length:', altHtml.length);
        
        // Buscar URLs de CDN en el HTML alternativo
        const cdnVideoPattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net\/v\/t[^"'\s<>]+\.mp4[^"'\s<>]*/gi;
        const cdnImagePattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net\/v\/t[^"'\s<>]+\.(jpg|jpeg|png|webp)[^"'\s<>]*/gi;
        
        const videoMatches = altHtml.match(cdnVideoPattern);
        const imageMatches = altHtml.match(cdnImagePattern);
        
        if (videoMatches && videoMatches.length > 0) {
          const videoUrl = videoMatches[0];
          console.log('[fetchFacebookAd] SUCCESS from alternative URL (video)');
          return {
            success: true,
            videoUrl: videoUrl,
            imageUrl: null,
            thumbnail: null,
            pageName: 'Página de Facebook',
            adText: 'Anuncio de Facebook',
            startDate: new Date().toLocaleDateString('es-ES')
          };
        }
        
        if (imageMatches && imageMatches.length > 0) {
          const imageUrl = imageMatches[0];
          console.log('[fetchFacebookAd] SUCCESS from alternative URL (image)');
          return {
            success: true,
            videoUrl: null,
            imageUrl: imageUrl,
            thumbnail: imageUrl,
            pageName: 'Página de Facebook',
            adText: 'Anuncio de Facebook',
            startDate: new Date().toLocaleDateString('es-ES')
          };
        }
      }
    } catch (altError) {
      console.log('[fetchFacebookAd] Alternative URL error:', altError.message);
    }
    
    // Opción 3: Intentar usando el endpoint de Facebook Ads Library con parámetros específicos
    try {
      console.log('[fetchFacebookAd] Trying Facebook Ads Library API endpoint...');
      
      // Facebook Ads Library tiene un endpoint que devuelve JSON
      // Intentar acceder directamente al endpoint de datos
      const apiUrl = `https://www.facebook.com/ads/library/async/search_ads/?active_status=all&ad_type=all&country=ALL&search_type=keyword_unordered&media_type=all&q=${adId}`;
      
      const apiResponse = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.facebook.com/ads/library',
        }
      });
      
      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        console.log('[fetchFacebookAd] API response received');
        
        // Intentar extraer datos del JSON
        if (apiData && apiData.payload) {
          // Buscar en la estructura de datos
          const jsonStr = JSON.stringify(apiData);
          const videoMatch = jsonStr.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/);
          const imageMatch = jsonStr.match(/https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)[^"'\s]*/);
          
          if (videoMatch || imageMatch) {
            console.log('[fetchFacebookAd] SUCCESS from API endpoint');
            return {
              success: true,
              videoUrl: videoMatch ? videoMatch[0] : null,
              imageUrl: imageMatch ? imageMatch[0] : null,
              thumbnail: imageMatch ? imageMatch[0] : null,
              pageName: 'Página de Facebook',
              adText: 'Anuncio de Facebook',
              startDate: new Date().toLocaleDateString('es-ES')
            };
          }
        }
      }
    } catch (apiError) {
      console.log('[fetchFacebookAd] API endpoint error:', apiError.message);
    }
    
    // Opción 4: Intentar usar un servicio público de scraping (si existe)
    // Similar a como TikTok usa tikwm.com
    try {
      console.log('[fetchFacebookAd] Trying public scraping service...');
      
      // Intentar con diferentes servicios públicos que puedan hacer scraping de Facebook
      // Nota: Estos servicios pueden no existir o requerir pago
      // Por ahora, intentemos un enfoque diferente
      
      // Intentar acceder usando el formato de URL de Facebook Ads Library con view_all
      const viewAllUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${adId}&search_type=page&media_type=all`;
      
      const viewResponse = await fetch(viewAllUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Referer': 'https://www.facebook.com/',
        },
        redirect: 'follow'
      });
      
      if (viewResponse.ok) {
        const viewHtml = await viewResponse.text();
        console.log('[fetchFacebookAd] View all URL HTML received, length:', viewHtml.length);
        
        // Buscar URLs de CDN
        const cdnVideoPattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net\/v\/t[^"'\s<>]+\.mp4[^"'\s<>]*/gi;
        const cdnImagePattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net\/v\/t[^"'\s<>]+\.(jpg|jpeg|png|webp)[^"'\s<>]*/gi;
        
        const videoMatches = viewHtml.match(cdnVideoPattern);
        const imageMatches = viewHtml.match(cdnImagePattern);
        
        if (videoMatches && videoMatches.length > 0) {
          console.log('[fetchFacebookAd] SUCCESS from view all URL (video)');
          return {
            success: true,
            videoUrl: videoMatches[0],
            imageUrl: null,
            thumbnail: null,
            pageName: 'Página de Facebook',
            adText: 'Anuncio de Facebook',
            startDate: new Date().toLocaleDateString('es-ES')
          };
        }
        
        if (imageMatches && imageMatches.length > 0) {
          console.log('[fetchFacebookAd] SUCCESS from view all URL (image)');
          return {
            success: true,
            videoUrl: null,
            imageUrl: imageMatches[0],
            thumbnail: imageMatches[0],
            pageName: 'Página de Facebook',
            adText: 'Anuncio de Facebook',
            startDate: new Date().toLocaleDateString('es-ES')
          };
        }
      }
    } catch (viewError) {
      console.log('[fetchFacebookAd] View all URL error:', viewError.message);
    }
    
    // Opción 5: Como último recurso, informar que Facebook requiere autenticación
    console.log('[fetchFacebookAd] All methods failed - Facebook requires browser session or authentication');

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

