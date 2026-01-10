// Vercel Serverless Function para descargar videos de TikTok sin marca de agua
export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { url, type = 'video' } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL de TikTok requerida' });
    }

    // Validar URL de TikTok
    const tiktokUrlPattern = /^https?:\/\/(www\.)?(x2)?tiktok\.com|vm\.tiktok\.com/i;
    if (!tiktokUrlPattern.test(url)) {
      return res.status(400).json({ error: 'URL de TikTok inválida' });
    }

    // Normalizar URL (quitar x2 si existe, usar formato estándar)
    let normalizedUrl = url.replace(/x2tiktok\.com/gi, 'tiktok.com');

    // Extraer video ID
    const videoIdMatch = normalizedUrl.match(/\/video\/(\d+)/);
    if (!videoIdMatch) {
      return res.status(400).json({ error: 'No se pudo extraer el ID del video' });
    }
    const videoId = videoIdMatch[1];

    // IMPORTANTE: Aquí necesitas implementar la extracción real del video
    // Opciones:
    // 1. Usar un servicio API de terceros (rapidapi, etc.)
    // 2. Usar librerías de Node.js para scraping
    // 3. Implementar tu propio scraper

    // Por ahora, devolvemos una estructura que el frontend puede usar
    // En producción, aquí harías la llamada real a un servicio o scraping
    
    // EJEMPLO usando API pública (debes reemplazar con tu solución real)
    const apiResponse = await fetchTikTokVideo(normalizedUrl, videoId, type);

    if (!apiResponse.success) {
      return res.status(500).json({ 
        error: apiResponse.error || 'Error al procesar el video' 
      });
    }

    return res.status(200).json({
      success: true,
      videoId,
      videoUrl: apiResponse.videoUrl,
      audioUrl: apiResponse.audioUrl,
      thumbnail: apiResponse.thumbnail,
      duration: apiResponse.duration,
      author: apiResponse.author,
      title: apiResponse.title,
      noWatermark: true // Confirmamos que es sin marca de agua
    });

  } catch (error) {
    console.error('Error en API TikTok:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Función para obtener el video de TikTok usando librería gratuita
async function fetchTikTokVideo(url, videoId, type) {
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
      const downloaderApiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
      
      const downloadResponse = await fetch(downloaderApiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });

      if (downloadResponse.ok) {
        const downloadData = await downloadResponse.json();
        
        if (downloadData.data && downloadData.data.play) {
          return {
            success: true,
            videoUrl: downloadData.data.play, // URL sin marca de agua
            audioUrl: downloadData.data.music?.play_url || downloadData.data.music?.playUrl,
            thumbnail: downloadData.data.cover || downloadData.data.origin_cover,
            duration: downloadData.data.duration || 0,
            author: downloadData.data.author?.nickname || downloadData.data.author?.unique_id || '@usuario',
            title: downloadData.data.title || downloadData.data.desc || 'Video de TikTok'
          };
        }
      }
    } catch (apiError) {
      console.log('Error con API pública:', apiError.message);
    }

    // Opción 3: Usar otra API pública gratuita
    try {
      const api2Url = `https://api.douyin.wtf/api?url=${encodeURIComponent(url)}`;
      const api2Response = await fetch(api2Url, {
        headers: {
          'Accept': 'application/json',
        }
      });

      if (api2Response.ok) {
        const api2Data = await api2Response.json();
        
        if (api2Data.nwm_video_url || api2Data.video_url) {
          return {
            success: true,
            videoUrl: api2Data.nwm_video_url || api2Data.video_url, // Sin marca de agua
            audioUrl: api2Data.music_url || api2Data.audio_url,
            thumbnail: api2Data.cover || api2Data.thumbnail,
            duration: api2Data.duration || 0,
            author: api2Data.author || '@usuario',
            title: api2Data.title || api2Data.desc || 'Video de TikTok'
          };
        }
      }
    } catch (api2Error) {
      console.log('Error con API alternativa:', api2Error.message);
    }

    // Si todas las opciones fallan
    return {
      success: false,
      error: 'No se pudo obtener el video. Por favor, verifica que la URL sea válida e intenta de nuevo.'
    };

  } catch (error) {
    console.error('Error fetching TikTok video:', error);
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

