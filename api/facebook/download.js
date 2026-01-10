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
    const { url, type = 'ad', usePuppeteer = true } = req.body;
    console.log('Received URL:', url);
    console.log('Received type:', type);
    console.log('Use Puppeteer:', usePuppeteer);

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

    // Intentar primero con Puppeteer si está habilitado
    if (usePuppeteer) {
      try {
        console.log('Attempting with Puppeteer...');
        const puppeteerResult = await fetchWithPuppeteer(normalizedUrl, adId);
        if (puppeteerResult && (puppeteerResult.imageUrl || puppeteerResult.videoUrl || puppeteerResult.imageBase64 || puppeteerResult.videoBase64)) {
          console.log('Puppeteer method succeeded!');
          return res.status(200).json({
            success: true,
            adId,
            id: adId,
            ...puppeteerResult,
            method: 'puppeteer'
          });
        }
      } catch (puppeteerError) {
        console.log('Puppeteer method failed or not available, falling back to traditional method...');
        console.log('Puppeteer error:', puppeteerError.message);
        // Continuar con el método tradicional
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
        // Filtrar imágenes pequeñas (thumbnails) y buscar la mejor calidad
        // Las URLs con s50x50, s100x100, etc. son thumbnails
        // Buscar imágenes más grandes primero
        const largeImages = imageMatches.filter(url => 
          !url.match(/[?&]stp=.*s\d+x\d+/i) &&  // No tiene parámetro de tamaño pequeño
          !url.includes('s50x50') &&
          !url.includes('s100x100') &&
          !url.includes('s150x150') &&
          !url.includes('profile_pic') &&
          !url.includes('avatar') &&
          !url.includes('profile') &&
          (url.includes('/v/t') || url.includes('/v/t1.'))  // URLs de CDN de Facebook para contenido
        );
        
        console.log('[parseHtmlForAdData] Pattern 3 - Filtered large images:', largeImages.length, 'out of', imageMatches.length);
        
        // Usar imágenes grandes si existen, sino usar todas pero filtrar las peores
        let imageUrlsToUse = largeImages.length > 0 ? largeImages : imageMatches.filter(url => 
          !url.includes('s50x50') && 
          !url.includes('s100x100') &&
          !url.includes('profile_pic') &&
          !url.includes('avatar')
        );
        
        // Si aún no tenemos nada, usar todas pero ordenar por calidad (las URLs más largas suelen ser mejores)
        if (imageUrlsToUse.length === 0) {
          imageUrlsToUse = imageMatches;
        }
        
        // Ordenar por longitud (URLs más largas suelen tener mejor calidad)
        imageUrlsToUse.sort((a, b) => b.length - a.length);
        
        // IMPORTANTE: Buscar primero imágenes sin parámetros de tamaño (s50x50, etc.)
        // Las imágenes sin stp= o con menos parámetros suelen ser de mejor calidad y más estables
        console.log('[parseHtmlForAdData] Pattern 3 - Looking for better quality images without size parameters...');
        
        // Buscar todas las URLs de imagen en el HTML sin restricciones de patrón
        const allImageUrls = html.match(/https?:\/\/scontent[^"'\s<>]+\.fbcdn\.net[^"'\s<>]*\/v\/t[^"'\s<>]*\.(jpg|jpeg|png|webp)[^"'\s<>]*/gi) || [];
        console.log('[parseHtmlForAdData] Pattern 3 - Found', allImageUrls.length, 'total image URLs in HTML');
        
        // Filtrar imágenes que NO sean thumbnails y NO tengan parámetros de tamaño pequeño
        const highQualityImages = allImageUrls.filter(url => {
          const cleanUrl = url.replace(/&amp;/g, '&');
          return !cleanUrl.includes('s50x50') &&
                 !cleanUrl.includes('s100x100') &&
                 !cleanUrl.includes('s150x150') &&
                 !cleanUrl.includes('s200x200') &&
                 !cleanUrl.includes('stp=c379') &&
                 !cleanUrl.includes('profile') &&
                 !cleanUrl.includes('avatar');
        });
        
        console.log('[parseHtmlForAdData] Pattern 3 - High quality images (without size params):', highQualityImages.length);
        
        // Usar imágenes de alta calidad si existen, sino usar las filtradas
        let finalImageUrls = highQualityImages.length > 0 ? highQualityImages : imageUrlsToUse;
        
        // Si todavía no hay nada bueno, buscar la URL base sin parámetros de tamaño
        if (finalImageUrls.length === 0 || (finalImageUrls.length > 0 && finalImageUrls[0].includes('s50x50'))) {
          console.log('[parseHtmlForAdData] Pattern 3 - Attempting to extract base image URL without size parameters...');
          
          // Buscar URLs que tengan el mismo nombre de archivo pero sin parámetros stp=
          for (const imgUrl of allImageUrls) {
            const baseUrl = imgUrl.split('?')[0]; // URL base sin parámetros
            const baseName = baseUrl.match(/\/([^\/]+\.(jpg|jpeg|png|webp))$/i);
            
            if (baseName && !baseUrl.includes('s50x50') && !baseUrl.includes('profile')) {
              // Intentar construir URL sin parámetros de tamaño
              const cleanBaseUrl = baseUrl + '?';
              if (!finalImageUrls.includes(cleanBaseUrl)) {
                finalImageUrls = [cleanBaseUrl];
                console.log('[parseHtmlForAdData] Pattern 3 - Found base image URL:', cleanBaseUrl.substring(0, 150));
                break;
              }
            }
          }
        }
        
        // Ordenar por longitud (URLs más largas pueden tener mejor calidad)
        finalImageUrls.sort((a, b) => b.length - a.length);
        
        // Tomar la mejor imagen y limpiar
        let imageUrl = (finalImageUrls[0] || imageUrlsToUse[0]).replace(/&amp;/g, '&').replace(/\\\//g, '/').replace(/\\u002F/g, '/');
        
        console.log('[parseHtmlForAdData] Pattern 3 - Selected image URL before fix:', imageUrl.substring(0, 200));
        
        // CORREGIR: Si la URL tiene & después de .jpg/.png/.webp, cambiarlo por ?
        const imageUrlBefore = imageUrl;
        
        // Estrategia: buscar el punto donde termina la extensión y el primer &
        const extMatch = imageUrl.match(/\.(jpg|jpeg|png|webp)([&?])/i);
        if (extMatch && extMatch[2] === '&') {
          imageUrl = imageUrl.replace(/\.(jpg|jpeg|png|webp)&/i, '.$1?');
          console.log('[parseHtmlForAdData] Pattern 3 - Fixed: replaced & with ? after extension');
        }
        
        // Si la URL tiene stp= con tamaño pequeño, intentar removerlo
        if (imageUrl.includes('stp=') && imageUrl.match(/s\d+x\d+/)) {
          // Intentar construir URL sin parámetro stp
          const urlParts = imageUrl.split('?');
          if (urlParts.length > 1) {
            const params = urlParts[1].split('&');
            const cleanParams = params.filter(p => !p.includes('stp='));
            if (cleanParams.length < params.length) {
              imageUrl = urlParts[0] + '?' + cleanParams.join('&');
              console.log('[parseHtmlForAdData] Pattern 3 - Removed stp parameter for better quality');
            }
          }
        }
        
        // Intentar mejorar la URL removiendo parámetros de tamaño si es necesario
        if (imageUrl.match(/[?&]stp=.*s\d+x\d+/i)) {
          // Buscar una versión sin parámetros de tamaño en todas las imágenes
          const betterImage = imageMatches.find(url => 
            !url.includes('s50x50') && 
            !url.includes('s100x100') &&
            !url.includes('s150x150') &&
            (url.includes('.jpg') || url.includes('.png') || url.includes('.webp'))
          );
          if (betterImage) {
            let fixedBetterImage = betterImage.replace(/&amp;/g, '&').replace(/\\\//g, '/');
            // Corregir también la imagen mejor
            if (fixedBetterImage.match(/\.(jpg|jpeg|png|webp)(&|%26)/i)) {
              fixedBetterImage = fixedBetterImage.replace(/\.(jpg|jpeg|png|webp)(&|%26)/i, '.$1?');
            }
            imageUrl = fixedBetterImage;
            console.log('[parseHtmlForAdData] Pattern 3 - Found better quality image');
          } else {
            // Intentar remover parámetros de tamaño de la URL actual
            const originalUrl = imageUrl;
            imageUrl = imageUrl.replace(/[?&]stp=[^&?]*s\d+x\d+[^&?]*/gi, '');
            if (imageUrl === originalUrl) {
              // Si no funcionó, intentar de otra forma
              imageUrl = imageUrl.replace(/[?&]_nc_cat=[^&?]*/gi, '');
            }
            console.log('[parseHtmlForAdData] Pattern 3 - Attempted to improve image URL quality');
          }
        }
        
        // Asegurar que la URL sea válida y empiece con http
        if (!imageUrl.startsWith('http')) {
          imageUrl = 'https:' + imageUrl;
        }
        
        // Verificar que la corrección funcionó
        if (imageUrl.includes('.jpg&') || imageUrl.includes('.png&') || imageUrl.includes('.webp&')) {
          console.log('[parseHtmlForAdData] Pattern 3 - CRITICAL: URL still has & after extension!');
          // Último intento: reemplazo forzado
          imageUrl = imageUrl.replace(/(\.(jpg|jpeg|png|webp))&/gi, '$1?');
        }
        if (imageUrl.includes('.jpg&') || imageUrl.includes('.png&') || imageUrl.includes('.webp&')) {
          console.log('[parseHtmlForAdData] Pattern 3 - WARNING: URL still has & after extension, attempting final fix...');
          // Último intento: reemplazo directo
          imageUrl = imageUrl.replace(/(\.(jpg|jpeg|png|webp))&/gi, '$1?');
        }
        
        console.log('[parseHtmlForAdData] Pattern 3: SUCCESS - Found image URL directly from HTML');
        console.log('[parseHtmlForAdData] Pattern 3 - Final image URL (first 200 chars):', imageUrl.substring(0, 200));
        console.log('[parseHtmlForAdData] Pattern 3 - URL validation (has ? after extension):', /\.(jpg|jpeg|png|webp)\?/.test(imageUrl));
        console.log('[parseHtmlForAdData] Pattern 3 - Total images found:', imageMatches.length, 'Large images:', largeImages.length);
        
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

// Función para usar Puppeteer (extraída para reutilización)
async function fetchWithPuppeteer(url, adId) {
  let browser = null;
  try {
    // Importación dinámica para evitar errores si Puppeteer no está disponible
    const puppeteer = (await import('puppeteer-core')).default;
    const chromium = (await import('@sparticuz/chromium')).default;
    
    chromium.setGraphicsMode(false);
    
    console.log('[Puppeteer] Launching browser...');
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    });
    
    console.log('[Puppeteer] Navigating to page...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Esperar a que cargue el contenido
    try {
      await page.waitForSelector('img[src*="fbcdn.net"], video source, [data-testid="ad-card"]', { timeout: 15000 });
    } catch (e) {
      console.log('[Puppeteer] Selector timeout, continuing...');
    }
    await page.waitForTimeout(2000);
    
    console.log('[Puppeteer] Extracting data from DOM...');
    const adData = await page.evaluate(() => {
      const result = { imageUrl: null, videoUrl: null, pageName: null, adText: null };
      
      const images = Array.from(document.querySelectorAll('img[src*="fbcdn.net"]'));
      for (const img of images) {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && src.includes('fbcdn.net') && !src.includes('s50x50') && !src.includes('profile') && !src.includes('avatar')) {
          result.imageUrl = src;
          break;
        }
      }
      
      const videos = Array.from(document.querySelectorAll('video source, video[src*="fbcdn.net"]'));
      for (const video of videos) {
        const src = video.getAttribute('src') || video.getAttribute('data-src');
        if (src && (src.includes('.mp4') || src.includes('fbcdn.net/v/'))) {
          result.videoUrl = src;
          break;
        }
      }
      
      const pageNameElem = document.querySelector('[data-testid="advertiser-name"], [data-testid="page-name"]');
      if (pageNameElem) result.pageName = pageNameElem.textContent.trim();
      
      const adTextElem = document.querySelector('[data-testid="ad-text"], [data-testid="ad-creative-body"]');
      if (adTextElem) result.adText = adTextElem.textContent.trim().substring(0, 500);
      
      return result;
    });
    
    await browser.close();
    browser = null;
    
    // Descargar contenido inmediatamente con firmas válidas
    let imageBase64 = null;
    let videoBase64 = null;
    
    if (adData.imageUrl) {
      try {
        console.log('[Puppeteer] Downloading image with valid signature...');
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
          console.log('[Puppeteer] Image downloaded successfully, size:', base64.length);
        } else {
          console.log('[Puppeteer] Image download failed with status:', imgResponse.status);
        }
      } catch (e) {
        console.log('[Puppeteer] Image download error:', e.message);
      }
    }
    
    if (adData.videoUrl) {
      try {
        console.log('[Puppeteer] Downloading video with valid signature...');
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
          console.log('[Puppeteer] Video downloaded successfully, size:', base64.length);
        } else {
          console.log('[Puppeteer] Video download failed with status:', vidResponse.status);
        }
      } catch (e) {
        console.log('[Puppeteer] Video download error:', e.message);
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
    console.error('[Puppeteer] Error:', error.message);
    // Asegurar que el navegador se cierra incluso en caso de error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('[Puppeteer] Error closing browser:', closeError.message);
      }
    }
    throw error;
  }
}
