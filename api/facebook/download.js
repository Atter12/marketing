// Vercel Serverless Function para descargar anuncios de Facebook Ads Library
// Intenta primero con Puppeteer (más confiable), luego usa método tradicional como fallback
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
    const { url, type = 'ad', usePlaywright = false } = req.body; // Playwright deshabilitado: requiere binarios no disponibles en Vercel
    console.log('Received URL:', url);
    console.log('Received type:', type);
    console.log('Use Playwright:', usePlaywright);

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

    // Intentar primero con Playwright si está habilitado
    // Playwright funciona mejor en serverless que Puppeteer
    if (usePlaywright) {
      try {
        console.log('Attempting with Playwright...');
        const playwrightResult = await fetchWithPlaywright(normalizedUrl, adId);
        if (playwrightResult && (playwrightResult.imageUrl || playwrightResult.videoUrl || playwrightResult.imageBase64 || playwrightResult.videoBase64)) {
          console.log('Playwright method succeeded!');
          return res.status(200).json({
            success: true,
            adId,
            id: adId,
            ...playwrightResult,
            method: 'playwright'
          });
        }
      } catch (playwrightError) {
        console.log('Playwright method failed or not available, falling back to traditional method...');
        console.log('Playwright error:', playwrightError.message);
        
        // Continuar con el método tradicional mejorado
      }
    }

    console.log('Using traditional fetch method...');
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

    // Si tenemos URLs de imagen/video, intentar descargarlas inmediatamente para evitar expiración de firma
    // Convertirlas a base64 y servirlas directamente para evitar el problema de 403
    let imageBase64 = null;
    let videoBase64 = null;
    
    // Función auxiliar para descargar imagen con múltiples estrategias
    const downloadImageWithStrategies = async (imageUrl) => {
      if (!imageUrl) return null;
      
      const downloadStrategies = [
        // Estrategia 1: URL original completa
        {
          url: imageUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.facebook.com/ads/library/',
            'Accept': 'image/*,*/*;q=0.8',
            'Origin': 'https://www.facebook.com',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Dest': 'image',
          }
        },
        // Estrategia 2: URL sin parámetros de firma (oe, oh)
        {
          url: imageUrl.split('&oe=')[0].split('&oh=')[0].split('?oe=')[0].split('?oh=')[0],
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.facebook.com/ads/library/',
            'Accept': 'image/*',
            'Origin': 'https://www.facebook.com',
          }
        },
        // Estrategia 3: URL sin parámetro stp (tamaño)
        {
          url: (() => {
            const parts = imageUrl.split('?');
            if (parts.length > 1) {
              const params = parts[1].split('&').filter(p => !p.includes('stp='));
              return parts[0] + '?' + params.join('&');
            }
            return imageUrl;
          })(),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.facebook.com/',
          }
        }
      ];
      
      for (let i = 0; i < downloadStrategies.length; i++) {
        const strategy = downloadStrategies[i];
        try {
          console.log(`[Download Image] Strategy ${i + 1}: Trying to download from ${strategy.url.substring(0, 150)}...`);
          const response = await fetch(strategy.url, {
            headers: strategy.headers,
            redirect: 'follow'
          });
          
          console.log(`[Download Image] Strategy ${i + 1} - Response status:`, response.status);
          
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const dataUrl = `data:${contentType};base64,${base64}`;
            console.log(`[Download Image] Strategy ${i + 1} - SUCCESS! Downloaded ${base64.length} bytes`);
            return dataUrl;
          } else {
            const errorText = await response.text().catch(() => '');
            console.log(`[Download Image] Strategy ${i + 1} - Failed:`, response.status, errorText.substring(0, 100));
          }
        } catch (err) {
          console.log(`[Download Image] Strategy ${i + 1} - Error:`, err.message);
        }
      }
      
      return null;
    };
    
    if (apiResponse.imageUrl) {
      console.log('Attempting to download image immediately to avoid signature expiration...');
      imageBase64 = await downloadImageWithStrategies(apiResponse.imageUrl);
      if (imageBase64) {
        console.log('SUCCESS: Image downloaded and converted to base64');
      } else {
        console.log('WARNING: Could not download image with any strategy - will use proxy as fallback');
      }
    }
    
    if (apiResponse.videoUrl) {
      console.log('Attempting to download video immediately to avoid signature expiration...');
      // Similar para video (simplificado por ahora)
      try {
        const videoResponse = await fetch(apiResponse.videoUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.facebook.com/ads/library/',
            'Accept': 'video/*,*/*;q=0.8',
            'Origin': 'https://www.facebook.com',
          },
          redirect: 'follow'
        });
        
        if (videoResponse.ok) {
          const videoBuffer = await videoResponse.arrayBuffer();
          videoBase64 = Buffer.from(videoBuffer).toString('base64');
          const contentType = videoResponse.headers.get('content-type') || 'video/mp4';
          videoBase64 = `data:${contentType};base64,${videoBase64}`;
          console.log('SUCCESS: Video downloaded and converted to base64, size:', videoBase64.length);
        } else {
          console.log('Failed to download video directly:', videoResponse.status);
        }
      } catch (vidError) {
        console.log('Error downloading video directly:', vidError.message);
      }
    }

    console.log('SUCCESS: Returning ad data');
    return res.status(200).json({
      success: true,
      adId,
      id: adId,
      videoUrl: apiResponse.videoUrl,
      videoBase64: videoBase64, // Agregar base64 como alternativa
      imageUrl: apiResponse.imageUrl,
      imageBase64: imageBase64, // Agregar base64 como alternativa
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
          console.log('[fetchFacebookAd] Strategy 1 - SUCCESS! Parsed data from HTML');
          
          // IMPORTANTE: Si tenemos URLs de imagen/video, intentar descargarlas INMEDIATAMENTE
          // mientras la firma todavía es válida, y convertir a base64 para evitar expiración
          if (result.imageUrl) {
            try {
              console.log('[fetchFacebookAd] Strategy 1 - Attempting immediate image download while signature is fresh...');
              const imgResponse = await fetch(result.imageUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Referer': 'https://www.facebook.com/ads/library/',
                  'Accept': 'image/*,*/*;q=0.8',
                  'Origin': 'https://www.facebook.com',
                },
                redirect: 'follow'
              });
              
              if (imgResponse.ok) {
                const imgBuffer = await imgResponse.arrayBuffer();
                const imgBase64 = Buffer.from(imgBuffer).toString('base64');
                const imgContentType = imgResponse.headers.get('content-type') || 'image/jpeg';
                result.imageBase64 = `data:${imgContentType};base64,${imgBase64}`;
                console.log('[fetchFacebookAd] Strategy 1 - Image downloaded and converted to base64, size:', imgBase64.length);
              } else {
                console.log('[fetchFacebookAd] Strategy 1 - Image download failed:', imgResponse.status);
              }
            } catch (imgErr) {
              console.log('[fetchFacebookAd] Strategy 1 - Image download error:', imgErr.message);
            }
          }
          
          if (result.videoUrl) {
            try {
              console.log('[fetchFacebookAd] Strategy 1 - Attempting immediate video download while signature is fresh...');
              const vidResponse = await fetch(result.videoUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Referer': 'https://www.facebook.com/ads/library/',
                  'Accept': 'video/*,*/*;q=0.8',
                  'Origin': 'https://www.facebook.com',
                },
                redirect: 'follow'
              });
              
              if (vidResponse.ok) {
                const vidBuffer = await vidResponse.arrayBuffer();
                const vidBase64 = Buffer.from(vidBuffer).toString('base64');
                const vidContentType = vidResponse.headers.get('content-type') || 'video/mp4';
                result.videoBase64 = `data:${vidContentType};base64,${vidBase64}`;
                console.log('[fetchFacebookAd] Strategy 1 - Video downloaded and converted to base64, size:', vidBase64.length);
              } else {
                console.log('[fetchFacebookAd] Strategy 1 - Video download failed:', vidResponse.status);
              }
            } catch (vidErr) {
              console.log('[fetchFacebookAd] Strategy 1 - Video download error:', vidErr.message);
            }
          }
          
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
      // - window.__d("PageAdDetailPage",...) con URLs completas
      
      // Patrón 1: Buscar datos JSON en script tags con URLs completas
      console.log('[parseHtmlForAdData] Pattern 1: Searching for JSON in script tags...');
      
      // NUEVO: Buscar URLs de imagen completas en estructuras JSON embebidas
      console.log('[parseHtmlForAdData] Pattern 1.0: Searching for complete image URLs in JSON structures...');
      const jsonUrlPatterns = [
        /"image_url":\s*"([^"]+fbcdn\.net[^"]+\.(jpg|jpeg|png|webp)[^"]*(?:oe=|oh=)[^"]*)"/gi,
        /"image":\s*\{[^}]*"uri":\s*"([^"]+fbcdn\.net[^"]+\.(jpg|jpeg|png|webp)[^"]*(?:oe=|oh=)[^"]*)"/gi,
        /"photo":\s*\{[^}]*"uri":\s*"([^"]+fbcdn\.net[^"]+\.(jpg|jpeg|png|webp)[^"]*(?:oe=|oh=)[^"]*)"/gi,
        /"src":\s*"([^"]+fbcdn\.net[^"]+\.(jpg|jpeg|png|webp)[^"]*(?:oe=|oh=)[^"]*)"/gi,
        /"url":\s*"([^"]+fbcdn\.net[^"]+\.(jpg|jpeg|png|webp)[^"]*(?:oe=|oh=)[^"]*)"/gi,
      ];
      
      let foundCompleteUrls = [];
      for (const pattern of jsonUrlPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1]) {
            const url = match[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');
            if (url.includes('oe=') && !url.includes('s50x50') && !url.includes('profile')) {
              foundCompleteUrls.push(url);
            }
          }
        }
      }
      
      if (foundCompleteUrls.length > 0) {
        // Remover duplicados y ordenar por longitud
        foundCompleteUrls = [...new Set(foundCompleteUrls)].sort((a, b) => b.length - a.length);
        console.log('[parseHtmlForAdData] Pattern 1.0: Found', foundCompleteUrls.length, 'complete URLs with signatures in JSON');
        console.log('[parseHtmlForAdData] Pattern 1.0 - Best URL (first 250 chars):', foundCompleteUrls[0].substring(0, 250));
        
        const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/i) || html.match(/"advertiser_name":\s*"([^"]+)"/i);
        const adTextMatch = html.match(/"ad_creative_body":\s*"([^"]{10,500})"/i) || html.match(/"body":\s*"([^"]{10,500})"/i);
        
        return {
          success: true,
          videoUrl: null,
          imageUrl: foundCompleteUrls[0],
          thumbnail: foundCompleteUrls[0],
          pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
          adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 300) : 'Anuncio de Facebook',
          startDate: new Date().toLocaleDateString('es-ES')
        };
      }
      
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
      
      // === PATRONES DE LA EXTENSIÓN CHROME === //
      // Estos patrones son los que USA la extensión que funciona
      console.log('[parseHtmlForAdData] Pattern 2: USANDO PATRONES DE EXTENSIÓN CHROME...');
      
      // Patrón 2.0: Buscar patrones EXACTOS de la extensión para videos
      console.log('[parseHtmlForAdData] Pattern 2.0: Buscando con patrones de extensión...');
      const extensionVideoPatterns = [
        /"playable_url":"([^"]+)"/gi,
        /"playable_url_quality_hd":"([^"]+)"/gi,
        /"sd_src":"([^"]+)"/gi,
        /"hd_src":"([^"]+)"/gi,
      ];
      
      let extensionVideoMatches = [];
      for (const pattern of extensionVideoPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1]) {
            // Limpiar escape sequences (EXACTAMENTE como la extensión)
            let url = match[1].replace(/\\u0025/g, '%').replace(/\\/g, '');
            url = decodeURIComponent(url);
            if (url && url.startsWith('http')) {
              extensionVideoMatches.push(url);
              console.log('[parseHtmlForAdData] Pattern 2.0 - Found video URL con patrón de extensión!');
              console.log('[parseHtmlForAdData] Pattern 2.0 - URL (first 250 chars):', url.substring(0, 250));
            }
          }
        }
      }
      
      if (extensionVideoMatches.length > 0) {
        // Usar el mejor video encontrado
        extensionVideoMatches = [...new Set(extensionVideoMatches)];
        const bestVideo = extensionVideoMatches.sort((a, b) => b.length - a.length)[0];
        
        console.log('[parseHtmlForAdData] Pattern 2.0: SUCCESS - Video encontrado con patrones de extensión!');
        
        const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/i) || html.match(/"advertiser_name":\s*"([^"]+)"/i);
        const adTextMatch = html.match(/"ad_creative_body":\s*"([^"]{10,500})"/i) || html.match(/"body":\s*"([^"]{10,500})"/i);
        
        return {
          success: true,
          videoUrl: bestVideo,
          imageUrl: null,
          thumbnail: null,
          pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
          adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 300) : 'Anuncio de Facebook',
          startDate: new Date().toLocaleDateString('es-ES')
        };
      }
      
      // Patrón 2.1: Buscar URLs completas con firmas en atributos data-* codificados
      const encodedUrlPatterns = [
        /data-store="({[^"]+fbcdn[^"]+\.(jpg|jpeg|png|webp)[^"]*(?:oe=|oh=)[^"]+})"/gi,
        /data-a11y-store="({[^"]+fbcdn[^"]+\.(jpg|jpeg|png|webp)[^"]*(?:oe=|oh=)[^"]+})"/gi,
        /data-bootloader-hydrate="({[^"]+fbcdn[^"]+\.(jpg|jpeg|png|webp)[^"]*(?:oe=|oh=)[^"]+})"/gi,
        /data-ssrc="([^"]+fbcdn[^"]+\.(jpg|jpeg|png|webp)[^"]*(?:oe=|oh=)[^"]+)"/gi,
        /data-img="([^"]+fbcdn[^"]+\.(jpg|jpeg|png|webp)[^"]*(?:oe=|oh=)[^"]+)"/gi,
      ];
      
      for (const pattern of encodedUrlPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1] || match[0]) {
            const potentialUrl = match[1] || match[0];
            // Intentar decodificar si es JSON (MEJORADO: como la extensión)
            try {
              // Limpiar escape sequences EXACTAMENTE como la extensión
              let decoded = potentialUrl
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/\\u002F/g, '/')
                .replace(/\\\//g, '/')
                .replace(/\\u0025/g, '%')
                .replace(/\\/g, '');
              
              // Intentar decodificar URL encoded
              try {
                decoded = decodeURIComponent(decoded);
              } catch (e) {
                // Si falla, continuar con la versión limpia
              }
              
              const jsonMatch = decoded.match(/"uri":\s*"([^"]+)"/) || decoded.match(/"url":\s*"([^"]+)"/) || decoded.match(/"src":\s*"([^"]+)"/);
              if (jsonMatch && jsonMatch[1]) {
                const url = jsonMatch[1];
                if (url.includes('fbcdn.net') && url.includes('oe=') && url.includes('oh=') && !url.includes('s50x50')) {
                  console.log('[parseHtmlForAdData] Pattern 2.1: Found complete URL in data-* attribute!');
                  console.log('[parseHtmlForAdData] Pattern 2.1 - URL (first 250 chars):', url.substring(0, 250));
                  
                  const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/i) || html.match(/"advertiser_name":\s*"([^"]+)"/i);
                  const adTextMatch = html.match(/"ad_creative_body":\s*"([^"]{10,500})"/i) || html.match(/"body":\s*"([^"]{10,500})"/i);
                  
                  return {
                    success: true,
                    videoUrl: null,
                    imageUrl: url,
                    thumbnail: url,
                    pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
                    adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 300) : 'Anuncio de Facebook',
                    startDate: new Date().toLocaleDateString('es-ES')
                  };
                }
              }
            } catch (e) {
              // Si no es JSON, puede ser URL directa (MEJORADO)
              if (potentialUrl.includes('fbcdn.net') && potentialUrl.includes('oe=') && !potentialUrl.includes('s50x50')) {
                let url = potentialUrl
                  .replace(/&amp;/g, '&')
                  .replace(/&quot;/g, '')
                  .replace(/\\u002F/g, '/')
                  .replace(/\\\//g, '/')
                  .replace(/\\u0025/g, '%')
                  .replace(/\\/g, '');
                
                // Intentar decodificar URL encoded
                try {
                  url = decodeURIComponent(url);
                } catch (e) {}
                
                console.log('[parseHtmlForAdData] Pattern 2.1: Found direct URL in data-* attribute!');
                
                const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/i) || html.match(/"advertiser_name":\s*"([^"]+)"/i);
                const adTextMatch = html.match(/"ad_creative_body":\s*"([^"]{10,500})"/i) || html.match(/"body":\s*"([^"]{10,500})"/i);
                
                return {
                  success: true,
                  videoUrl: null,
                  imageUrl: url,
                  thumbnail: url,
                  pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
                  adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 300) : 'Anuncio de Facebook',
                  startDate: new Date().toLocaleDateString('es-ES')
                };
              }
            }
          }
        }
      }
      
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
      
      // NUEVO: Buscar URLs con parámetros de firma completos primero
      // Las URLs con firmas válidas tienen parámetros como oe=, oh=, etc.
      console.log('[parseHtmlForAdData] Pattern 3.0: Searching for complete URLs with signature parameters...');
      const completeImageUrlPattern = /https?:\/\/scontent[^"'\s<>()]+\.fbcdn\.net[^"'\s<>()]*\/v\/t[^"'\s<>()]*\.(jpg|jpeg|png|webp)[?&][^"'\s<>()]*(oe=|oh=)[^"'\s<>()]*/gi;
      const completeImageMatches = html.match(completeImageUrlPattern) || [];
      console.log('[parseHtmlForAdData] Pattern 3.0 - Found', completeImageMatches.length, 'complete image URLs with signature parameters');
      
      // Si encontramos URLs completas con firmas, usarlas primero
      if (completeImageMatches.length > 0) {
        // Filtrar thumbnails
        const fullSizeImages = completeImageMatches.filter(url => 
          !url.includes('s50x50') && 
          !url.includes('s100x100') && 
          !url.includes('profile') &&
          !url.includes('avatar') &&
          url.includes('oe=') && // Debe tener parámetro oe (signature)
          (url.includes('oh=') || url.includes('&oh=')) // Debe tener parámetro oh (signature)
        );
        
        if (fullSizeImages.length > 0) {
          // Ordenar por longitud (URLs más largas suelen tener más parámetros)
          fullSizeImages.sort((a, b) => b.length - a.length);
          const bestUrl = fullSizeImages[0].replace(/&amp;/g, '&').replace(/\\\//g, '/');
          
          console.log('[parseHtmlForAdData] Pattern 3.0: SUCCESS - Found complete URL with signature!');
          console.log('[parseHtmlForAdData] Pattern 3.0 - Complete URL (first 250 chars):', bestUrl.substring(0, 250));
          
          const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/i) || html.match(/"advertiser_name":\s*"([^"]+)"/i);
          const adTextMatch = html.match(/"ad_creative_body":\s*"([^"]{10,500})"/i) || html.match(/"body":\s*"([^"]{10,500})"/i);
          
          return {
            success: true,
            videoUrl: null,
            imageUrl: bestUrl,
            thumbnail: bestUrl,
            pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
            adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 300) : 'Anuncio de Facebook',
            startDate: new Date().toLocaleDateString('es-ES')
          };
        }
      }
      
      // ESTRATEGIA MEJORADA: Buscar videos de múltiples formas
      // 1. Buscar directamente URLs .mp4 en todo el HTML
      console.log('[parseHtmlForAdData] Pattern 3a: Searching for .mp4 URLs anywhere in HTML...');
      const allMp4Pattern = /https?:\/\/[^"'\s<>()]+\.mp4[^"'\s<>()]*/gi;
      const allMp4Matches = html.match(allMp4Pattern) || [];
      console.log('[parseHtmlForAdData] Pattern 3a - Found', allMp4Matches.length, 'potential .mp4 URLs');
      
      // 2. Buscar en estructuras JSON específicas
      console.log('[parseHtmlForAdData] Pattern 3b: Searching for videos in JSON structures...');
      const jsonVideoPatterns = [
        /"video_url":\s*"([^"]+)"/gi,
        /"video":\s*\{[^}]*"uri":\s*"([^"]+)"/gi,
        /"source":\s*"([^"]+)"/gi,
        /"playback_url":\s*"([^"]+)"/gi,
        /"hd":\s*"([^"]+)"/gi,
        /"sd":\s*"([^"]+)"/gi,
        /"url_list":\s*\["([^"]+)"/gi,
      ];
      
      let jsonVideoMatches = [];
      for (const pattern of jsonVideoPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1] && (match[1].includes('.mp4') || match[1].includes('fbcdn.net/v/') || match[1].includes('video'))) {
            jsonVideoMatches.push(match[1].replace(/\\\//g, '/').replace(/\\u002F/g, '/'));
          }
        }
      }
      console.log('[parseHtmlForAdData] Pattern 3b - Found', jsonVideoMatches.length, 'video URLs in JSON');
      
      // 3. Buscar en atributos HTML
      console.log('[parseHtmlForAdData] Pattern 3c: Searching for videos in HTML attributes...');
      const attrVideoPatterns = [
        /data-video-url=["']([^"']+)["']/gi,
        /data-src=["']([^"']+\.mp4[^"']*)["']/gi,
        /src=["']([^"']+\.mp4[^"']*)["']/gi,
        /href=["']([^"']+\.mp4[^"']*)["']/gi,
      ];
      
      let attrVideoMatches = [];
      for (const pattern of attrVideoPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1] && match[1].includes('.mp4')) {
            attrVideoMatches.push(match[1]);
          }
        }
      }
      console.log('[parseHtmlForAdData] Pattern 3c - Found', attrVideoMatches.length, 'video URLs in attributes');
      
      // 4. Buscar patrones específicos de CDN de Facebook
      const cdnVideoPatterns = [
        /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net[^"'\s<>]*\/v\/t[^"'\s<>]*\.mp4[^"'\s<>]*/gi,
        /https?:\/\/video[^"'\s<>]+\.fbcdn\.net[^"'\s<>]*\/v\/t[^"'\s<>]*\.mp4[^"'\s<>]*/gi,
        /https?:\/\/[^"'\s<>]+\.fbcdn\.net[^"'\s<>]*\/v\/[^"'\s<>]*\.mp4[^"'\s<>]*/gi,
      ];
      
      let cdnVideoMatches = [];
      for (const pattern of cdnVideoPatterns) {
        const matches = html.match(pattern) || [];
        cdnVideoMatches.push(...matches);
      }
      console.log('[parseHtmlForAdData] Pattern 3d - Found', cdnVideoMatches.length, 'CDN video URLs');
      
      // Combinar todos los resultados
      let videoMatches = [...allMp4Matches, ...jsonVideoMatches, ...attrVideoMatches, ...cdnVideoMatches];
      
      // Limpiar y filtrar URLs de video
      videoMatches = videoMatches
        .map(url => url.replace(/&amp;/g, '&').replace(/\\\//g, '/').replace(/\\u002F/g, '/').trim())
        .filter(url => 
          url.startsWith('http') &&
          (url.includes('.mp4') || url.includes('fbcdn.net/v/')) &&
          !url.includes('thumbnail') &&
          !url.includes('preview') &&
          !url.includes('cover')
        );
      
      // Remover duplicados
      videoMatches = [...new Set(videoMatches)];
      
      console.log('[parseHtmlForAdData] Pattern 3 - Total unique video URLs found:', videoMatches.length);
      
        // Buscar imágenes - primero buscar URLs con parámetros de firma completos
        const cdnImagePatternWithParams = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net[^"'\s<>]*\/v\/t[^"'\s<>]*\.(jpg|jpeg|png|webp)[?&][^"'\s<>]+(oe=|oh=)[^"'\s<>]+/gi;
        const imageMatchesWithParams = html.match(cdnImagePatternWithParams) || [];
        
        console.log('[parseHtmlForAdData] Pattern 3 - Image matches with signature params found:', imageMatchesWithParams.length);
        
        // CRÍTICO: Validar que las URLs tengan AMBOS parámetros oh= Y oe=
        if (imageMatchesWithParams.length > 0) {
          const validImages = imageMatchesWithParams.filter(url => {
            const cleanUrl = url.replace(/&amp;/g, '&');
            const hasOh = cleanUrl.includes('oh=') || cleanUrl.includes('&oh=');
            const hasOe = cleanUrl.includes('oe=') || cleanUrl.includes('&oe=');
            const isNotThumbnail = !cleanUrl.includes('s50x50') && 
                                   !cleanUrl.includes('profile') && 
                                   !cleanUrl.includes('avatar');
            
            console.log('[parseHtmlForAdData] Validating URL:', {
              hasOh,
              hasOe,
              isNotThumbnail,
              url: cleanUrl.substring(0, 150)
            });
            
            return hasOh && hasOe && isNotThumbnail;
          });
          
          console.log('[parseHtmlForAdData] Pattern 3 - Valid images with BOTH oh= and oe=:', validImages.length);
          
          if (validImages.length > 0) {
            validImages.sort((a, b) => b.length - a.length);
            let imageUrl = validImages[0].replace(/&amp;/g, '&').replace(/\\\//g, '/');
            
            console.log('[parseHtmlForAdData] Pattern 3: SUCCESS - Found image URL with complete signature!');
            console.log('[parseHtmlForAdData] Pattern 3 - Complete URL (first 300 chars):', imageUrl.substring(0, 300));
            console.log('[parseHtmlForAdData] Pattern 3 - URL has oh=?', imageUrl.includes('oh='));
            console.log('[parseHtmlForAdData] Pattern 3 - URL has oe=?', imageUrl.includes('oe='));
            
            const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/i) || html.match(/"advertiser_name":\s*"([^"]+)"/i);
            const adTextMatch = html.match(/"ad_creative_body":\s*"([^"]{10,500})"/i) || html.match(/"body":\s*"([^"]{10,500})"/i);
            
            return {
              success: true,
              videoUrl: null,
              imageUrl: imageUrl,
              thumbnail: imageUrl,
              pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
              adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 300) : 'Anuncio de Facebook',
              startDate: new Date().toLocaleDateString('es-ES')
            };
          } else {
            console.log('[parseHtmlForAdData] Pattern 3 - WARNING: Found URLs but none have BOTH oh= and oe= parameters');
          }
        }
      
      // Si no encontramos con parámetros completos, buscar todas las imágenes
      // PERO SOLO aquellas que tengan oh= Y oe=
      console.log('[parseHtmlForAdData] Pattern 3.1 - Searching for all CDN image URLs...');
      const cdnImagePattern = /https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net[^"'\s<>]*\/v\/t[^"'\s<>]*\.(jpg|jpeg|png|webp)[^"'\s<>]*/gi;
      const imageMatches = html.match(cdnImagePattern);
      
      console.log('[parseHtmlForAdData] Pattern 3 - Video matches found:', videoMatches.length);
      console.log('[parseHtmlForAdData] Pattern 3 - Image matches found:', imageMatches ? imageMatches.length : 0);
      
      // Mostrar primeros videos encontrados para debugging
      if (videoMatches.length > 0) {
        console.log('[parseHtmlForAdData] Pattern 3 - Sample video URLs (first 3):', videoMatches.slice(0, 3).map(url => url.substring(0, 150)));
      }

      if (videoMatches && videoMatches.length > 0) {
        // Filtrar videos que sean realmente del anuncio (no thumbnails o previews)
        const adVideos = videoMatches.filter(url => 
          !url.includes('thumbnail') &&
          !url.includes('preview') &&
          !url.includes('cover') &&
          url.includes('.mp4')
        );
        
        // Usar videos filtrados o todos si no hay filtrados
        const videosToUse = adVideos.length > 0 ? adVideos : videoMatches;
        
        // Ordenar por longitud (URLs más largas suelen ser de mejor calidad) y tomar el mejor
        videosToUse.sort((a, b) => b.length - a.length);
        
        let videoUrl = videosToUse[0].replace(/&amp;/g, '&').replace(/\\\//g, '/').replace(/\\u002F/g, '/');
        
        // Corregir URL si tiene parámetros mal formados (debe empezar con ? no &)
        if (videoUrl.includes('.mp4&')) {
          videoUrl = videoUrl.replace(/(\.mp4)&/, '$1?');
        }
        
        // Asegurar que la URL sea válida
        if (!videoUrl.startsWith('http')) {
          videoUrl = 'https:' + videoUrl;
        }
        
        console.log('[parseHtmlForAdData] Pattern 3: SUCCESS - Found video URL directly from HTML');
        console.log('[parseHtmlForAdData] Pattern 3 - Total videos found:', videoMatches.length, 'Filtered:', adVideos.length);
        console.log('[parseHtmlForAdData] Pattern 3 - Video URL (first 150 chars):', videoUrl.substring(0, 150));
        
        // Buscar datos adicionales en el HTML con patrones mejorados
        const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/i) || 
                              html.match(/"advertiser_name":\s*"([^"]+)"/i) ||
                              html.match(/page_name["']?\s*:\s*["']([^"']+)["']/i) ||
                              html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
        
        const adTextPatterns = [
          /"ad_creative_body":\s*"([^"]{10,500})"/i,
          /"body":\s*"([^"]{10,500})"/i,
          /"message":\s*"([^"]{10,500})"/i,
          /"text":\s*"([^"]{10,500})"/i,
          /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']{10,500})["']/i
        ];
        
        let adTextMatch = null;
        for (const pattern of adTextPatterns) {
          adTextMatch = html.match(pattern);
          if (adTextMatch && adTextMatch[1]) break;
        }
        
        return {
          success: true,
          videoUrl: videoUrl,
          imageUrl: null,
          thumbnail: null,
          pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
          adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 300) : 'Anuncio de Facebook',
          startDate: new Date().toLocaleDateString('es-ES')
        };
      }
      
      if (imageMatches && imageMatches.length > 0) {
        console.log('[parseHtmlForAdData] Pattern 3.2 - Processing image matches...');
        
        // PRIMERO: Filtrar solo imágenes que tengan parámetros de firma (oh= o oe=)
        const imagesWithSignatures = imageMatches.filter(url => {
          const cleanUrl = url.replace(/&amp;/g, '&');
          return (cleanUrl.includes('oh=') || cleanUrl.includes('oe=')) && 
                 !cleanUrl.includes('s50x50') &&
                 !cleanUrl.includes('s100x100') &&
                 !cleanUrl.includes('profile');
        });
        
        console.log('[parseHtmlForAdData] Pattern 3.2 - Images with signatures (oh= or oe=):', imagesWithSignatures.length, 'out of', imageMatches.length);
        
        if (imagesWithSignatures.length > 0) {
          // Priorizar imágenes que tengan AMBOS oh= Y oe=
          const imagesWithBothSignatures = imagesWithSignatures.filter(url => {
            const cleanUrl = url.replace(/&amp;/g, '&');
            return cleanUrl.includes('oh=') && cleanUrl.includes('oe=');
          });
          
          console.log('[parseHtmlForAdData] Pattern 3.2 - Images with BOTH oh= and oe=:', imagesWithBothSignatures.length);
          
          // Usar imágenes con ambas firmas si existen, sino usar las que tengan al menos una
          const imagesToUse = imagesWithBothSignatures.length > 0 ? imagesWithBothSignatures : imagesWithSignatures;
          
          // Ordenar por longitud (URLs más largas = mejor calidad)
          imagesToUse.sort((a, b) => b.length - a.length);
          let imageUrl = imagesToUse[0].replace(/&amp;/g, '&').replace(/\\\//g, '/').replace(/\\u002F/g, '/');
          
          console.log('[parseHtmlForAdData] Pattern 3.2: SUCCESS - Found image URL with signature(s)');
          console.log('[parseHtmlForAdData] Pattern 3.2 - Image URL (first 300 chars):', imageUrl.substring(0, 300));
          console.log('[parseHtmlForAdData] Pattern 3.2 - URL has oh=?', imageUrl.includes('oh='));
          console.log('[parseHtmlForAdData] Pattern 3.2 - URL has oe=?', imageUrl.includes('oe='));
          console.log('[parseHtmlForAdData] Pattern 3.2 - URL validation (not ending with ? or &):', !imageUrl.endsWith('?') && !imageUrl.endsWith('&'));
          
          // Buscar datos adicionales con patrones mejorados
          const pageNamePatterns = [
            /"page_name":\s*"([^"]+)"/i,
            /"advertiser_name":\s*"([^"]+)"/i,
            /page_name["']?\s*:\s*["']([^"']+)["']/i,
            /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i,
            /<title[^>]*>([^<]+)<\/title>/i
          ];
          
          let pageNameMatch = null;
          for (const pattern of pageNamePatterns) {
            pageNameMatch = html.match(pattern);
            if (pageNameMatch && pageNameMatch[1]) break;
          }
          
          const adTextPatterns = [
            /"ad_creative_body":\s*"([^"]{10,500})"/i,
            /"body":\s*"([^"]{10,500})"/i,
            /"message":\s*"([^"]{10,500})"/i,
            /"text":\s*"([^"]{10,500})"/i,
            /"caption":\s*"([^"]{10,500})"/i,
            /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']{10,500})["']/i,
            /<p[^>]*class=["'][^"']*ad[^"']*["'][^>]*>([^<]{10,500})<\/p>/i
          ];
          
          let adTextMatch = null;
          for (const pattern of adTextPatterns) {
            adTextMatch = html.match(pattern);
            if (adTextMatch && adTextMatch[1] && adTextMatch[1].length > 10) break;
          }
          
          return {
            success: true,
            videoUrl: null,
            imageUrl: imageUrl,
            thumbnail: imageUrl,
            pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1].trim()) : 'Página de Facebook',
            adText: adTextMatch ? decodeUnicode(adTextMatch[1].trim()).substring(0, 300) : 'Anuncio de Facebook',
            startDate: new Date().toLocaleDateString('es-ES')
          };
        } else {
          console.log('[parseHtmlForAdData] Pattern 3.2 - WARNING: No images with signature parameters found');
          console.log('[parseHtmlForAdData] Pattern 3.2 - Sample URLs (first 3):', imageMatches.slice(0, 3));
        }
      }
      
      // Verificar si el anuncio tiene video buscando indicadores en el HTML
      console.log('[parseHtmlForAdData] Checking if ad has video (looking for video indicators)...');
      const videoIndicators = [
        /"media_type":\s*"VIDEO"/i,
        /"type":\s*"video"/i,
        /"has_video":\s*true/i,
        /video/i,
        /<video/i,
        /video-player/i,
        /"video_id"/i
      ];
      
      let hasVideoIndicator = false;
      for (const indicator of videoIndicators) {
        if (indicator.test(html)) {
          hasVideoIndicator = true;
          console.log('[parseHtmlForAdData] Found video indicator:', indicator.toString());
          break;
        }
      }
      console.log('[parseHtmlForAdData] Video indicators found:', hasVideoIndicator);
      
      // Si hay indicadores de video, buscar más agresivamente
      if (hasVideoIndicator || videoMatches.length === 0) {
        console.log('[parseHtmlForAdData] Pattern 4: Deep search for videos (aggressive mode)...');
        
        // Buscar en todo el HTML cualquier mención de video
        const aggressiveVideoPatterns = [
          // Buscar URLs que contengan "video" o "v/" en fbcdn
          /https?:\/\/[^"'\s<>]+fbcdn[^"'\s<>]*\/v\/[^"'\s<>]*/gi,
          // Buscar en atributos src con "video"
          /src=["']([^"']*video[^"']*)["']/gi,
          // Buscar en data attributes
          /data-video=["']([^"']+)["']/gi,
          // Buscar en estructuras de Facebook específicas
          /"__typename":\s*"Video"/gi,
          // Buscar IDs de video
          /"video_id":\s*"(\d+)"/gi,
        ];
        
        for (const pattern of aggressiveVideoPatterns) {
          const matches = html.match(pattern);
          if (matches && matches.length > 0) {
            console.log('[parseHtmlForAdData] Pattern 4 - Found', matches.length, 'matches with pattern:', pattern.toString().substring(0, 100));
            videoMatches.push(...matches.filter(m => m.includes('http')));
          }
        }
      }
      
      // Patrón 4: Buscar videos en estructuras JSON embebidas más específicas (buscar más profundo)
      console.log('[parseHtmlForAdData] Pattern 4b: Searching for videos in embedded JSON structures (deep search)...');
      
      // Buscar estructuras JSON que contengan información de video (nombres diferentes para evitar conflicto)
      const deepJsonVideoPatterns = [
        /"video":\s*\{[^}]*"uri":\s*"([^"]+)"/gi,
        /"video_url":\s*"([^"]+)"/gi,
        /"video_src":\s*"([^"]+)"/gi,
        /"source":\s*"([^"]+\.mp4[^"]*)"/gi,
        /"playback_url":\s*"([^"]+\.mp4[^"]*)"/gi,
        /"hd":\s*"([^"]+\.mp4[^"]*)"/gi,
        /"sd":\s*"([^"]+\.mp4[^"]*)"/gi,
        /"url_list":\s*\[([^\]]+)\]/gi,
      ];
      
      let jsonVideoUrls = [];
      for (const pattern of deepJsonVideoPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1]) {
            const url = match[1].replace(/\\\//g, '/').replace(/\\u002F/g, '/').replace(/&amp;/g, '&');
            if (url.includes('.mp4') || url.includes('fbcdn.net/v/') || url.includes('video')) {
              jsonVideoUrls.push(url);
            }
          }
        }
      }
      
      // También buscar en arrays JSON
      const jsonArrayPattern = /"url_list":\s*\["([^"]+)"/gi;
      let arrayMatch;
      while ((arrayMatch = jsonArrayPattern.exec(html)) !== null) {
        if (arrayMatch[1] && (arrayMatch[1].includes('.mp4') || arrayMatch[1].includes('fbcdn.net/v/') || arrayMatch[1].includes('video'))) {
          jsonVideoUrls.push(arrayMatch[1].replace(/\\\//g, '/'));
        }
      }
      
      // Filtrar y limpiar URLs de video de JSON
      jsonVideoUrls = [...new Set(jsonVideoUrls.filter(url => 
        (url.includes('fbcdn.net') || url.includes('.mp4') || url.includes('video')) &&
        !url.includes('thumbnail') &&
        !url.includes('preview')
      ))];
      
      console.log('[parseHtmlForAdData] Pattern 4b - Found', jsonVideoUrls.length, 'video URLs from JSON patterns');
      
      // Si encontramos indicadores pero no videos, buscar más específicamente
      if (hasVideoIndicator && videoMatches.length === 0 && jsonVideoUrls.length === 0) {
        console.log('[parseHtmlForAdData] Pattern 4c: Video indicator found but no URLs, searching HTML sample...');
        // Buscar en una muestra del HTML alrededor de palabras clave
        const videoSections = html.match(/[^<]{0,500}video[^<]{0,500}/gi) || [];
        console.log('[parseHtmlForAdData] Pattern 4c - Found', videoSections.length, 'sections containing "video"');
        if (videoSections.length > 0) {
          console.log('[parseHtmlForAdData] Pattern 4c - Sample video section (first 500 chars):', videoSections[0].substring(0, 500));
        }
      }
      
      if (jsonVideoUrls.length > 0) {
        // Combinar con videos encontrados antes
        videoMatches = [...new Set([...videoMatches, ...jsonVideoUrls])];
        console.log('[parseHtmlForAdData] Pattern 4 - Combined video URLs:', videoMatches.length);
        
        // Si encontramos videos aquí, intentar retornar el mejor
        const bestVideo = videoMatches
          .filter(url => url.includes('.mp4') || url.includes('fbcdn.net/v/'))
          .sort((a, b) => b.length - a.length)[0];
        
        if (bestVideo) {
          let videoUrl = bestVideo.replace(/&amp;/g, '&').replace(/\\\//g, '/');
          
          // Corregir URL si tiene parámetros mal formados
          if (videoUrl.includes('.mp4&')) {
            videoUrl = videoUrl.replace(/(\.mp4)&/, '$1?');
          }
          
          if (!videoUrl.startsWith('http')) {
            videoUrl = 'https:' + videoUrl;
          }
          
          console.log('[parseHtmlForAdData] Pattern 4: SUCCESS - Found video URL from JSON patterns');
          console.log('[parseHtmlForAdData] Pattern 4 - Video URL (first 150 chars):', videoUrl.substring(0, 150));
          
          // Buscar datos adicionales
          const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/i) || html.match(/"advertiser_name":\s*"([^"]+)"/i);
          const adTextPatterns = [
            /"ad_creative_body":\s*"([^"]{10,500})"/i,
            /"body":\s*"([^"]{10,500})"/i,
            /"message":\s*"([^"]{10,500})"/i,
          ];
          let adTextMatch = null;
          for (const pattern of adTextPatterns) {
            adTextMatch = html.match(pattern);
            if (adTextMatch && adTextMatch[1]) break;
          }
          
          return {
            success: true,
            videoUrl: videoUrl,
            imageUrl: null,
            thumbnail: null,
            pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
            adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 300) : 'Anuncio de Facebook',
            startDate: new Date().toLocaleDateString('es-ES')
          };
        }
      }
      
      // Patrón 5: Buscar cualquier URL de media en el HTML (fallback)
      console.log('[parseHtmlForAdData] Pattern 5: Searching for any media URLs (fallback)...');
      const allMediaPattern = /https?:\/\/[^"'\s<>]+\.(mp4|jpg|jpeg|png|webp)[^"'\s<>]*/gi;
      const allMediaMatches = html.match(allMediaPattern);
      
      if (allMediaMatches && allMediaMatches.length > 0) {
        console.log('[parseHtmlForAdData] Pattern 5 - Found', allMediaMatches.length, 'potential media URLs');
        // Filtrar solo URLs de Facebook CDN, priorizando videos
        const videoUrls = allMediaMatches.filter(url => 
          (url.includes('fbcdn.net') || url.includes('facebook.com')) && 
          url.includes('.mp4')
        );
        const imageUrls = allMediaMatches.filter(url => 
          (url.includes('fbcdn.net') || url.includes('facebook.com')) && 
          !url.includes('.mp4') &&
          !url.includes('s50x50') &&
          !url.includes('profile')
        );
        
        console.log('[parseHtmlForAdData] Pattern 5 - Videos:', videoUrls.length, 'Images:', imageUrls.length);
        
        if (videoUrls.length > 0) {
          let videoUrl = videoUrls.sort((a, b) => b.length - a.length)[0].replace(/&amp;/g, '&');
          if (videoUrl.includes('.mp4&')) {
            videoUrl = videoUrl.replace(/(\.mp4)&/, '$1?');
          }
          if (!videoUrl.startsWith('http')) {
            videoUrl = 'https:' + videoUrl;
          }
          
          console.log('[parseHtmlForAdData] Pattern 5: SUCCESS - Found video URL');
          
          const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/i) || html.match(/"advertiser_name":\s*"([^"]+)"/i);
          const adTextMatch = html.match(/"ad_creative_body":\s*"([^"]{10,500})"/i) || html.match(/"body":\s*"([^"]{10,500})"/i);
          
          return {
            success: true,
            videoUrl: videoUrl,
            imageUrl: null,
            thumbnail: null,
            pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
            adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 300) : 'Anuncio de Facebook',
            startDate: new Date().toLocaleDateString('es-ES')
          };
        }
        
        if (imageUrls.length > 0) {
          let imageUrl = imageUrls.sort((a, b) => b.length - a.length)[0].replace(/&amp;/g, '&');
          if (imageUrl.match(/\.(jpg|jpeg|png|webp)(&|%26)/i)) {
            imageUrl = imageUrl.replace(/\.(jpg|jpeg|png|webp)(&|%26)/i, '.$1?');
          }
          if (!imageUrl.startsWith('http')) {
            imageUrl = 'https:' + imageUrl;
          }
          
          console.log('[parseHtmlForAdData] Pattern 5: SUCCESS - Found image URL');
          
          const pageNameMatch = html.match(/"page_name":\s*"([^"]+)"/i) || html.match(/"advertiser_name":\s*"([^"]+)"/i);
          const adTextMatch = html.match(/"ad_creative_body":\s*"([^"]{10,500})"/i) || html.match(/"body":\s*"([^"]{10,500})"/i);
          
          return {
            success: true,
            videoUrl: null,
            imageUrl: imageUrl,
            thumbnail: imageUrl,
            pageName: pageNameMatch ? decodeUnicode(pageNameMatch[1]) : 'Página de Facebook',
            adText: adTextMatch ? decodeUnicode(adTextMatch[1]).substring(0, 300) : 'Anuncio de Facebook',
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

// Función para usar Playwright (mejor para serverless)
async function fetchWithPlaywright(url, adId) {
  let browser = null;
  try {
    // Importación dinámica
    const { chromium } = await import('playwright-core');
    const playwrightAWSLambda = await import('playwright-aws-lambda');
    
    console.log('[Playwright] Launching browser...');
    browser = await playwrightAWSLambda.default.launchChromium({
      headless: true,
    });

    const page = await browser.newPage();
    
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    });
    
    console.log('[Playwright] Navigating to page...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Esperar a que cargue el contenido dinámico
    try {
      await page.waitForSelector('img, video, [data-testid="ad-card"]', { timeout: 20000 });
    } catch (e) {
      console.log('[Playwright] Primary selector timeout, trying alternative...');
    }
    
    // Esperar a que las imágenes se carguen
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('img[src*="fbcdn.net"]').length > 0,
        { timeout: 10000 }
      );
    } catch (e) {
      console.log('[Playwright] Image loading timeout, continuing...');
    }
    
    // Esperar un poco más para que todas las URLs con firmas estén listas
    await page.waitForTimeout(3000);
    
    console.log('[Playwright] Extracting data from DOM...');
    const adData = await page.evaluate(() => {
      const result = { imageUrl: null, videoUrl: null, pageName: null, adText: null };
      
      // Buscar todas las imágenes y seleccionar la mejor
      const images = Array.from(document.querySelectorAll('img'));
      let bestImage = null;
      let bestImageScore = 0;
      
      for (const img of images) {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original');
        if (src && src.includes('fbcdn.net')) {
          // Filtrar thumbnails
          if (src.includes('s50x50') || src.includes('s100x100') || src.includes('profile') || src.includes('avatar')) {
            continue;
          }
          
          // Calcular score - PRIORIZAR URLs CON FIRMAS
          let score = 0;
          if (src.includes('oe=')) score += 100;  // MUY IMPORTANTE: tiene firma
          if (src.includes('oh=')) score += 100;  // MUY IMPORTANTE: tiene firma
          if (!src.includes('stp=')) score += 10;
          if (src.includes('.jpg') || src.includes('.png') || src.includes('.webp')) score += 5;
          if (src.includes('/v/t')) score += 3;
          
          const paramCount = (src.match(/[?&]/g) || []).length;
          score += paramCount;
          
          if (score > bestImageScore) {
            bestImageScore = score;
            bestImage = src;
          }
        }
      }
      
      result.imageUrl = bestImage;
      
      // Buscar videos
      const videoSelectors = [
        'video source[src*=".mp4"]',
        'video[src*=".mp4"]',
        'source[src*=".mp4"]',
        '[data-video-url]',
        '[data-video-src]',
        'video',
      ];
      
      for (const selector of videoSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const elem of elements) {
          const src = elem.getAttribute('src') || 
                     elem.getAttribute('data-src') || 
                     elem.getAttribute('data-video-url') || 
                     elem.getAttribute('data-video-src');
          
          if (src && (src.includes('.mp4') || src.includes('fbcdn.net/v/'))) {
            if (!src.includes('thumbnail') && !src.includes('preview')) {
              result.videoUrl = src;
              break;
            }
          }
        }
        if (result.videoUrl) break;
      }
      
      // Buscar nombre de página
      const pageNameSelectors = [
        '[data-testid="advertiser-name"]',
        '[data-testid="page-name"]',
        'a[href*="/ads/library/?active_status"]',
        '[aria-label*="Page"]',
        'h3 a',
        'strong a',
      ];
      
      for (const selector of pageNameSelectors) {
        const elem = document.querySelector(selector);
        if (elem && elem.textContent && elem.textContent.trim().length > 0) {
          const text = elem.textContent.trim();
          if (text.length > 2 && text.length < 100) {
            result.pageName = text;
            break;
          }
        }
      }
      
      // Buscar texto del anuncio
      const adTextSelectors = [
        '[data-testid="ad-text"]',
        '[data-testid="ad-creative-body"]',
        '[aria-label*="ad"]',
        'div[dir="auto"] p',
      ];
      
      for (const selector of adTextSelectors) {
        const elems = document.querySelectorAll(selector);
        for (const elem of elems) {
          if (elem && elem.textContent) {
            const text = elem.textContent.trim();
            if (text.length > 20 && 
                text.length < 1000 && 
                !text.includes('Facebook') && 
                !text.includes('Ads Library') &&
                !text.includes('See more')) {
              result.adText = text.substring(0, 500);
              break;
            }
          }
        }
        if (result.adText) break;
      }
      
      // Buscar en background-image si no encontramos nada
      if (!result.imageUrl) {
        const styleElements = document.querySelectorAll('[style*="background-image"], [style*="url("]');
        for (const elem of styleElements) {
          const style = elem.getAttribute('style') || '';
          const urlMatch = style.match(/url\(['"]?([^'")]+)['"]?\)/);
          if (urlMatch && urlMatch[1] && urlMatch[1].includes('fbcdn.net') && !urlMatch[1].includes('s50x50')) {
            result.imageUrl = urlMatch[1];
            break;
          }
        }
      }
      
      return result;
    });
    
    console.log('[Playwright] Extracted data:', {
      hasImage: !!adData.imageUrl,
      imageUrlLength: adData.imageUrl ? adData.imageUrl.length : 0,
      imageUrlPreview: adData.imageUrl ? adData.imageUrl.substring(0, 250) : null,
      imageHasSignature: adData.imageUrl ? (adData.imageUrl.includes('oe=') && adData.imageUrl.includes('oh=')) : false,
      hasVideo: !!adData.videoUrl,
      hasPageName: !!adData.pageName,
      hasAdText: !!adData.adText,
    });
    
    await browser.close();
    browser = null;
    
    // Descargar contenido inmediatamente con firmas válidas
    let imageBase64 = null;
    let videoBase64 = null;
    
    if (adData.imageUrl) {
      try {
        console.log('[Playwright] Downloading image with valid signature...');
        console.log('[Playwright] Full image URL:', adData.imageUrl);
        const imgResponse = await fetch(adData.imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.facebook.com/ads/library/',
            'Accept': 'image/*,*/*;q=0.8',
          }
        });
        if (imgResponse.ok) {
          const buffer = await imgResponse.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          imageBase64 = `data:${imgResponse.headers.get('content-type') || 'image/jpeg'};base64,${base64}`;
          console.log('[Playwright] Image downloaded successfully, size:', base64.length);
        } else {
          console.log('[Playwright] Image download failed with status:', imgResponse.status);
        }
      } catch (e) {
        console.log('[Playwright] Image download error:', e.message);
      }
    }
    
    if (adData.videoUrl) {
      try {
        console.log('[Playwright] Downloading video with valid signature...');
        const vidResponse = await fetch(adData.videoUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.facebook.com/ads/library/',
            'Accept': 'video/*,*/*;q=0.8',
          }
        });
        if (vidResponse.ok) {
          const buffer = await vidResponse.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          videoBase64 = `data:${vidResponse.headers.get('content-type') || 'video/mp4'};base64,${base64}`;
          console.log('[Playwright] Video downloaded successfully, size:', base64.length);
        } else {
          console.log('[Playwright] Video download failed with status:', vidResponse.status);
        }
      } catch (e) {
        console.log('[Playwright] Video download error:', e.message);
      }
    }
    
    return {
      videoUrl: adData.videoUrl,
      imageUrl: adData.imageUrl,
      videoBase64,
      imageBase64,
      pageName: adData.pageName || 'Página de Facebook',
      adText: adData.adText || 'Anuncio de Facebook',
      startDate: new Date().toLocaleDateString('es-ES'),
    };
  } catch (error) {
    console.error('[Playwright] Error:', error.message);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('[Playwright] Error closing browser:', closeError.message);
      }
    }
    throw error;
  }
}
