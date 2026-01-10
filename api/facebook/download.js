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
    // Opción 1: Obtener HTML directamente y parsear datos JSON embebidos (como TikTok)
    // Facebook también puede tener datos JSON embebidos en el HTML
    try {
      console.log('[fetchFacebookAd] Trying direct HTML fetch (like TikTok approach)...');
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.facebook.com/ads/library',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        redirect: 'follow'
      });

      console.log('[fetchFacebookAd] Response status:', response.status);

      if (response.ok) {
        const html = await response.text();
        console.log('[fetchFacebookAd] HTML received, length:', html.length);
        
        // Buscar datos JSON embebidos en el HTML (similar a TikTok)
        // Facebook puede tener datos en diferentes formatos:
        // - window.__d("PageAdDetailPage",{...})
        // - {"__html":"..."}
        // - require("TimeSlice").enqueueData(...)
        // - bootloadable.*.js que contiene datos JSON
        
        // Patrón 1: Buscar datos JSON en script tags
        const jsonScriptPatterns = [
          /require\("TimeSlice"\)\.enqueueData\([^,]+,\s*({.+?})\)/s,
          /window\.__d\("PageAdDetailPage",\s*({.+?})\)/s,
          /__d\("PageAdDetailPage",\s*({.+?})\)/s,
          /{"__html":\s*"[^"]*"}/s,
          /requireLazy\(\["Bootloader"\],\s*function\(\)\{[^}]*bootloadable.*\.js[^}]*\}\([^,]+,\s*({.+?})\)\)/s
        ];
        
        for (const pattern of jsonScriptPatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            try {
              console.log('[fetchFacebookAd] Found JSON data in script, parsing...');
              const jsonData = JSON.parse(match[1]);
              const adData = extractAdData(jsonData, adId);
              
              if (adData.videoUrl || adData.imageUrl) {
                console.log('[fetchFacebookAd] SUCCESS from JSON parsing (like TikTok)');
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
              console.log('[fetchFacebookAd] Could not parse JSON from script:', parseError.message);
            }
          }
        }
        
        // Patrón 2: Buscar datos en atributos data-* (Facebook usa mucho esto)
        const dataAttrPattern = /data-store="({[^"]+})"/g;
        let dataMatch;
        while ((dataMatch = dataAttrPattern.exec(html)) !== null) {
          try {
            const decodedJson = dataMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
            const jsonData = JSON.parse(decodedJson);
            const adData = extractAdData(jsonData, adId);
            
            if (adData.videoUrl || adData.imageUrl) {
              console.log('[fetchFacebookAd] SUCCESS from data-store attribute');
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
        
        // Patrón 3: Buscar directamente URLs de CDN de Facebook en el HTML
        // (como respaldo, igual que en TikTok se busca en HTML si el JSON falla)
        console.log('[fetchFacebookAd] JSON parsing failed, trying direct URL extraction from HTML...');
        
        const cdnVideoPattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net[^"'\s<>]*\/v\/t[^"'\s<>]*\.mp4[^"'\s<>]*/gi;
        const cdnImagePattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net[^"'\s<>]*\/v\/t[^"'\s<>]*\.(jpg|jpeg|png|webp)[^"'\s<>]*/gi;
        
        const videoMatches = html.match(cdnVideoPattern);
        const imageMatches = html.match(cdnImagePattern);

        if (videoMatches && videoMatches.length > 0) {
          const videoUrl = videoMatches[0].replace(/&amp;/g, '&');
          console.log('[fetchFacebookAd] SUCCESS: Found video URL directly from HTML');
          
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
          console.log('[fetchFacebookAd] SUCCESS: Found image URL directly from HTML');
          
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
        
        console.log('[fetchFacebookAd] No media URLs found in HTML');
        
      } else {
        console.log('[fetchFacebookAd] Response not OK:', response.status, response.statusText);
      }
    } catch (htmlError) {
      console.log('[fetchFacebookAd] Error con método HTML parsing:', htmlError.message);
    }

    // Si todas las opciones fallan
    console.log('[fetchFacebookAd] All methods failed');
    return {
      success: false,
      error: 'No se pudo obtener el anuncio. Por favor, verifica que la URL sea válida e intenta de nuevo. Nota: Facebook Ads Library puede requerir que el anuncio esté público y activo.'
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
