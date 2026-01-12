# 🔧 Implementación Backend - Descarga de TikTok

## ⚠️ Estado Actual

**NO FUNCIONA REALMENTE** - Actualmente solo simula la descarga. Necesitas implementar el backend real.

## 📋 Opciones de Implementación

### Opción 1: API de Terceros (Más Fácil) ⭐ RECOMENDADO

Usar un servicio API como RapidAPI:

```javascript
// En api/tiktok/download.js, reemplazar fetchTikTokVideo con:

async function fetchTikTokVideo(url, videoId, type) {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  const RAPIDAPI_HOST = 'tiktok-video-no-watermark2.p.rapidapi.com'; // Ejemplo
  
  try {
    const response = await fetch(`https://${RAPIDAPI_HOST}/`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      },
      // Agregar parámetros según la API que uses
    });
    
    const data = await response.json();
    
    return {
      success: true,
      videoUrl: data.data.play, // URL sin marca de agua
      audioUrl: data.data.music?.play_url,
      thumbnail: data.data.cover,
      duration: data.data.duration,
      author: data.data.author,
      title: data.data.title
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**APIs disponibles:**
- [RapidAPI - TikTok Downloader](https://rapidapi.com/hub) - Buscar "TikTok Downloader"
- [TikTok Downloader APIs](https://rapidapi.com/collection/tiktok-downloader-apis)

### Opción 2: Librería de Node.js

#### Usar @tobyg74/tiktok-api-dl:

```bash
npm install @tobyg74/tiktok-api-dl
```

```javascript
import { TiktokDL } from '@tobyg74/tiktok-api-dl';

async function fetchTikTokVideo(url, videoId, type) {
  try {
    const result = await TiktokDL(url, {
      version: "v1" // o "v2"
    });
    
    return {
      success: true,
      videoUrl: result.result.video, // URL sin marca de agua
      audioUrl: result.result.music,
      thumbnail: result.result.thumbnail,
      duration: result.result.duration,
      author: result.result.author,
      title: result.result.description
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Opción 3: yt-dlp (Python)

Si usas Python runtime en Vercel:

```python
# api/tiktok/download.py
import yt_dlp
import json

def handler(req, res):
    url = req.json['url']
    
    ydl_opts = {
        'format': 'best',
        'outtmpl': '%(id)s.%(ext)s',
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        video_url = info['url']
    
    return {'videoUrl': video_url}
```

### Opción 4: Scraping con Puppeteer (Avanzado)

```javascript
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

async function fetchTikTokVideo(url, videoId, type) {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // Extraer datos del video (estructura puede cambiar)
    const videoData = await page.evaluate(() => {
      // TikTok inyecta datos en window.__UNIVERSAL_DATA_FOR_REHYDRATION__
      const data = window.__UNIVERSAL_DATA_FOR_REHYDRATION__;
      // Buscar URL del video sin marca de agua
      // Esto requiere investigación de la estructura actual
    });
    
    await browser.close();
    
    return {
      success: true,
      videoUrl: videoData.play_addr?.url_list?.[0], // Ejemplo
      // ... otros campos
    };
  } catch (error) {
    if (browser) await browser.close();
    return { success: false, error: error.message };
  }
}
```

## 🚀 Pasos para Implementar

### 1. Elegir una opción

**Para empezar rápido:** Opción 1 (API de terceros)
**Para control total:** Opción 2 o 4

### 2. Configurar variables de entorno en Vercel

```bash
# En Vercel Dashboard > Settings > Environment Variables
RAPIDAPI_KEY=tu_api_key_aqui
```

### 3. Actualizar el código

Reemplazar la función `fetchTikTokVideo` en `api/tiktok/download.js` con la implementación elegida.

### 4. Actualizar el frontend

Ya está listo, solo necesitas que el backend responda correctamente.

## 📝 Estructura de Respuesta Esperada

El frontend espera esta estructura:

```json
{
  "success": true,
  "videoId": "1234567890",
  "videoUrl": "https://...video-sin-marca-de-agua.mp4",
  "audioUrl": "https://...audio.mp3",
  "thumbnail": "https://...thumbnail.jpg",
  "duration": 30,
  "author": "@usuario",
  "title": "Título del video",
  "noWatermark": true
}
```

## ⚠️ Consideraciones Importantes

1. **Límites de API**: Las APIs gratuitas tienen límites de uso
2. **Costo**: Algunas APIs cobran por uso
3. **Legal**: Verificar términos de servicio de TikTok
4. **Mantenimiento**: TikTok cambia su estructura frecuentemente
5. **Rate Limiting**: Implementar límites de uso por IP

## 🧪 Testing

Una vez implementado, probar con:

```bash
curl -X POST https://marketing-nu-lake.vercel.app/api/tiktok/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tiktok.com/@usuario/video/1234567890"}'
```

## 📚 Recursos

- [Vercel Serverless Functions Docs](https://vercel.com/docs/functions)
- [RapidAPI TikTok APIs](https://rapidapi.com/hub)
- [TikTok API Documentation](https://developers.tiktok.com/)






