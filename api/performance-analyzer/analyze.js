// API: GET /api/performance-analyzer/analyze?url=https://example.com
// Analiza rendimiento de una URL (velocidad y métricas). Sin referencias a marcas externas.

const PSI_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

function extractLighthouse(result) {
  const lh = result && result.lighthouseResult;
  if (!lh || !lh.categories) return null;

  const categories = lh.categories;
  const audits = lh.audits || {};
  const getScore = (id) => {
    const c = categories[id];
    return c && typeof c.score === 'number' ? Math.round(c.score * 100) : null;
  };
  const getAudit = (id) => {
    const a = audits[id];
    if (!a) return null;
    return {
      score: a.score != null ? Math.round((a.score || 0) * 100) : null,
      displayValue: a.displayValue || null,
      description: a.description || null,
    };
  };

  const finalScreenshotAudit = audits['final-screenshot'];
  let finalScreenshot = null;
  if (finalScreenshotAudit && finalScreenshotAudit.details && finalScreenshotAudit.details.data) {
    const d = finalScreenshotAudit.details.data;
    finalScreenshot = typeof d === 'string' && d.indexOf('data:') === 0 ? d : 'data:image/jpeg;base64,' + d;
  }

  return {
    requestedUrl: lh.requestedUrl || null,
    finalUrl: lh.finalUrl || null,
    fetchTime: lh.fetchTime || null,
    finalScreenshot: finalScreenshot || null,
    categories: {
      performance: getScore('performance'),
      accessibility: getScore('accessibility'),
      'best-practices': getScore('best-practices'),
      seo: getScore('seo'),
    },
    audits: {
      'first-contentful-paint': getAudit('first-contentful-paint'),
      'largest-contentful-paint': getAudit('largest-contentful-paint'),
      'cumulative-layout-shift': getAudit('cumulative-layout-shift'),
      'total-blocking-time': getAudit('total-blocking-time'),
      'speed-index': getAudit('speed-index'),
      'interactive': getAudit('interactive'),
      'max-potential-fid': getAudit('max-potential-fid'),
    },
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const rawUrl = (req.query.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ success: false, error: 'Falta el parámetro url' });
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch (_) {
      return res.status(400).json({ success: false, error: 'URL no válida' });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ success: false, error: 'URL debe ser http o https' });
    }

    const url = parsed.href;
    const apiKey = process.env.GOOGLE_PSI_API_KEY || '';
    const query = (strategy) => {
      const params = new URLSearchParams({ url, strategy });
      if (apiKey) params.set('key', apiKey);
      return `${PSI_BASE}?${params.toString()}`;
    };

    const [mobileRes, desktopRes] = await Promise.all([
      fetch(query('mobile')),
      fetch(query('desktop')),
    ]);

    const status = mobileRes.status || desktopRes.status;
    if (status === 429) {
      const hasKey = !!apiKey;
      return res.status(200).json({
        success: false,
        error: hasKey
          ? 'Límite diario de análisis alcanzado. Vuelve a intentar mañana.'
          : 'Límite diario de análisis alcanzado. Añade GOOGLE_PSI_API_KEY en Vercel (Google Cloud, PageSpeed Insights API) para tener cuota propia, o intenta mañana.',
      });
    }

    if (!mobileRes.ok || !desktopRes.ok) {
      const resToRead = !mobileRes.ok ? mobileRes : desktopRes;
      const msg = await resToRead.text();
      console.error('PSI error:', mobileRes.status, desktopRes.status, msg);
      return res.status(200).json({
        success: false,
        error: 'No se pudo analizar la URL. Comprueba que la web esté accesible e inténtalo de nuevo.',
      });
    }

    const mobileJson = await mobileRes.json();
    const desktopJson = await desktopRes.json();

    const mobile = extractLighthouse(mobileJson);
    const desktop = extractLighthouse(desktopJson);

    if (!mobile && !desktop) {
      return res.status(502).json({
        success: false,
        error: 'La respuesta del análisis no tiene el formato esperado.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        url,
        mobile,
        desktop,
      },
    });
  } catch (err) {
    console.error('Performance analyzer error:', err);
    return res.status(500).json({
      success: false,
      error: 'Error interno. Vuelve a intentarlo.',
    });
  }
}
