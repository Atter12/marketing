// Vercel Serverless Function para listar anuncios de una página de Facebook Ads Library
export default async function handler(req, res) {
  console.log('=== FACEBOOK ADS LIST API CALLED ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body));
  
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { url, pageId, type = 'page' } = req.body;
    console.log('Received URL:', url);
    console.log('Received pageId:', pageId);

    if (!url || !pageId) {
      return res.status(400).json({ error: 'URL y pageId son requeridos' });
    }

    // Validar URL de Facebook Ads Library
    const facebookAdUrlPattern = /^https?:\/\/(www\.)?facebook\.com\/ads\/library/i;
    if (!facebookAdUrlPattern.test(url)) {
      return res.status(400).json({ error: 'URL de Facebook Ads Library inválida' });
    }

    console.log('Fetching ads from page:', pageId);
    
    // Intentar obtener anuncios de la página
    const adsData = await fetchAdsFromPage(url, pageId);
    
    if (!adsData.success) {
      return res.status(500).json({ 
        error: adsData.error || 'Error al obtener anuncios de la página',
        details: adsData
      });
    }

    console.log('SUCCESS: Returning ads data, count:', adsData.ads?.length || 0);
    return res.status(200).json({
      success: true,
      pageId: pageId,
      ads: adsData.ads || [],
      count: adsData.ads?.length || 0,
      pageName: adsData.pageName || 'Página de Facebook'
    });

  } catch (error) {
    console.error('ERROR en API Facebook Ads List:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Función para obtener anuncios de una página
async function fetchAdsFromPage(url, pageId) {
  console.log('[fetchAdsFromPage] Starting with URL:', url, 'PageID:', pageId);
  
  try {
    // Normalizar URL para obtener anuncios de la página
    const normalizedUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${pageId}&search_type=page&media_type=all`;
    console.log('[fetchAdsFromPage] Normalized URL:', normalizedUrl);
    
    // Hacer petición a Facebook con headers completos
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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
      },
      redirect: 'follow'
    });

    console.log('[fetchAdsFromPage] Response status:', response.status);
    
    if (!response.ok) {
      console.log('[fetchAdsFromPage] Error response:', response.status);
      return {
        success: false,
        error: `Facebook returned ${response.status}. La página puede no ser pública o no tener anuncios activos.`
      };
    }

    const html = await response.text();
    console.log('[fetchAdsFromPage] HTML received, length:', html.length);
    
    // Parsear HTML para extraer anuncios
    const adsData = parseHtmlForAds(html, pageId);
    
    if (!adsData || !adsData.ads || adsData.ads.length === 0) {
      console.log('[fetchAdsFromPage] No ads found in HTML');
      return {
        success: false,
        error: 'No se encontraron anuncios en esta página. La página puede no tener anuncios activos o no ser pública.'
      };
    }

    console.log('[fetchAdsFromPage] SUCCESS! Found', adsData.ads.length, 'ads');
    return {
      success: true,
      ...adsData
    };

  } catch (error) {
    console.error('[fetchAdsFromPage] Error:', error);
    return {
      success: false,
      error: error.message || 'Error al procesar la página'
    };
  }
}

// Función para parsear HTML y extraer múltiples anuncios
function parseHtmlForAds(html, pageId) {
  console.log('[parseHtmlForAds] Parsing HTML for ads...');
  
  try {
    const ads = [];
    
    // ESTRATEGIA 1: Buscar IDs de anuncios en el HTML
    // Facebook típicamente tiene los IDs en estructuras JSON o en atributos data-*
    console.log('[parseHtmlForAds] Strategy 1: Looking for ad IDs in HTML...');
    
    // Patrón para encontrar IDs de anuncios (más flexible)
    const adIdPatterns = [
      /"ad_id":\s*"(\d+)"/gi,
      /"id":\s*"(\d+)"/gi,
      /\?id=(\d+)/gi,
      /ad_id=(\d+)/gi,
      /"adid":\s*"(\d+)"/gi,
    ];
    
    let foundIds = new Set();
    for (const pattern of adIdPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1] && match[1].length >= 10) { // IDs de Facebook son largos
          foundIds.add(match[1]);
        }
      }
    }
    
    console.log('[parseHtmlForAds] Found', foundIds.size, 'potential ad IDs');
    
    // ESTRATEGIA 2: Buscar datos completos de anuncios en estructuras JSON
    console.log('[parseHtmlForAds] Strategy 2: Looking for complete ad data in JSON structures...');
    
    // Buscar estructuras JSON que contengan información de anuncios
    const jsonAdPatterns = [
      /"ad_snapshot_url":\s*"[^"]*id=(\d+)[^"]*"/gi,
      /"snapshot_url":\s*"[^"]*id=(\d+)[^"]*"/gi,
    ];
    
    for (const pattern of jsonAdPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1]) {
          foundIds.add(match[1]);
        }
      }
    }
    
    console.log('[parseHtmlForAds] Total ad IDs found:', foundIds.size);
    
    // Si encontramos IDs, intentar obtener detalles de cada anuncio
    // Limitamos a los primeros 10 anuncios para no sobrecargar
    if (foundIds.size > 0) {
      const idsArray = Array.from(foundIds).slice(0, 10); // Limitar a 10 anuncios
      console.log('[parseHtmlForAds] Will fetch details for', idsArray.length, 'ads');
      
      // Buscar info de anuncios en el HTML (más rápido que hacer peticiones individuales)
      for (const adId of idsArray) {
        // Buscar info del anuncio en el HTML actual
        const adInfo = extractAdInfoFromHtml(html, adId);
        
        ads.push({
          success: true,
          adId: adId,
          id: adId,
          adText: adInfo.adText || 'Anuncio de Facebook',
          pageName: adInfo.pageName || 'Página de Facebook',
          imageUrl: adInfo.imageUrl || null,
          videoUrl: adInfo.videoUrl || null,
          thumbnail: adInfo.imageUrl || null,
          startDate: adInfo.startDate || new Date().toLocaleDateString('es-ES'),
          // Si tiene media URLs, está completo
          _minimal: !adInfo.imageUrl && !adInfo.videoUrl
        });
      }
    }
    
    // ESTRATEGIA 3: Buscar nombre de página
    console.log('[parseHtmlForAds] Strategy 3: Looking for page name...');
    const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/i) || 
                          html.match(/"advertiser_name":\s*"([^"]+)"/i) ||
                          html.match(/<title[^>]*>([^<]+?)\s*\|\s*Facebook Ads Library/i);
    
    let pageName = 'Página de Facebook';
    if (pageNameMatch && pageNameMatch[1]) {
      pageName = decodeUnicode(pageNameMatch[1].trim());
      console.log('[parseHtmlForAds] Found page name:', pageName);
      
      // Actualizar nombre de página en todos los anuncios
      ads.forEach(ad => {
        ad.pageName = pageName;
      });
    }
    
    console.log('[parseHtmlForAds] Returning', ads.length, 'ads');
    
    return {
      ads: ads,
      pageName: pageName,
      pageId: pageId
    };
    
  } catch (error) {
    console.error('[parseHtmlForAds] Error:', error);
    return {
      ads: [],
      pageName: 'Página de Facebook',
      pageId: pageId
    };
  }
}

// Función para extraer info de un anuncio específico del HTML
function extractAdInfoFromHtml(html, adId) {
  try {
    console.log('[extractAdInfoFromHtml] Extracting info for ad:', adId);
    
    // Buscar sección del HTML que contenga este ad ID
    // Facebook suele tener estructuras JSON con la info del anuncio
    const adIdPattern = new RegExp(`"ad_id":\\s*"${adId}"[\\s\\S]{0,5000}`, 'gi');
    const adSection = html.match(adIdPattern);
    
    let adText = null;
    let imageUrl = null;
    let videoUrl = null;
    let startDate = null;
    
    if (adSection && adSection[0]) {
      const section = adSection[0];
      console.log('[extractAdInfoFromHtml] Found section for ad, length:', section.length);
      
      // Buscar texto del anuncio
      const textMatch = section.match(/"ad_creative_body":\s*"([^"]{10,300})"/i) || 
                        section.match(/"body":\s*"([^"]{10,300})"/i) ||
                        section.match(/"message":\s*"([^"]{10,300})"/i);
      if (textMatch && textMatch[1]) {
        adText = decodeUnicode(textMatch[1]).substring(0, 200);
      }
      
      // Buscar URLs de imagen/video con firmas
      const imageUrlMatch = section.match(/https?:\/\/scontent[^"'\s<>()]+\.fbcdn\.net[^"'\s<>()]*\.(jpg|jpeg|png|webp)[?&][^"'\s<>()]*(oe=|oh=)[^"'\s<>()]*/i);
      if (imageUrlMatch && imageUrlMatch[0]) {
        imageUrl = imageUrlMatch[0].replace(/&amp;/g, '&');
        console.log('[extractAdInfoFromHtml] Found image URL (first 150 chars):', imageUrl.substring(0, 150));
      }
      
      // Buscar URLs de video
      const videoUrlPatterns = [
        /"playable_url":\s*"([^"]+)"/i,
        /"sd_src":\s*"([^"]+)"/i,
        /"hd_src":\s*"([^"]+)"/i,
      ];
      
      for (const pattern of videoUrlPatterns) {
        const videoMatch = section.match(pattern);
        if (videoMatch && videoMatch[1]) {
          videoUrl = videoMatch[1]
            .replace(/\\u0025/g, '%')
            .replace(/\\/g, '')
            .replace(/\\u002F/g, '/');
          
          try {
            videoUrl = decodeURIComponent(videoUrl);
            if (videoUrl.startsWith('http')) {
              console.log('[extractAdInfoFromHtml] Found video URL (first 150 chars):', videoUrl.substring(0, 150));
              break;
            }
          } catch (e) {
            videoUrl = null;
          }
        }
      }
      
      // Buscar fecha de inicio
      const dateMatch = section.match(/"start_date":\s*"([^"]+)"/i) ||
                       section.match(/"created_time":\s*"([^"]+)"/i);
      if (dateMatch && dateMatch[1]) {
        try {
          const date = new Date(dateMatch[1]);
          if (!isNaN(date.getTime())) {
            startDate = date.toLocaleDateString('es-ES');
          }
        } catch (e) {
          // Ignorar errores de fecha
        }
      }
    }
    
    // Si no encontramos nada en la sección específica, buscar en todo el HTML cerca del ID
    if (!imageUrl && !videoUrl) {
      console.log('[extractAdInfoFromHtml] No media found in section, searching entire HTML...');
      
      // Buscar cualquier imagen con firma cerca del ad ID
      const htmlAroundId = html.substring(Math.max(0, html.indexOf(adId) - 3000), html.indexOf(adId) + 3000);
      const imageMatch = htmlAroundId.match(/https?:\/\/scontent[^"'\s<>()]+\.fbcdn\.net[^"'\s<>()]*\.(jpg|jpeg|png|webp)[?&][^"'\s<>()]*(oe=|oh=)[^"'\s<>()]*/i);
      if (imageMatch && imageMatch[0]) {
        imageUrl = imageMatch[0].replace(/&amp;/g, '&');
        console.log('[extractAdInfoFromHtml] Found image URL in surrounding HTML');
      }
    }
    
    return {
      adText: adText,
      imageUrl: imageUrl,
      videoUrl: videoUrl,
      startDate: startDate,
      pageName: null // Se actualizará después
    };
    
  } catch (error) {
    console.error('[extractAdInfoFromHtml] Error:', error);
    return {
      adText: null,
      imageUrl: null,
      videoUrl: null,
      startDate: null,
      pageName: null
    };
  }
}

// Función auxiliar para decodificar Unicode
function decodeUnicode(str) {
  return str.replace(/\\u([0-9a-f]{4})/gi, (match, code) => String.fromCharCode(parseInt(code, 16)))
            .replace(/\\\//g, '/')
            .replace(/\\n/g, ' ')
            .replace(/\\"/g, '"');
}

