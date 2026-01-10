// Vercel Serverless Function para descargar anuncios de Facebook Ads Library usando Puppeteer
// Puppeteer permite ejecutar JavaScript y obtener URLs con firmas válidas del CDN de Facebook
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
  console.log('=== FACEBOOK ADS PUPPETEER API CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

  let browser = null;

  try {
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

    // Configurar Puppeteer para Vercel con argumentos mejorados
    console.log('Launching Puppeteer browser...');
    
    // Intentar diferentes configuraciones según el entorno
    const launchOptions = {
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
      ignoreHTTPSErrors: true,
    };
    
    // En entorno de Vercel, usar configuración específica
    if (process.env.VERCEL) {
      launchOptions.args.push('--disable-extensions');
      launchOptions.args.push('--disable-software-rasterizer');
    }
    
    browser = await puppeteer.launch(launchOptions);

    console.log('Browser launched successfully');
    const page = await browser.newPage();
    
    // Configurar headers de navegador real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Configurar headers adicionales
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    });
    
    console.log('Navigating to Facebook Ads Library page...');
    // Navegar a la página del anuncio
    await page.goto(normalizedUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    console.log('Page loaded, waiting for content...');
    
    // Esperar a que cargue el contenido dinámico
    try {
      await page.waitForSelector('img, video, [data-testid="ad-card"]', { timeout: 20000 });
    } catch (e) {
      console.log('Primary selector timeout, trying alternative...');
    }
    
    // Esperar a que las imágenes se carguen completamente
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('img[src*="fbcdn.net"]').length > 0,
        { timeout: 10000 }
      );
    } catch (e) {
      console.log('Image loading timeout, continuing...');
    }
    
    // Esperar un poco más para que todas las URLs con firmas estén listas
    await page.waitForTimeout(3000);
    
    console.log('Extracting ad data from DOM...');
    
    // Extraer URLs de imagen/video directamente del DOM (con firmas válidas generadas por JavaScript)
    const adData = await page.evaluate(() => {
      const result = {
        imageUrl: null,
        videoUrl: null,
        pageName: null,
        adText: null,
        startDate: null,
      };

      // Buscar todas las imágenes y seleccionar la mejor (mayor resolución, no thumbnail)
      const images = Array.from(document.querySelectorAll('img'));
      let bestImage = null;
      let bestImageScore = 0;
      
      for (const img of images) {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original');
        if (src && src.includes('fbcdn.net')) {
          // Filtrar thumbnails y avatares
          if (src.includes('s50x50') || src.includes('s100x100') || src.includes('profile') || src.includes('avatar')) {
            continue;
          }
          
          // Calcular "score" basado en si tiene parámetros de tamaño (mejor sin ellos)
          let score = 0;
          if (!src.includes('stp=')) score += 10;
          if (src.includes('.jpg') || src.includes('.png') || src.includes('.webp')) score += 5;
          if (src.includes('/v/t')) score += 3;
          
          // Preferir URLs con más parámetros (más completa, más probable que tenga firma)
          const paramCount = (src.match(/[?&]/g) || []).length;
          score += paramCount;
          
          if (score > bestImageScore) {
            bestImageScore = score;
            bestImage = src;
          }
        }
      }
      
      result.imageUrl = bestImage;
      if (bestImage) {
        console.log('Found best image URL:', bestImage.substring(0, 150));
      }

      // Buscar videos - buscar en múltiples lugares
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
              console.log('Found video URL:', src.substring(0, 150));
              break;
            }
          }
        }
        if (result.videoUrl) break;
      }
      
      // Si no encontramos imagen, buscar en atributos style (background-image)
      if (!result.imageUrl) {
        const styleElements = document.querySelectorAll('[style*="background-image"], [style*="url("]');
        for (const elem of styleElements) {
          const style = elem.getAttribute('style') || '';
          const urlMatch = style.match(/url\(['"]?([^'")]+)['"]?\)/);
          if (urlMatch && urlMatch[1] && urlMatch[1].includes('fbcdn.net') && !urlMatch[1].includes('s50x50')) {
            result.imageUrl = urlMatch[1];
            console.log('Found image in style:', result.imageUrl.substring(0, 150));
            break;
          }
        }
      }

      // Buscar nombre de página/advertiser
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
            // Filtrar textos muy cortos o que parecen UI elements
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

      // Buscar fecha (si está disponible)
      const dateElements = document.querySelectorAll('[data-testid*="date"], time, [title*="202"]');
      for (const elem of dateElements) {
        const dateText = elem.getAttribute('title') || elem.textContent || elem.getAttribute('datetime');
        if (dateText && dateText.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
          result.startDate = dateText;
          break;
        }
      }

      return result;
    });
    
    console.log('Ad data extracted:', {
      hasImage: !!adData.imageUrl,
      imageUrlLength: adData.imageUrl ? adData.imageUrl.length : 0,
      imageUrlPreview: adData.imageUrl ? adData.imageUrl.substring(0, 200) : null,
      hasVideo: !!adData.videoUrl,
      videoUrlLength: adData.videoUrl ? adData.videoUrl.length : 0,
      pageName: adData.pageName,
      adTextLength: adData.adText ? adData.adText.length : 0,
    });

    // Cerrar el navegador lo antes posible para liberar recursos
    await browser.close();
    browser = null;

    // Si tenemos URLs, descargar inmediatamente (ahora sí funcionará porque las firmas son válidas)
    let imageBase64 = null;
    let videoBase64 = null;

    if (adData.imageUrl) {
      try {
        console.log('Downloading image with valid signature...');
        const imgResponse = await fetch(adData.imageUrl, {
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
          imageBase64 = `data:${imgContentType};base64,${imgBase64}`;
          console.log('SUCCESS: Image downloaded and converted to base64, size:', imgBase64.length);
        } else {
          console.log('Image download failed:', imgResponse.status);
        }
      } catch (imgErr) {
        console.log('Image download error:', imgErr.message);
      }
    }
    
    if (adData.videoUrl) {
      try {
        console.log('Downloading video with valid signature...');
        const vidResponse = await fetch(adData.videoUrl, {
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
          videoBase64 = `data:${vidContentType};base64,${vidBase64}`;
          console.log('SUCCESS: Video downloaded and converted to base64, size:', vidBase64.length);
        } else {
          console.log('Video download failed:', vidResponse.status);
        }
      } catch (vidErr) {
        console.log('Video download error:', vidErr.message);
      }
    }

    // Si no encontramos URLs, intentar parsear el HTML como fallback
    if (!adData.imageUrl && !adData.videoUrl) {
      console.log('No URLs found in DOM, trying HTML parsing as fallback...');
      // Aquí podríamos hacer un page.content() y parsear el HTML
      // Pero por ahora devolvemos lo que tenemos
    }
    
    return res.status(200).json({
      success: true,
      adId,
      id: adId,
      videoUrl: adData.videoUrl,
      videoBase64,
      imageUrl: adData.imageUrl,
      imageBase64,
      thumbnail: adData.imageUrl || null,
      pageName: adData.pageName || 'Página de Facebook',
      author: adData.pageName || 'Página de Facebook',
      adText: adData.adText || 'Anuncio de Facebook',
      title: adData.adText || 'Anuncio de Facebook',
      startDate: adData.startDate || new Date().toLocaleDateString('es-ES'),
      method: 'puppeteer'
    });
    
  } catch (error) {
    console.error('ERROR en Puppeteer API:', error);
    console.error('Error stack:', error.stack);
    
    // Asegurar que el navegador se cierra incluso en caso de error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

