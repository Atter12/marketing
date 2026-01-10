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
    const { url, type = 'video' } = req.body;
    console.log('Received URL:', url);
    console.log('Received type:', type);

    if (!url) {
      console.log('ERROR: No URL provided');
      return res.status(400).json({ error: 'URL de TikTok requerida' });
    }

    // Validar URL de TikTok
    const tiktokUrlPattern = /^https?:\/\/(www\.)?(x2)?tiktok\.com|vm\.tiktok\.com/i;
    if (!tiktokUrlPattern.test(url)) {
      console.log('ERROR: Invalid TikTok URL:', url);
      return res.status(400).json({ error: 'URL de TikTok inválida', receivedUrl: url });
    }

    // Normalizar URL (quitar x2 si existe, usar formato estándar)
    let normalizedUrl = url.replace(/x2tiktok\.com/gi, 'tiktok.com');
    console.log('Normalized URL:', normalizedUrl);

    // Extraer video ID
    const videoIdMatch = normalizedUrl.match(/\/video\/(\d+)/);
    if (!videoIdMatch) {
      console.log('ERROR: Could not extract video ID from:', normalizedUrl);
      return res.status(400).json({ error: 'No se pudo extraer el ID del video', url: normalizedUrl });
    }
    const videoId = videoIdMatch[1];
    console.log('Extracted Video ID:', videoId);

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

