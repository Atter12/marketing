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
      // CAMBIO: En lugar de retornar error, retornar éxito con array vacío
      // Esto permite que el frontend muestre un mensaje más amigable
      return {
        success: true,
        ads: [],
        pageName: 'Página de Facebook',
        message: 'No se encontraron anuncios en esta página. La página puede no tener anuncios activos o requerir estar logueado.'
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
    console.log('[parseHtmlForAds] HTML length:', html.length);
    console.log('[parseHtmlForAds] HTML preview (first 500 chars):', html.substring(0, 500));
    console.log('[parseHtmlForAds] HTML preview (chars 10000-10500):', html.substring(10000, 10500));
    
    // NUEVO: Buscar bloques de datos de anuncios específicos
    // Facebook usa estructuras como: "edges":[{"node":{"ad_archive_id":"..."}},...]
    console.log('[parseHtmlForAds] Strategy 1.0: Looking for edges/node structures...');
    const edgesPattern = /"edges":\s*\[([^\]]+)\]/gi;
    let edgesMatches = 0;
    let match;
    while ((match = edgesPattern.exec(html)) !== null) {
      edgesMatches++;
      console.log(`[parseHtmlForAds] Found edges structure ${edgesMatches}, length:`, match[1].length);
      // Mostrar una muestra
      if (edgesMatches === 1) {
        console.log('[parseHtmlForAds] First edges content (first 500 chars):', match[1].substring(0, 500));
      }
    }
    
    // Patrón para encontrar IDs de anuncios (MÁS PATRONES)
    const adIdPatterns = [
      // Patrones específicos de Facebook Ads Library
      /"ad_archive_id":\s*"(\d+)"/gi,
      /"adArchiveID":\s*"(\d+)"/gi,
      /"archiveID":\s*"(\d+)"/gi,
      /"snapshot_id":\s*"(\d+)"/gi,
      /"ad_id":\s*"(\d+)"/gi,
      /"adID":\s*"(\d+)"/gi,
      
      // Patrones en URLs
      /ad_archive_id=(\d{15,})/gi,
      /\?id=(\d{15,})/gi,
      /ad_id=(\d{15,})/gi,
      
      // Patrones generales (más restrictivos para evitar falsos positivos)
      /"id":\s*"(\d{15,})"/gi,
    ];
    
    let foundIds = new Set();
    let patternResults = {};
    
    for (let i = 0; i < adIdPatterns.length; i++) {
      const pattern = adIdPatterns[i];
      let count = 0;
      let tempIds = [];
      
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1] && match[1].length >= 15) { // IDs de Facebook son muy largos (15+ dígitos)
          foundIds.add(match[1]);
          tempIds.push(match[1]);
          count++;
          
          // Log first few matches
          if (count <= 3) {
            console.log(`[parseHtmlForAds] Pattern ${i} - Found ID:`, match[1], '- Context:', match[0].substring(0, 100));
          }
        }
      }
      
      patternResults[`Pattern ${i} (${pattern.toString().substring(0, 50)}...)`] = { count, sampleIds: tempIds.slice(0, 3) };
    }
    
    console.log('[parseHtmlForAds] Pattern results:', JSON.stringify(patternResults, null, 2));
    console.log('[parseHtmlForAds] Total unique IDs found after Strategy 1:', foundIds.size);
    
    // Log todos los IDs encontrados
    if (foundIds.size > 0) {
      console.log('[parseHtmlForAds] All found IDs:', Array.from(foundIds));
    }
    
    // ESTRATEGIA 2: Buscar datos completos de anuncios en estructuras JSON
    console.log('[parseHtmlForAds] Strategy 2: Looking for complete ad data in JSON structures...');
    
    // Buscar estructuras JSON que contengan información de anuncios
    const jsonAdPatterns = [
      /"ad_snapshot_url":\s*"[^"]*id=(\d{15,})[^"]*"/gi,
      /"snapshot_url":\s*"[^"]*id=(\d{15,})[^"]*"/gi,
      /"ad_archive_id":\s*"(\d{15,})"/gi,
      /ad_library.*?id=(\d{15,})/gi,
    ];
    
    let jsonPatternResults = {};
    for (let i = 0; i < jsonAdPatterns.length; i++) {
      const pattern = jsonAdPatterns[i];
      let count = 0;
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1]) {
          foundIds.add(match[1]);
          count++;
          
          if (count <= 2) {
            console.log(`[parseHtmlForAds] JSON Pattern ${i} - Found ID:`, match[1]);
          }
        }
      }
      jsonPatternResults[`JSON Pattern ${i}`] = count;
    }
    
    console.log('[parseHtmlForAds] JSON pattern results:', jsonPatternResults);
    console.log('[parseHtmlForAds] Total ad IDs found after Strategy 2:', foundIds.size);
    
    // Log final de todos los IDs únicos
    if (foundIds.size > 0) {
      console.log('[parseHtmlForAds] === FINAL UNIQUE IDs ===');
      console.log('[parseHtmlForAds] Count:', foundIds.size);
      console.log('[parseHtmlForAds] IDs:', Array.from(foundIds));
    } else {
      console.log('[parseHtmlForAds] ⚠️ NO IDs FOUND - This is unusual for an active page');
      console.log('[parseHtmlForAds] Checking if HTML contains "ad" or "archive" keywords...');
      const adKeywordCount = (html.match(/\bad\b/gi) || []).length;
      const archiveKeywordCount = (html.match(/archive/gi) || []).length;
      console.log('[parseHtmlForAds] "ad" keyword count:', adKeywordCount);
      console.log('[parseHtmlForAds] "archive" keyword count:', archiveKeywordCount);
    }
    
    // Si encontramos IDs, intentar obtener detalles de cada anuncio
    // Limitamos a los primeros 10 anuncios para no sobrecargar
    if (foundIds.size > 0) {
      const idsArray = Array.from(foundIds).slice(0, 10); // Limitar a 10 anuncios
      console.log('[parseHtmlForAds] Will fetch details for', idsArray.length, 'ads');
      
      // Buscar info de anuncios en el HTML (más rápido que hacer peticiones individuales)
      let adsWithMedia = 0;
      let adsWithoutMedia = 0;
      
      for (const adId of idsArray) {
        // Buscar info del anuncio en el HTML actual
        const adInfo = extractAdInfoFromHtml(html, adId);
        
        const hasMedia = !!(adInfo.imageUrl || adInfo.videoUrl);
        if (hasMedia) {
          adsWithMedia++;
        } else {
          adsWithoutMedia++;
        }
        
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
          // Marcar como minimal si NO tiene media con firmas válidas
          _minimal: !hasMedia,
          // Agregar URL para que el frontend pueda obtener detalles completos después
          _detailsUrl: `https://www.facebook.com/ads/library/?id=${adId}`
        });
      }
      
      console.log('[parseHtmlForAds] === SUMMARY ===');
      console.log('[parseHtmlForAds] Ads with media (ready to download):', adsWithMedia);
      console.log('[parseHtmlForAds] Ads without media (need details fetch):', adsWithoutMedia);
      
      // Si NINGÚN anuncio tiene media, mostrar advertencia
      if (adsWithMedia === 0 && ads.length > 0) {
        console.log('[parseHtmlForAds] ⚠️ WARNING: No ads have valid media URLs with signatures!');
        console.log('[parseHtmlForAds] This usually means Facebook changed their HTML structure.');
        console.log('[parseHtmlForAds] Frontend will need to fetch individual ad details.');
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
      
      // Buscar URLs de imagen/video con firmas (MEJORADO)
      // Necesitamos capturar TODO incluyendo oh= y oe= que son CRÍTICOS
      const imageUrlPatterns = [
        // Patrón 1: Buscar URLs completas en atributos JSON con escape
        /"(?:image_url|src|url)":\s*"(https?:\/\/scontent[^"]+\.fbcdn\.net[^"]+\.(jpg|jpeg|png|webp)[^"]+)"/i,
        // Patrón 2: Buscar URLs en HTML sin escape
        /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net[^"'\s<>]*\.(jpg|jpeg|png|webp)\?[^"'\s<>]+(?:oe=|oh=)[^"'\s<>]+/i,
        // Patrón 3: Más flexible, captura todo hasta encontrar comillas o espacios
        /https?:\/\/scontent[^"']+\.fbcdn\.net[^"']*\.(jpg|jpeg|png|webp)\?[^"']+/i,
      ];
      
      for (const pattern of imageUrlPatterns) {
        const match = section.match(pattern);
        if (match) {
          // El match[1] existe si usamos grupos de captura, sino match[0]
          let url = match[1] || match[0];
          
          // Limpiar escapes
          url = url
            .replace(/\\u002F/g, '/')
            .replace(/\\\//g, '/')
            .replace(/&amp;/g, '&')
            .replace(/\\"/g, '');
          
          // VALIDAR que la URL tenga firmas (oh= o oe=)
          if (url.includes('oh=') || url.includes('oe=')) {
            imageUrl = url;
            console.log('[extractAdInfoFromHtml] Found image URL with signature (first 200 chars):', imageUrl.substring(0, 200));
            console.log('[extractAdInfoFromHtml] Image URL has oh=?', url.includes('oh='), 'has oe=?', url.includes('oe='));
            break;
          } else {
            console.log('[extractAdInfoFromHtml] WARNING: Found image URL but WITHOUT signature, skipping:', url.substring(0, 150));
          }
        }
      }
      
      if (!imageUrl) {
        console.log('[extractAdInfoFromHtml] No valid image URL found with signature in section');
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
      console.log('[extractAdInfoFromHtml] No media found in section, searching surrounding HTML...');
      
      // Buscar en un rango más amplio alrededor del ID
      const idPos = html.indexOf(adId);
      if (idPos !== -1) {
        const start = Math.max(0, idPos - 5000);
        const end = Math.min(html.length, idPos + 5000);
        const htmlAroundId = html.substring(start, end);
        
        console.log('[extractAdInfoFromHtml] Searching in range:', start, 'to', end, 'length:', htmlAroundId.length);
        
        // Intentar múltiples patrones para encontrar URLs completas
        const searchPatterns = [
          // Patrón 1: URL con todos los parámetros incluyendo oh= y oe=
          /https?:\/\/scontent[^"'\s]+\.fbcdn\.net[^"'\s]*\.(jpg|jpeg|png|webp)\?[^"'\s]*(?:oh=|oe=)[^"'\s]*/gi,
          // Patrón 2: Buscar en atributos JSON
          /"(?:image_url|src|url|uri)":\s*"(https?:\/\/[^"]+\.fbcdn\.net[^"]+\.(jpg|jpeg|png|webp)[^"]+)"/gi,
        ];
        
        for (const pattern of searchPatterns) {
          let matches = [];
          let match;
          pattern.lastIndex = 0;
          
          while ((match = pattern.exec(htmlAroundId)) !== null && matches.length < 5) {
            const url = (match[1] || match[0])
              .replace(/\\u002F/g, '/')
              .replace(/\\\//g, '/')
              .replace(/&amp;/g, '&')
              .replace(/\\"/g, '');
            
            if ((url.includes('oh=') || url.includes('oe=')) && !url.includes('s50x50')) {
              matches.push(url);
            }
          }
          
          if (matches.length > 0) {
            console.log('[extractAdInfoFromHtml] Found', matches.length, 'URLs with signatures in surrounding HTML');
            // Usar la URL más larga (usualmente es la de mejor calidad)
            imageUrl = matches.sort((a, b) => b.length - a.length)[0];
            console.log('[extractAdInfoFromHtml] Selected best URL (first 200 chars):', imageUrl.substring(0, 200));
            break;
          }
        }
        
        if (!imageUrl) {
          console.log('[extractAdInfoFromHtml] WARNING: No URLs with valid signatures found near ad ID');
        }
      } else {
        console.log('[extractAdInfoFromHtml] WARNING: Ad ID not found in HTML');
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

