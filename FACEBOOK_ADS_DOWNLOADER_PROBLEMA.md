# Facebook Ads Downloader - Problema y Soluciones

## 🎯 Objetivo

Crear un sistema funcional para descargar imágenes y videos de anuncios de Facebook Ads Library desde una landing page, similar a como funciona el TikTok Downloader del proyecto. El objetivo es que los usuarios puedan:

1. Pegar una URL de Facebook Ads Library (ej: `https://www.facebook.com/ads/library/?id=1203945338543977`)
2. Obtener y visualizar el anuncio (imagen o video)
3. Descargar la imagen o video del anuncio

## ❌ Problema Actual

**Error principal:** Facebook CDN está devolviendo `403 Forbidden` con el mensaje **"URL signature mismatch"** o **"Bad URL hash"** cuando intentamos descargar las imágenes/videos, incluso cuando:

- Usamos headers completos de navegador real
- Usamos múltiples estrategias de URL (con y sin parámetros de firma)
- Intentamos descargar inmediatamente después de obtener el HTML (mientras la firma debería ser válida)
- El HTML se obtiene exitosamente (200 OK)

## 📊 Logs Actuales (Última Prueba)

### Frontend Response (200 OK - Éxito)
```
Response Status: 200
Response Data: {
  success: true, 
  adId: '1203945338543977', 
  id: '1203945338543977', 
  videoUrl: null, 
  videoBase64: null, 
  imageUrl: 'https://scontent-iad3-1.xx.fbcdn.net/v/t1.30497-1/85215299_479381239411958_7755129104415850496_n.jpg?',
  imageBase64: null,
  ...
}
```

### Backend Logs - Descarga de HTML (ÉXITO ✅)
```
[fetchFacebookAd] Strategy 1: Trying with full browser headers (including Sec-Fetch)...
[fetchFacebookAd] Strategy 1 - Response status: 200
[fetchFacebookAd] Strategy 1 - HTML received, length: 680176
[parseHtmlForAdData] Pattern 3: SUCCESS - Found image URL directly from HTML
[parseHtmlForAdData] Pattern 3 - Final image URL: https://scontent-iad3-1.xx.fbcdn.net/v/t1.30497-1/85215299_479381239411958_7755129104415850496_n.jpg?
```

### Backend Logs - Descarga de Imagen (FALLO ❌)
```
[fetchFacebookAd] Strategy 1 - Attempting immediate image download while signature is fresh...
[fetchFacebookAd] Strategy 1 - Image download failed: 403

[Download Image] Strategy 1: Trying to download from https://scontent-iad3-1.xx.fbcdn.net/v/t1.30497-1/85215299_479381239411958_7755129104415850496_n.jpg?...
[Download Image] Strategy 1 - Response status: 403
[Download Image] Strategy 1 - Failed: 403 Bad URL hash

[Download Image] Strategy 2: Trying to download from https://scontent-iad3-1.xx.fbcdn.net/v/t1.30497-1/85215299_479381239411958_7755129104415850496_n.jpg?...
[Download Image] Strategy 2 - Response status: 403
[Download Image] Strategy 2 - Failed: 403 Bad URL hash

[Download Image] Strategy 3: Trying to download from https://scontent-iad3-1.xx.fbcdn.net/v/t1.30497-1/85215299_479381239411958_7755129104415850496_n.jpg?...
[Download Image] Strategy 3 - Response status: 403
[Download Image] Strategy 3 - Failed: 403 Bad URL hash

WARNING: Could not download image with any strategy - will use proxy as fallback
```

### Proxy Response (FALLO ❌)
```
GET /api/facebook/proxy?url=https%3A%2F%2Fscontent-iad3-1.xx.fbcdn.net%2Fv%2Ft1.30497-1%2F85215299_479381239411958_7755129104415850496_n.jpg%3F
403 (Forbidden)
Error loading image: https://marketing-nu-lake.vercel.app/api/facebook/proxy?url=...
```

### Observaciones Clave

1. **HTML se obtiene correctamente:** Facebook devuelve 200 OK con el HTML completo del anuncio
2. **Parsing funciona:** Se extrae correctamente la URL de la imagen del HTML
3. **Problema con la URL extraída:** La URL tiene `?` al final sin parámetros: `https://scontent-iad3-1.xx.fbcdn.net/v/t1.30497-1/85215299_479381239411958_7755129104415850496_n.jpg?`
4. **Firmas faltantes:** La URL extraída NO tiene los parámetros `oe=` y `oh=` que son firmas de seguridad que Facebook requiere
5. **Error consistente:** Todas las estrategias fallan con 403 "Bad URL hash", indicando que Facebook valida la firma de la URL
6. **Video no detectado:** Los logs muestran 0 videos encontrados, solo imágenes

## 🔍 Análisis del Problema

### Por qué falla

1. **Validación de firma de URL:** Facebook CDN valida que las URLs de imágenes/videos tengan parámetros de firma válidos (`oe=`, `oh=`) que son generados dinámicamente
2. **URL incompleta:** El parsing está extrayendo una URL base sin los parámetros de firma necesarios
3. **Firmas expiradas:** Incluso si obtuviéramos la URL completa con firma, estas expiran rápidamente (probablemente en segundos o minutos)
4. **Cookies/Sesión requeridas:** Facebook puede requerir cookies de sesión válidas para acceder al CDN
5. **Anti-bot avanzado:** Facebook tiene sistemas anti-bot sofisticados que detectan requests automatizados incluso con headers completos

### Lo que SÍ funciona

- ✅ Obtener el HTML de Facebook Ads Library (200 OK)
- ✅ Parsear el HTML y extraer datos del anuncio (pageName, adText, etc.)
- ✅ Identificar que existe una imagen (aunque no se pueda descargar)

### Lo que NO funciona

- ❌ Descargar imágenes del CDN de Facebook (403 Bad URL hash)
- ❌ Descargar videos del CDN de Facebook (no se detectan videos)
- ❌ Proxy server para bypass (mismo 403)
- ❌ Múltiples estrategias de URL (todas fallan)

## 💡 Soluciones Planteadas (Intentadas)

### Solución 1: Headers de Navegador Completo ✅ (Implementada)
**Estado:** Implementada pero no resuelve el problema
- Headers completos con `User-Agent`, `Referer`, `Origin`, `Sec-Fetch-*`, etc.
- Resultado: HTML se obtiene, pero imagen falla con 403

### Solución 2: Descarga Inmediata Post-Parse ✅ (Implementada)
**Estado:** Implementada pero no resuelve el problema
- Descargar imagen inmediatamente después de parsear el HTML (mientras la firma debería ser válida)
- Convertir a base64 para evitar expiración
- Resultado: Falla con 403 "Bad URL hash" incluso inmediatamente

### Solución 3: Múltiples Estrategias de URL ✅ (Implementada)
**Estado:** Implementada pero no resuelve el problema
- Estrategia 1: URL completa original
- Estrategia 2: URL sin parámetros de firma (`oe=`, `oh=`)
- Estrategia 3: URL sin parámetro `stp=` (tamaño)
- Resultado: Todas fallan con 403

### Solución 4: Proxy Server ✅ (Implementada)
**Estado:** Implementada pero no resuelve el problema
- Endpoint `/api/facebook/proxy` que hace fetch desde el servidor con headers de navegador
- Stream del contenido al cliente
- Resultado: Mismo 403 "URL signature mismatch"

### Solución 5: Mejorar Parsing de URLs ⚠️ (Parcialmente Implementada)
**Estado:** Implementada pero el problema es más profundo
- Buscar imágenes sin parámetros de tamaño (`s50x50`, etc.)
- Buscar URLs de mejor calidad
- Corregir URLs malformadas (`&` después de extensión)
- **Problema:** La URL extraída no tiene los parámetros de firma necesarios

## 🚀 Solución Propuesta: Puppeteer/Playwright

### ¿Por qué Puppeteer/Playwright?

Facebook está usando técnicas anti-bot sofisticadas que requieren:
1. **JavaScript ejecutado:** Facebook carga contenido dinámicamente con JavaScript
2. **Cookies de sesión:** Necesita cookies válidas del navegador
3. **Validación de firma en tiempo real:** Las URLs con firmas se generan dinámicamente en el cliente
4. **Detección de automatización:** Detecta requests HTTP simples y los bloquea

**Puppeteer/Playwright** simula un navegador real completo:
- Ejecuta JavaScript real
- Maneja cookies y sesión
- Puede interactuar con la página como un usuario real
- Obtiene URLs con firmas válidas generadas dinámicamente

### Implementación Propuesta

```javascript
// api/facebook/download-puppeteer.js
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { url, type } = req.body;
    const adId = extractAdId(url);

    // Configurar Puppeteer para Vercel
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    
    // Configurar headers de navegador real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navegar a la página del anuncio
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Esperar a que cargue el contenido dinámico
    await page.waitForSelector('[data-testid="ad-card"]', { timeout: 10000 }).catch(() => {});
    
    // Extraer URLs de imagen/video directamente del DOM (con firmas válidas)
    const adData = await page.evaluate(() => {
      // Buscar imágenes/videos en el DOM cargado con JavaScript
      const img = document.querySelector('img[src*="fbcdn.net"]');
      const video = document.querySelector('video source');
      
      return {
        imageUrl: img?.src || null,
        videoUrl: video?.src || null,
        pageName: document.querySelector('[data-testid="advertiser-name"]')?.textContent || null,
        adText: document.querySelector('[data-testid="ad-text"]')?.textContent || null,
      };
    });
    
    await browser.close();
    
    // Si tenemos URLs, descargar inmediatamente (ahora sí funcionará porque las firmas son válidas)
    let imageBase64 = null;
    if (adData.imageUrl) {
      const imgResponse = await fetch(adData.imageUrl);
      if (imgResponse.ok) {
        const buffer = await imgResponse.arrayBuffer();
        imageBase64 = `data:${imgResponse.headers.get('content-type')};base64,${Buffer.from(buffer).toString('base64')}`;
      }
    }
    
    return res.status(200).json({
      success: true,
      adId,
      imageUrl: adData.imageUrl,
      imageBase64,
      videoUrl: adData.videoUrl,
      pageName: adData.pageName,
      adText: adData.adText,
    });
    
  } catch (error) {
    console.error('Puppeteer error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### Configuración para Vercel

1. **Instalar dependencias:**
```json
{
  "dependencies": {
    "puppeteer-core": "^21.0.0",
    "@sparticuz/chromium": "^119.0.0"
  }
}
```

2. **Configurar vercel.json:**
```json
{
  "functions": {
    "api/facebook/download-puppeteer.js": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

### Alternativa: Playwright

Playwright es similar a Puppeteer pero más moderno y con mejor soporte para múltiples navegadores:

```javascript
import { chromium } from 'playwright';

export default async function handler(req, res) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // ... similar a Puppeteer
}
```

### Consideraciones

- **Costo:** Puppeteer/Playwright consume más recursos (CPU, memoria, tiempo)
- **Tiempo de ejecución:** Más lento que fetch directo (10-30 segundos vs 1-2 segundos)
- **Límites de Vercel:** Necesita configuración especial para funciones serverless
- **Mantenimiento:** Más complejo de mantener que fetch simple

## 📁 Archivos Clave para Analizar

### Backend

1. **`api/facebook/download.js`** ⭐ **PRINCIPAL**
   - Función `fetchFacebookAd()`: Obtiene HTML de Facebook Ads Library
   - Función `parseHtmlForAdData()`: Parsea HTML para extraer URLs de imagen/video
   - Función `downloadImageWithStrategies()`: Múltiples estrategias para descargar imagen
   - Handler principal: Procesa requests POST

2. **`api/facebook/proxy.js`** ⭐ **IMPORTANTE**
   - Endpoint proxy para descargar imágenes/videos del CDN de Facebook
   - Múltiples estrategias de fetch con diferentes headers
   - Manejo de errores 403

### Frontend

3. **`facebook-ads-downloader.html`** ⭐ **PRINCIPAL**
   - Landing page del descargador
   - Función `handleDownload()`: Llama al API y maneja respuesta
   - Funciones `downloadImageBtn.onclick` y `downloadVideoBtn.onclick`: Descarga de media
   - Manejo de base64 y proxy como fallback

### Configuración

4. **`vercel.json`**
   - Rutas y configuración de funciones serverless
   - Configuración de timeout y memoria (necesario para Puppeteer)

5. **`package.json`**
   - Dependencias del proyecto
   - Scripts de build (si aplica)

## 🔧 Pasos Siguientes Recomendados

### Opción 1: Implementar Puppeteer/Playwright (Recomendado)

1. Instalar dependencias necesarias
2. Crear nueva función `api/facebook/download-puppeteer.js`
3. Configurar Vercel para soportar Puppeteer
4. Actualizar frontend para usar nuevo endpoint
5. Probar con anuncios reales

### Opción 2: Mejorar Parsing (Menos probable que funcione)

1. Analizar HTML completo para encontrar URLs con firmas válidas
2. Buscar en estructuras JSON embebidas en el HTML
3. Intentar extraer cookies del primer request y usarlas en requests de imagen
4. Buscar patrones alternativos de URLs en el HTML

### Opción 3: Servicio Externo

1. Usar servicio de terceros que ya resuelva este problema
2. API de scraping dedicada (Bright Data, ScraperAPI, etc.)
3. Costo adicional pero más confiable

## 📝 Notas Técnicas

### Headers Usados Actualmente
```javascript
{
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'image/*,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://www.facebook.com/ads/library/',
  'Origin': 'https://www.facebook.com',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-Mode': 'no-cors',
  'Sec-Fetch-Dest': 'image',
  'Connection': 'keep-alive',
  'DNT': '1',
  'Cache-Control': 'no-cache'
}
```

### Patrón de URLs Extraídas
- **URL extraída:** `https://scontent-iad3-1.xx.fbcdn.net/v/t1.30497-1/85215299_479381239411958_7755129104415850496_n.jpg?`
- **Problema:** Falta parámetros `oe=` y `oh=` que son firmas de seguridad
- **URL esperada (ejemplo):** `https://scontent-xxx.fbcdn.net/v/t1.30497-1/xxx.jpg?stp=xxx&_nc_cat=1&ccb=1-7&_nc_sid=xxx&_nc_ohc=xxx&_nc_oc=xxx&oe=69898456&oh=xxx`

### Estructura de Respuesta Actual
```json
{
  "success": true,
  "adId": "1203945338543977",
  "imageUrl": "https://scontent-xxx.fbcdn.net/v/t1.30497-1/xxx.jpg?",
  "imageBase64": null,  // null porque falla la descarga
  "videoUrl": null,
  "videoBase64": null,
  "pageName": "Cafeteriam",
  "adText": "This Handy Banana Clip Put Up Your Hair In Seconds! ❣️Best Accessories for Thick, Curly, Kinky Hair!",
  "startDate": "10/1/2026"
}
```

## 🎯 Objetivo Final

**Crear un sistema que:**
1. ✅ Obtiene el HTML de Facebook Ads Library (YA FUNCIONA)
2. ✅ Parsea el anuncio correctamente (YA FUNCIONA)
3. ❌ Descarga imágenes/videos del anuncio (NO FUNCIONA - 403)
4. ❌ Muestra preview en la landing page (NO FUNCIONA - 403)
5. ❌ Permite descargar el archivo (NO FUNCIONA - 403)

**Para lograr el objetivo 3-5, necesitamos Puppeteer/Playwright o una solución similar.**

## 📚 Referencias

- [Puppeteer Documentation](https://pptr.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Vercel Serverless Functions with Puppeteer](https://vercel.com/docs/functions/serverless-functions/runtimes/node-js#using-other-apis)
- [Chromium for Serverless](https://github.com/Sparticuz/chromium)

## ⚠️ Advertencias

- Facebook puede detectar y bloquear automatización, incluso con Puppeteer
- Las firmas de URL pueden cambiar sin aviso
- Puede ser necesario usar proxies rotatorios para evitar rate limiting
- Considerar implementar cache para evitar múltiples requests al mismo anuncio

---

**Última actualización:** 10 de Enero, 2026
**Estado:** En espera de implementación de Puppeteer/Playwright



