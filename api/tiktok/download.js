// Vercel Serverless Function para descargar videos de TikTok sin marca de agua
export default async function handler(req, res) {
  console.log('=== TIKTOK API CALLED ===');
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
    let { url, type = 'video' } = req.body;
    console.log('Received URL (raw):', url);
    console.log('Received type:', type);

    if (!url) {
      console.log('ERROR: No URL provided');
      return res.status(400).json({ error: 'URL de TikTok requerida' });
    }

    // Normalizar URL inicial: limpiar espacios y caracteres especiales
    if (typeof url === 'string') {
      url = url.trim().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '');
      
      // Agregar https:// si falta (común en móvil)
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
        console.log('URL normalizada (https agregado):', url);
      }
    }
    
    console.log('Received URL (normalized):', url);

    // Validar URL de TikTok - Patrón mejorado y más flexible
    // Acepta: www.tiktok.com, vm.tiktok.com, vt.tiktok.com, con o sin https
    // TikTok usa tanto vm.tiktok.com como vt.tiktok.com para URLs cortas
    const tiktokUrlPattern = /^https?:\/\/((www\.)?tiktok\.com|(vm|vt)\.tiktok\.com)/i;
    if (!tiktokUrlPattern.test(url)) {
      console.log('ERROR: Invalid TikTok URL pattern:', url);
      console.log('URL recibida completa:', JSON.stringify(url));
      
      // Intentar agregar https:// si falta (común en móvil)
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
        console.log('Intentando con https:// agregado:', url);
        if (!tiktokUrlPattern.test(url)) {
          return res.status(400).json({ 
            error: 'URL de TikTok inválida', 
            receivedUrl: url,
            hint: 'Asegúrate de usar un enlace válido como: https://www.tiktok.com/@usuario/video/1234567890 o https://vt.tiktok.com/xxxxx'
          });
        }
      } else {
        return res.status(400).json({ 
          error: 'URL de TikTok inválida', 
          receivedUrl: url,
          hint: 'Asegúrate de usar un enlace válido como: https://www.tiktok.com/@usuario/video/1234567890 o https://vt.tiktok.com/xxxxx'
        });
      }
    }
    
    console.log('URL validada correctamente:', url);

    // Normalizar URL (formato estándar)
    let normalizedUrl = url;
    console.log('Normalized URL:', normalizedUrl);

    // Extraer video ID - Intentar múltiples métodos
    let videoId = null;
    
    // Método 1: Formato estándar /video/1234567890
    const videoIdMatch = normalizedUrl.match(/\/video\/(\d+)/);
    if (videoIdMatch) {
      videoId = videoIdMatch[1];
      console.log('Extracted Video ID (método 1):', videoId);
    } else {
      // Método 2: Para URLs vm.tiktok.com o vt.tiktok.com, necesitamos seguir el redirect
      if (normalizedUrl.includes('vm.tiktok.com') || normalizedUrl.includes('vt.tiktok.com')) {
        const shortUrlType = normalizedUrl.includes('vm.tiktok.com') ? 'vm.tiktok.com' : 'vt.tiktok.com';
        console.log(`URL es ${shortUrlType}, intentando obtener video ID del redirect...`);
        // Intentar obtener el video ID desde la respuesta del redirect
        try {
          // Usar GET para seguir redirects correctamente y obtener el HTML
          const redirectResponse = await fetch(normalizedUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.tiktok.com/',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          });
          const finalUrl = redirectResponse.url;
          console.log('URL final después de redirect:', finalUrl);
          
          // Intentar extraer video ID de la URL final primero
          const redirectVideoMatch = finalUrl.match(/\/video\/(\d+)/);
          if (redirectVideoMatch) {
            videoId = redirectVideoMatch[1];
            normalizedUrl = finalUrl; // Usar la URL final
            console.log('Extracted Video ID (método 2 - redirect URL):', videoId);
          } else {
            console.log('No se encontró video ID en la URL después del redirect, parseando HTML...');
            // Si no encontramos el ID en la URL, intentar extraerlo del HTML
            const html = await redirectResponse.text();
            const htmlVideoMatch = html.match(/\/video\/(\d+)/);
            if (htmlVideoMatch) {
              videoId = htmlVideoMatch[1];
              console.log('Extracted Video ID (método 2b - HTML parse):', videoId);
            } else {
              // Buscar en el JSON embebido
              const jsonMatch = html.match(/window\.__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({.+?});/s);
              if (jsonMatch) {
                try {
                  const jsonData = JSON.parse(jsonMatch[1]);
                  // Buscar video ID en el JSON usando varios paths posibles
                  const jsonStr = JSON.stringify(jsonData);
                  const jsonIdMatches = [
                    jsonStr.match(/"videoId"\s*:\s*"?(\d+)"?/),
                    jsonStr.match(/"aweme_id"\s*:\s*"?(\d+)"?/),
                    jsonStr.match(/"itemId"\s*:\s*"?(\d+)"?/),
                    jsonStr.match(/"id"\s*:\s*"?(\d{15,})"?/) // IDs largos de TikTok
                  ];
                  
                  for (const match of jsonIdMatches) {
                    if (match && match[1] && match[1].length >= 15) {
                      videoId = match[1];
                      console.log('Extracted Video ID (método 2c - JSON parse):', videoId);
                      break;
                    }
                  }
                } catch (e) {
                  console.log('Error parseando JSON:', e.message);
                }
              }
            }
          }
        } catch (redirectError) {
          console.log('Error obteniendo redirect:', redirectError.message);
          console.error('Redirect error stack:', redirectError.stack);
        }
      }
    }
    
    if (!videoId) {
      console.log('ERROR: Could not extract video ID from:', normalizedUrl);
      console.log('Intentando extraer desde cualquier posición en la URL...');
      
      // Último intento: buscar cualquier número largo que pueda ser el video ID
      const anyIdMatch = normalizedUrl.match(/(\d{15,})/);
      if (anyIdMatch) {
        videoId = anyIdMatch[1];
        console.log('Extracted Video ID (método 3 - número largo):', videoId);
      } else {
        return res.status(400).json({ 
          error: 'No se pudo extraer el ID del video', 
          url: normalizedUrl,
          hint: 'Asegúrate de usar un enlace completo como: https://www.tiktok.com/@usuario/video/1234567890'
        });
      }
    }
    
    console.log('Video ID final extraído:', videoId);

    console.log('Calling fetchTikTokVideo...');
    const apiResponse = await fetchTikTokVideo(normalizedUrl, videoId, type);
    console.log('API Response:', JSON.stringify(apiResponse, null, 2));

    if (!apiResponse.success) {
      console.log('ERROR: fetchTikTokVideo failed:', apiResponse.error);
      return res.status(500).json({ 
        error: apiResponse.error || 'Error al procesar el video',
        details: apiResponse
      });
    }

    console.log('SUCCESS: Returning video data');
    return res.status(200).json({
      success: true,
      videoId,
      videoUrl: apiResponse.videoUrl,
      audioUrl: apiResponse.audioUrl,
      thumbnail: apiResponse.thumbnail,
      duration: apiResponse.duration,
      author: apiResponse.author,
      title: apiResponse.title,
      noWatermark: true
    });

  } catch (error) {
    console.error('ERROR en API TikTok:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Función para obtener el video de TikTok usando librería gratuita
async function fetchTikTokVideo(url, videoId, type) {
  console.log('[fetchTikTokVideo] Starting with URL:', url, 'VideoID:', videoId);
  try {
    // Usar API pública gratuita de TikTok Downloader
    // Opción 1: TikTok Downloader API gratuita (no requiere API key)
    const apiUrl = `https://api16-normal-useast5.us.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;
    
    // Intentar obtener datos del video desde API pública
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://www.tiktok.com/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        redirect: 'follow'
      });

      const html = await response.text();
      
      // Buscar datos JSON embebidos en el HTML
      // TikTok inyecta datos en window.__UNIVERSAL_DATA_FOR_REHYDRATION__
      const jsonMatch = html.match(/window\.__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({.+?});/s);
      
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[1]);
        const videoData = extractVideoData(jsonData, videoId);
        
        if (videoData.videoUrl) {
          return {
            success: true,
            videoUrl: videoData.videoUrl,
            audioUrl: videoData.audioUrl,
            thumbnail: videoData.thumbnail,
            duration: videoData.duration,
            author: videoData.author,
            title: videoData.title
          };
        }
      }
    } catch (htmlError) {
      console.log('Error con método HTML parsing:', htmlError.message);
    }

    // Opción 2: Usar servicio público de descarga (alternativa)
    // Este es un servicio público que no requiere API key
    try {
      console.log('[fetchTikTokVideo] Trying tikwm.com API...');
      const downloaderApiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
      console.log('[fetchTikTokVideo] API URL:', downloaderApiUrl);
      
      const downloadResponse = await fetch(downloaderApiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });

      console.log('[fetchTikTokVideo] tikwm.com response status:', downloadResponse.status);

      if (downloadResponse.ok) {
        const downloadData = await downloadResponse.json();
        console.log('[fetchTikTokVideo] tikwm.com data received:', JSON.stringify(downloadData, null, 2));
        
        if (downloadData.data && downloadData.data.play) {
          console.log('[fetchTikTokVideo] SUCCESS from tikwm.com');
          return {
            success: true,
            videoUrl: downloadData.data.play, // URL sin marca de agua
            audioUrl: downloadData.data.music?.play_url || downloadData.data.music?.playUrl,
            thumbnail: downloadData.data.cover || downloadData.data.origin_cover,
            duration: downloadData.data.duration || 0,
            author: downloadData.data.author?.nickname || downloadData.data.author?.unique_id || '@usuario',
            title: downloadData.data.title || downloadData.data.desc || 'Video de TikTok'
          };
        } else {
          console.log('[fetchTikTokVideo] tikwm.com: No video URL found in response');
        }
      } else {
        console.log('[fetchTikTokVideo] tikwm.com: Response not OK:', downloadResponse.status);
      }
    } catch (apiError) {
      console.log('[fetchTikTokVideo] Error con API pública tikwm.com:', apiError.message);
      console.error('[fetchTikTokVideo] API Error stack:', apiError.stack);
    }

    // Opción 3: Usar otra API pública gratuita
    try {
      console.log('[fetchTikTokVideo] Trying douyin.wtf API...');
      const api2Url = `https://api.douyin.wtf/api?url=${encodeURIComponent(url)}`;
      console.log('[fetchTikTokVideo] API2 URL:', api2Url);
      const api2Response = await fetch(api2Url, {
        headers: {
          'Accept': 'application/json',
        }
      });

      console.log('[fetchTikTokVideo] douyin.wtf response status:', api2Response.status);

      if (api2Response.ok) {
        const api2Data = await api2Response.json();
        console.log('[fetchTikTokVideo] douyin.wtf data received:', JSON.stringify(api2Data, null, 2));
        
        if (api2Data.nwm_video_url || api2Data.video_url) {
          console.log('[fetchTikTokVideo] SUCCESS from douyin.wtf');
          return {
            success: true,
            videoUrl: api2Data.nwm_video_url || api2Data.video_url, // Sin marca de agua
            audioUrl: api2Data.music_url || api2Data.audio_url,
            thumbnail: api2Data.cover || api2Data.thumbnail,
            duration: api2Data.duration || 0,
            author: api2Data.author || '@usuario',
            title: api2Data.title || api2Data.desc || 'Video de TikTok'
          };
        } else {
          console.log('[fetchTikTokVideo] douyin.wtf: No video URL found in response');
        }
      } else {
        console.log('[fetchTikTokVideo] douyin.wtf: Response not OK:', api2Response.status);
      }
    } catch (api2Error) {
      console.log('[fetchTikTokVideo] Error con API alternativa douyin.wtf:', api2Error.message);
      console.error('[fetchTikTokVideo] API2 Error stack:', api2Error.stack);
    }

    // Si todas las opciones fallan
    console.log('[fetchTikTokVideo] All methods failed');
    return {
      success: false,
      error: 'No se pudo obtener el video. Por favor, verifica que la URL sea válida e intenta de nuevo.'
    };

  } catch (error) {
    console.error('[fetchTikTokVideo] ERROR:', error);
    console.error('[fetchTikTokVideo] Error stack:', error.stack);
    return {
      success: false,
      error: error.message || 'Error al procesar el video'
    };
  }
}

// Función auxiliar para extraer datos del video desde JSON de TikTok
function extractVideoData(jsonData, videoId) {
  try {
    // Navegar por la estructura JSON de TikTok
    // La estructura puede variar, intentamos varios paths comunes
    const paths = [
      ['defaultScope', 'webapp.video-detail', 'itemInfo', 'itemStruct'],
      ['__DEFAULT_SCOPE__', 'webapp.video-detail', 'itemInfo', 'itemStruct'],
      ['webapp.video-detail', 'itemInfo', 'itemStruct'],
    ];

    let videoStruct = null;
    
    for (const path of paths) {
      let current = jsonData;
      for (const key of path) {
        if (current && current[key]) {
          current = current[key];
        } else {
          current = null;
          break;
        }
      }
      if (current) {
        videoStruct = current;
        break;
      }
    }

    if (videoStruct) {
      const video = videoStruct.video || videoStruct.videoData || {};
      const music = videoStruct.music || videoStruct.musicData || {};
      
      return {
        videoUrl: video.playAddr?.urlList?.[0] || video.downloadAddr?.urlList?.[0],
        audioUrl: music.playUrl?.urlList?.[0],
        thumbnail: videoStruct.video?.cover?.urlList?.[0] || videoStruct.cover,
        duration: video.duration || 0,
        author: videoStruct.author?.nickname || videoStruct.author?.uniqueId || '@usuario',
        title: videoStruct.desc || videoStruct.title || 'Video de TikTok'
      };
    }
  } catch (error) {
    console.error('Error extrayendo datos:', error);
  }

  return {};
}

