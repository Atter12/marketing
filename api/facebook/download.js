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
      return res.status(400).json({ error: 'No se pudo extraer el ID del anuncio. Asegúrate de usar una URL válida de Facebook Ads Library con el parámetro id=...', url: url });
    }
    const adId = adIdMatch[1];
    console.log('Extracted Ad ID:', adId);
    
    // Normalizar URL
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
// Similar al enfoque de TikTok: obtener HTML y parsear datos JSON embebidos
async function fetchFacebookAd(url, adId, type) {
  console.log('[fetchFacebookAd] Starting with URL:', url, 'AdID:', adId);
  
  try {
    // Estrategia 1: Intentar con headers completos de navegador (incluyendo Sec-Fetch que Facebook requiere)
    const simpleUrl = `https://www.facebook.com/ads/library/?id=${adId}`;
    console.log('[fetchFacebookAd] Strategy 1: Trying with full browser headers (including Sec-Fetch)...');
    
    try {
      const response1 = await fetch(simpleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.facebook.com/ads/library/',
          'Origin': 'https://www.facebook.com',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
          'DNT': '1',
        },
        redirect: 'follow'
      });

      console.log('[fetchFacebookAd] Strategy 1 - Response status:', response1.status);
      console.log('[fetchFacebookAd] Strategy 1 - Response headers:', JSON.stringify(Object.fromEntries(response1.headers.entries()), null, 2));

      if (response1.ok) {
        const html = await response1.text();
        console.log('[fetchFacebookAd] Strategy 1 - HTML received, length:', html.length);
        console.log('[fetchFacebookAd] Strategy 1 - HTML preview (first 3000 chars):', html.substring(0, 3000));
        
        const result = parseHtmlForAdData(html, adId);
        if (result) {
          console.log('[fetchFacebookAd] Strategy 1 - SUCCESS!');
          return result;
        }
      } else {
        const errorText = await response1.text().catch(() => '');
        console.log('[fetchFacebookAd] Strategy 1 - Error response (first 1000 chars):', errorText.substring(0, 1000));
        
        // Intentar parsear incluso si es un error (a veces el error contiene datos útiles)
        if (errorText && errorText.length > 100) {
          console.log('[fetchFacebookAd] Strategy 1 - Trying to parse error response for data...');
          const result = parseHtmlForAdData(errorText, adId);
          if (result) {
            console.log('[fetchFacebookAd] Strategy 1 - SUCCESS from error response parsing!');
            return result;
          }
        }
      }
    } catch (err1) {
      console.log('[fetchFacebookAd] Strategy 1 - Error:', err1.message);
    }

    // Estrategia 2: Intentar con URL original (normalizada) y headers Sec-Fetch completos
    console.log('[fetchFacebookAd] Strategy 2: Trying normalized URL with Sec-Fetch headers...');
    try {
      const response2 = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.facebook.com/ads/library/',
          'Origin': 'https://www.facebook.com',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow'
      });

      console.log('[fetchFacebookAd] Strategy 2 - Response status:', response2.status);
      console.log('[fetchFacebookAd] Strategy 2 - Response headers:', JSON.stringify(Object.fromEntries(response2.headers.entries()), null, 2));

      if (response2.ok) {
        const html = await response2.text();
        console.log('[fetchFacebookAd] Strategy 2 - HTML received, length:', html.length);
        
        const result = parseHtmlForAdData(html, adId);
        if (result) {
          console.log('[fetchFacebookAd] Strategy 2 - SUCCESS!');
          return result;
        }
      } else {
        const errorText = await response2.text().catch(() => '');
        console.log('[fetchFacebookAd] Strategy 2 - Error response (first 1000 chars):', errorText.substring(0, 1000));
        
        // Intentar parsear incluso si es un error
        if (errorText && errorText.length > 100) {
          console.log('[fetchFacebookAd] Strategy 2 - Trying to parse error response for data...');
          const result = parseHtmlForAdData(errorText, adId);
          if (result) {
            console.log('[fetchFacebookAd] Strategy 2 - SUCCESS from error response parsing!');
            return result;
          }
        }
      }
    } catch (err2) {
      console.log('[fetchFacebookAd] Strategy 2 - Error:', err2.message);
    }

    // Estrategia 3: Intentar primero obtener cookies de la página principal y luego usar esas cookies
    console.log('[fetchFacebookAd] Strategy 3: Trying to get cookies from main page first...');
    try {
      // Primero hacer una petición a la página principal para obtener cookies
      const mainPageResponse = await fetch('https://www.facebook.com/ads/library/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-User': '?1',
        },
        redirect: 'follow'
      });
      
      console.log('[fetchFacebookAd] Strategy 3 - Main page response status:', mainPageResponse.status);
      
      // Extraer cookies si existen
      const setCookieHeaders = mainPageResponse.headers.get('set-cookie');
      let cookies = '';
      if (setCookieHeaders) {
        cookies = setCookieHeaders.split(',').map(c => c.split(';')[0].trim()).join('; ');
        console.log('[fetchFacebookAd] Strategy 3 - Extracted cookies:', cookies.substring(0, 200));
      }
      
      // Ahora intentar con las cookies obtenidas
      const headers3 = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8',
        'Referer': 'https://www.facebook.com/ads/library/',
        'Origin': 'https://www.facebook.com',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-User': '?1',
      };
      
      if (cookies) {
        headers3['Cookie'] = cookies;
      }
      
      const response3 = await fetch(simpleUrl, {
        headers: headers3,
        redirect: 'follow'
      });

      console.log('[fetchFacebookAd] Strategy 3 - Response status:', response3.status);
      
      if (response3.ok) {
        const html = await response3.text();
        console.log('[fetchFacebookAd] Strategy 3 - HTML received, length:', html.length);
        
        const result = parseHtmlForAdData(html, adId);
        if (result) {
          console.log('[fetchFacebookAd] Strategy 3 - SUCCESS!');
          return result;
        }
      } else {
        const errorText = await response3.text().catch(() => '');
        console.log('[fetchFacebookAd] Strategy 3 - Error response (first 1000 chars):', errorText.substring(0, 1000));
        console.log('[fetchFacebookAd] Strategy 3 - Looking for clues in error response...');
        
        // Buscar pistas en el error
        if (errorText.includes('login') || errorText.includes('Login')) {
          console.log('[fetchFacebookAd] Strategy 3 - ERROR: Facebook requires login/session');
        }
        if (errorText.includes('block') || errorText.includes('Block')) {
          console.log('[fetchFacebookAd] Strategy 3 - ERROR: Facebook is blocking the request');
        }
      }
    } catch (err3) {
      console.log('[fetchFacebookAd] Strategy 3 - Error:', err3.message);
      console.error('[fetchFacebookAd] Strategy 3 - Error stack:', err3.stack);
    }

    // Estrategia 4: Intentar con Graph API público de Facebook (si existe endpoint para Ads Library)
    console.log('[fetchFacebookAd] Strategy 4: Trying Facebook Graph API approach...');
    try {
      // Facebook Graph API puede tener un endpoint público para Ads Library
      // Intentar diferentes variantes
      const graphApiUrls = [
        `https://graph.facebook.com/v18.0/${adId}`,
        `https://graph.facebook.com/v18.0/ads_library/${adId}`,
        `https://www.facebook.com/ads/library/async/get_ad/?id=${adId}`,
      ];
      
      for (let i = 0; i < graphApiUrls.length; i++) {
        const apiUrl = graphApiUrls[i];
        console.log(`[fetchFacebookAd] Strategy 4.${i+1} - Trying Graph API URL:`, apiUrl);
        
        try {
          const response4 = await fetch(apiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/html, */*',
              'Referer': 'https://www.facebook.com/ads/library/',
              'Origin': 'https://www.facebook.com',
            },
            redirect: 'follow'
          });
          
          console.log(`[fetchFacebookAd] Strategy 4.${i+1} - Response status:`, response4.status);
          
          if (response4.ok) {
            const contentType = response4.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const jsonData = await response4.json();
              console.log(`[fetchFacebookAd] Strategy 4.${i+1} - JSON received:`, JSON.stringify(jsonData, null, 2).substring(0, 500));
              
              const adData = extractAdData(jsonData, adId);
              if (adData.videoUrl || adData.imageUrl) {
                console.log(`[fetchFacebookAd] Strategy 4.${i+1} - SUCCESS from Graph API!`);
                return {
                  success: true,
                  videoUrl: adData.videoUrl || null,
                  imageUrl: adData.imageUrl || null,
                  thumbnail: adData.thumbnail || adData.imageUrl || null,
                  pageName: adData.pageName || 'Página de Facebook',
                  adText: adData.adText || 'Anuncio de Facebook',
                  startDate: adData.startDate || new Date().toLocaleDateString('es-ES')
                };
              }
            } else {
              const html = await response4.text();
              console.log(`[fetchFacebookAd] Strategy 4.${i+1} - HTML received, length:`, html.length);
              
              const result = parseHtmlForAdData(html, adId);
              if (result) {
                console.log(`[fetchFacebookAd] Strategy 4.${i+1} - SUCCESS from HTML parsing!`);
                return result;
              }
            }
          }
        } catch (err4) {
          console.log(`[fetchFacebookAd] Strategy 4.${i+1} - Error:`, err4.message);
          continue;
        }
      }

      console.log('[fetchFacebookAd] Strategy 4 - Response status:', response4.status);
      
      if (response4.ok) {
        const html = await response4.text();
        console.log('[fetchFacebookAd] Strategy 4 - HTML received, length:', html.length);
        
        const result = parseHtmlForAdData(html, adId);
        if (result) {
          console.log('[fetchFacebookAd] Strategy 4 - SUCCESS!');
          return result;
        }
      }
    } catch (err4) {
      console.log('[fetchFacebookAd] Strategy 4 - Error:', err4.message);
    }

    // Si llegamos aquí, todas las estrategias fallaron
    console.log('[fetchFacebookAd] All strategies failed - Response status was likely 400 (Bad Request)');
    console.log('[fetchFacebookAd] This indicates Facebook is blocking automated requests');

    // Si llegamos aquí, todas las estrategias fallaron
    console.log('[fetchFacebookAd] All strategies and parsing methods failed');
    return {
      success: false,
      error: 'No se pudo obtener el anuncio. Por favor, verifica que la URL sea válida e intenta de nuevo. Nota: Facebook Ads Library puede requerir que el anuncio esté público y activo.'
    };

  } catch (outerError) {
    console.error('[fetchFacebookAd] Outer error:', outerError);
    console.error('[fetchFacebookAd] Outer error stack:', outerError.stack);
    return {
      success: false,
      error: outerError.message || 'Error al procesar el anuncio'
    };
  }
}

// Función auxiliar para parsear HTML (extraída para reutilización)
function parseHtmlForAdData(html, adId) {
    if (!html || html.length < 100) {
      console.log('[parseHtmlForAdData] HTML too short or empty');
      return null;
    }

    console.log('[parseHtmlForAdData] Starting to parse HTML, length:', html.length);
    
    try {
      // Buscar datos JSON embebidos en el HTML (similar a TikTok)
      // Facebook puede tener datos en diferentes formatos:
      // - window.__d("PageAdDetailPage",{...})
      // - {"__html":"..."}
      // - require("TimeSlice").enqueueData(...)
      // - bootloadable.*.js que contiene datos JSON
      
      // Patrón 1: Buscar datos JSON en script tags
      console.log('[parseHtmlForAdData] Pattern 1: Searching for JSON in script tags...');
      const jsonScriptPatterns = [
        /require\("TimeSlice"\)\.enqueueData\([^,]+,\s*({.+?})\)/s,
        /window\.__d\("PageAdDetailPage",\s*({.+?})\)/s,
        /__d\("PageAdDetailPage",\s*({.+?})\)/s,
        /{"__html":\s*"[^"]*"}/s,
        /requireLazy\(\["Bootloader"\],\s*function\(\)\{[^}]*bootloadable.*\.js[^}]*\}\([^,]+,\s*({.+?})\)\)/s
      ];
      
      for (let i = 0; i < jsonScriptPatterns.length; i++) {
        const pattern = jsonScriptPatterns[i];
        const match = html.match(pattern);
        if (match && match[1]) {
          try {
            console.log(`[parseHtmlForAdData] Pattern 1.${i+1}: Found JSON data in script, parsing...`);
            const jsonData = JSON.parse(match[1]);
            const adData = extractAdData(jsonData, adId);
            
            if (adData.videoUrl || adData.imageUrl) {
              console.log(`[parseHtmlForAdData] Pattern 1.${i+1}: SUCCESS from JSON parsing (like TikTok)`);
              return {
                success: true,
                videoUrl: adData.videoUrl || null,
                imageUrl: adData.imageUrl || null,
                thumbnail: adData.thumbnail || adData.imageUrl || null,
                pageName: adData.pageName || 'Página de Facebook',
                adText: adData.adText || 'Anuncio de Facebook',
                startDate: adData.startDate || new Date().toLocaleDateString('es-ES')
              };
            }
          } catch (parseError) {
            console.log(`[parseHtmlForAdData] Pattern 1.${i+1}: Could not parse JSON from script:`, parseError.message);
          }
        }
      }
      
      // Patrón 2: Buscar datos en atributos data-* (Facebook usa mucho esto)
      console.log('[parseHtmlForAdData] Pattern 2: Searching for data-* attributes...');
      const dataAttrPatterns = [
        /data-store="({[^"]+})"/g,
        /data-a11y-store="({[^"]+})"/g,
        /data-bootloader-hydrate="({[^"]+})"/g
      ];
      
      for (let i = 0; i < dataAttrPatterns.length; i++) {
        const pattern = dataAttrPatterns[i];
        let dataMatch;
        let matchCount = 0;
        while ((dataMatch = pattern.exec(html)) !== null && matchCount < 10) {
          matchCount++;
          try {
            const decodedJson = dataMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
            const jsonData = JSON.parse(decodedJson);
            const adData = extractAdData(jsonData, adId);
            
            if (adData.videoUrl || adData.imageUrl) {
              console.log(`[parseHtmlForAdData] Pattern 2.${i+1}: SUCCESS from data-* attribute`);
              return {
                success: true,
                videoUrl: adData.videoUrl || null,
                imageUrl: adData.imageUrl || null,
                thumbnail: adData.thumbnail || adData.imageUrl || null,
                pageName: adData.pageName || 'Página de Facebook',
                adText: adData.adText || 'Anuncio de Facebook',
                startDate: adData.startDate || new Date().toLocaleDateString('es-ES')
              };
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      // Patrón 3: Buscar directamente URLs de CDN de Facebook en el HTML
      // (como respaldo, igual que en TikTok se busca en HTML si el JSON falla)
      console.log('[parseHtmlForAdData] Pattern 3: Searching for CDN URLs directly in HTML...');
      
      const cdnVideoPattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net[^"'\s<>]*\/v\/t[^"'\s<>]*\.mp4[^"'\s<>]*/gi;
      const cdnImagePattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net[^"'\s<>]*\/v\/t[^"'\s<>]*\.(jpg|jpeg|png|webp)[^"'\s<>]*/gi;
      
      const videoMatches = html.match(cdnVideoPattern);
      const imageMatches = html.match(cdnImagePattern);
      
      console.log('[parseHtmlForAdData] Pattern 3 - Video matches found:', videoMatches ? videoMatches.length : 0);
      console.log('[parseHtmlForAdData] Pattern 3 - Image matches found:', imageMatches ? imageMatches.length : 0);

      if (videoMatches && videoMatches.length > 0) {
        const videoUrl = videoMatches[0].replace(/&amp;/g, '&');
        console.log('[parseHtmlForAdData] Pattern 3: SUCCESS - Found video URL directly from HTML');
        console.log('[parseHtmlForAdData] Pattern 3 - Video URL (first 100 chars):', videoUrl.substring(0, 100));
        
        // Buscar datos adicionales en el HTML
        const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/) || html.match(/"advertiser_name":\s*"([^"]+)"/);
        const adTextMatch = html.match(/"ad_creative_body":\s*"([^"]+)"/) || html.match(/"body":\s*"([^"]+)"/);
        
        return {
          success: true,
          videoUrl: videoUrl,
          imageUrl: null,
          thumbnail: null,
          pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
          adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 200) : 'Anuncio de Facebook',
          startDate: new Date().toLocaleDateString('es-ES')
        };
      }
      
      if (imageMatches && imageMatches.length > 0) {
        const imageUrl = imageMatches[0].replace(/&amp;/g, '&');
        console.log('[parseHtmlForAdData] Pattern 3: SUCCESS - Found image URL directly from HTML');
        console.log('[parseHtmlForAdData] Pattern 3 - Image URL (first 100 chars):', imageUrl.substring(0, 100));
        
        const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/) || html.match(/"advertiser_name":\s*"([^"]+)"/);
        const adTextMatch = html.match(/"ad_creative_body":\s*"([^"]+)"/) || html.match(/"body":\s*"([^"]+)"/);
        
        return {
          success: true,
          videoUrl: null,
          imageUrl: imageUrl,
          thumbnail: imageUrl,
          pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
          adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 200) : 'Anuncio de Facebook',
          startDate: new Date().toLocaleDateString('es-ES')
        };
      }
      
      // Patrón 4: Buscar cualquier URL de media en el HTML
      console.log('[parseHtmlForAdData] Pattern 4: Searching for any media URLs...');
      const allMediaPattern = /https?:\/\/[^"'\s<>]+\.(mp4|jpg|jpeg|png|webp)[^"'\s<>]*/gi;
      const allMediaMatches = html.match(allMediaPattern);
      
      if (allMediaMatches && allMediaMatches.length > 0) {
        console.log('[parseHtmlForAdData] Pattern 4 - Found', allMediaMatches.length, 'potential media URLs');
        // Filtrar solo URLs de Facebook CDN
        const fbUrls = allMediaMatches.filter(url => url.includes('fbcdn.net') || url.includes('facebook.com'));
        console.log('[parseHtmlForAdData] Pattern 4 - Filtered to', fbUrls.length, 'Facebook CDN URLs');
        
        if (fbUrls.length > 0) {
          const mediaUrl = fbUrls[0];
          const isVideo = mediaUrl.includes('.mp4');
          console.log('[parseHtmlForAdData] Pattern 4: SUCCESS - Found', isVideo ? 'video' : 'image', 'URL');
          
          return {
            success: true,
            videoUrl: isVideo ? mediaUrl : null,
            imageUrl: !isVideo ? mediaUrl : null,
            thumbnail: !isVideo ? mediaUrl : null,
            pageName: 'Página de Facebook',
            adText: 'Anuncio de Facebook',
            startDate: new Date().toLocaleDateString('es-ES')
          };
        }
      }
      
      console.log('[parseHtmlForAdData] All patterns failed - No media URLs found in HTML');
      return null;
      
    } catch (parseError) {
      console.error('[parseHtmlForAdData] Error parsing HTML:', parseError.message);
      console.error('[parseHtmlForAdData] Error stack:', parseError.stack);
      return null;
    }
  }


// Función auxiliar para extraer datos del anuncio desde JSON (similar a extractVideoData de TikTok)
function extractAdData(jsonData, adId) {
  try {
    // Navegar por la estructura JSON de Facebook Ads Library
    // La estructura puede variar, intentamos varios paths comunes
    
    // Buscar recursivamente en el JSON
    const findInObject = (obj, keys) => {
      if (typeof obj !== 'object' || obj === null) return null;
      
      for (const key in obj) {
        if (keys.some(k => key.includes(k))) {
          return obj[key];
        }
        if (typeof obj[key] === 'object') {
          const result = findInObject(obj[key], keys);
          if (result) return result;
        }
      }
      return null;
    };
    
    // Buscar video URL
    const videoData = findInObject(jsonData, ['video', 'mp4', 'play', 'source']);
    let videoUrl = null;
    if (videoData) {
      if (typeof videoData === 'string' && videoData.startsWith('http')) {
        videoUrl = videoData;
      } else if (videoData.uri || videoData.url || videoData.src) {
        videoUrl = videoData.uri || videoData.url || videoData.src;
      } else if (Array.isArray(videoData) && videoData[0]) {
        videoUrl = typeof videoData[0] === 'string' ? videoData[0] : (videoData[0].uri || videoData[0].url);
      }
    }
    
    // Buscar imagen URL
    const imageData = findInObject(jsonData, ['image', 'photo', 'picture', 'thumbnail', 'cover']);
    let imageUrl = null;
    let thumbnail = null;
    if (imageData) {
      if (typeof imageData === 'string' && imageData.startsWith('http')) {
        imageUrl = imageData;
        thumbnail = imageData;
      } else if (imageData.uri || imageData.url || imageData.src) {
        imageUrl = imageData.uri || imageData.url || imageData.src;
        thumbnail = imageUrl;
      } else if (Array.isArray(imageData) && imageData[0]) {
        imageUrl = typeof imageData[0] === 'string' ? imageData[0] : (imageData[0].uri || imageData[0].url);
        thumbnail = imageUrl;
      }
    }
    
    // Buscar nombre de página/advertiser
    const pageData = findInObject(jsonData, ['page', 'advertiser', 'account', 'name']);
    let pageName = null;
    if (pageData) {
      if (typeof pageData === 'string') {
        pageName = pageData;
      } else if (pageData.name) {
        pageName = pageData.name;
      }
    }
    
    // Buscar texto del anuncio
    const textData = findInObject(jsonData, ['body', 'text', 'message', 'caption', 'creative']);
    let adText = null;
    if (textData) {
      if (typeof textData === 'string') {
        adText = textData;
      } else if (textData.body || textData.text || textData.message) {
        adText = textData.body || textData.text || textData.message;
      }
    }
    
    // Buscar fecha
    const dateData = findInObject(jsonData, ['date', 'start', 'created', 'time']);
    let startDate = new Date().toLocaleDateString('es-ES');
    if (dateData) {
      try {
        const date = new Date(typeof dateData === 'string' ? dateData : dateData.time || dateData.start);
        if (!isNaN(date.getTime())) {
          startDate = date.toLocaleDateString('es-ES');
        }
      } catch (e) {
        // Ignore date parsing errors
      }
    }
    
    return {
      videoUrl,
      imageUrl,
      thumbnail,
      pageName,
      adText,
      startDate
    };
  } catch (error) {
    console.error('[extractAdData] Error extrayendo datos:', error);
  }

  return {};
}

// Función auxiliar para decodificar Unicode (similar a como TikTok maneja esto)
function decodeUnicode(str) {
  return str.replace(/\\u([0-9a-f]{4})/gi, (match, code) => String.fromCharCode(parseInt(code, 16)))
            .replace(/\\\//g, '/')
            .replace(/\\n/g, ' ')
            .replace(/\\"/g, '"');
}
