// API: POST /api/copy-ia/generate — Genera copy con OpenAI
// Body: { type, productName, context, tone }

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

function buildPrompt(type, productName, context, tone) {
    const toneText = tone ? ` Tono: ${tone}.` : '';
    const base = `Producto o servicio: ${productName || 'No especificado'}.${context ? ` Contexto o características: ${context}.` : ''}${toneText}`;

    const prompts = {
        producto: `Eres un copywriter experto en e-commerce. Genera una descripción de producto atractiva para web o marketplace (Amazon, Mercado Libre, etc.). ${base} Responde solo con el texto de la descripción, sin títulos ni explicaciones. Usa viñetas si ayuda. Máximo 250 palabras.`,
        ad_facebook: `Eres un copywriter experto en Meta Ads (Facebook/Instagram). Genera el texto principal de un anuncio que convierta. ${base} Responde solo con el copy del anuncio, sin explicaciones. Incluye gancho, beneficio y CTA. Máximo 125 caracteres para el gancho si es posible, luego el resto. En español.`,
        ad_tiktok: `Eres un copywriter experto en TikTok Ads y contenido viral. Genera el texto/copy para un anuncio en TikTok: directo, con gancho y CTA. ${base} Responde solo con el copy, sin explicaciones. Corto y impactante. En español.`,
        email: `Eres un copywriter experto en email marketing para e-commerce. Genera el cuerpo de un email (asunto + mensaje breve). ${base} Responde con dos líneas: primera línea "Asunto: ...", segunda línea el cuerpo del email. En español.`,
        seo: `Eres un experto en SEO para e-commerce. Genera un título y una descripción meta optimizados para buscadores (Google) del producto o servicio. ${base} Responde exactamente con dos líneas: primera "Título (max 60 caracteres): ...", segunda "Descripción (max 155 caracteres): ...". Incluye palabras clave naturales, atractivas para clics y en español. Sin explicaciones adicionales.`
    };

    return prompts[type] || prompts.producto;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ success: false, error: 'OPENAI_API_KEY no configurada en el servidor.' });
    }

    try {
        const { type, productName, context, tone } = req.body || {};
        const validTypes = ['producto', 'ad_facebook', 'ad_tiktok', 'email', 'seo'];
        const chosenType = validTypes.includes(type) ? type : 'producto';

        const userPrompt = buildPrompt(chosenType, String(productName || '').trim(), String(context || '').trim(), String(tone || '').trim());

        const response = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: 'Eres un copywriter profesional. Responde únicamente con el texto solicitado, en español, sin rodeos ni explicaciones previas. Siempre usa moneda en soles peruanos (S/) para precios, envíos o montos; nunca euros (€) ni dólares ($).' },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 800,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const msg = errData.error?.message || response.statusText;
            return res.status(response.status).json({
                success: false,
                error: msg || 'Error al llamar a OpenAI'
            });
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim() || '';

        return res.status(200).json({
            success: true,
            data: { text, type: chosenType }
        });
    } catch (err) {
        console.error('Error copy-ia generate:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Error interno del servidor'
        });
    }
}
