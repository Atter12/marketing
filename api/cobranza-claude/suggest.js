/**
 * POST /api/cobranza-claude/suggest
 * Genera asunto + cuerpo HTML para cobranza con Claude (Anthropic).
 *
 * Vercel → Settings → Environment Variables:
 *   ANTHROPIC_API_KEY     (obligatorio) — de console.anthropic.com
 *   ANTHROPIC_MODEL       (opcional)    — default claude-3-5-haiku-20241022
 *   PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY — si están, exige Authorization: Bearer <access_token>
 *
 * Body JSON:
 *   { tipo: "cobro"|"agradecimiento", cliente_nombre, empresa?, monto_pendiente, moneda, periodo_etiqueta }
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-3-5-haiku-20241022";

function stripJsonFence(s) {
  let t = String(s || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/m, "");
  }
  return t.trim();
}

async function verifySupabaseSession(req) {
  const url = (process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  const auth = req.headers.authorization;
  if (!url || !anon) {
    return { ok: true, skipped: true };
  }
  if (!auth || !/^Bearer\s+\S+/i.test(auth)) {
    return { ok: false, status: 401, error: "Falta sesión. Volvé a entrar al panel e intentá de nuevo." };
  }
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: auth },
    });
    if (!r.ok) {
      return { ok: false, status: 401, error: "Sesión inválida o expirada." };
    }
    await r.json();
    return { ok: true };
  } catch (e) {
    return { ok: false, status: 503, error: "No se pudo validar la sesión." };
  }
}

function buildUserPrompt(body) {
  const tipo = body.tipo === "agradecimiento" ? "agradecimiento" : "cobro";
  const nombre = String(body.cliente_nombre || "Cliente").trim();
  const empresa = String(body.empresa || "").trim();
  const monto = String(body.monto_pendiente ?? "").trim();
  const moneda = String(body.moneda || "USD").trim();
  const periodo = String(body.periodo_etiqueta || "").trim();

  if (tipo === "agradecimiento") {
    return `Generá un correo en español (Perú/Latam, voseo o tú según suene natural) para un cliente de agencia de marketing.

Tipo: AGRADECIMIENTO — el cliente está al día, sin saldo pendiente según nuestros registros.
Cliente: ${nombre}${empresa ? `\nEmpresa/marca: ${empresa}` : ""}
Contexto del período: ${periodo || "Cuenta al día."}

Requisitos:
- Tono profesional, breve y humano (no frío ni amenazante).
- No inventes montos ni fechas que no te di.
- El cuerpo debe ser HTML simple: solo etiquetas <p>, <strong>, <br>. Sin <html>, <body>, ni estilos inline complejos.
- No incluyas firma de empresa al final (la agrega el sistema automáticamente).

Respondé ÚNICAMENTE con un JSON válido en una sola línea o bloque, sin texto antes ni después, con esta forma exacta:
{"subject":"asunto corto para la bandeja","bodyHtml":"<p>…</p>"}`;
  }

  return `Generá un correo en español (Perú/Latam) para un cliente de agencia de marketing.

Tipo: COBRO / recordatorio de saldo pendiente.
Cliente: ${nombre}${empresa ? `\nEmpresa/marca: ${empresa}` : ""}
Monto pendiente: ${moneda} ${monto}
Contexto del período o deuda: ${periodo || "Saldo pendiente según cuenta."}

Requisitos:
- Tono firme pero respetuoso; recordá el pago sin sonar agresivo.
- No inventes plazos, cuentas bancarias ni links de pago que no te di.
- El cuerpo debe ser HTML simple: solo <p>, <strong>, <br>.
- No incluyas firma corporativa al final (la agrega el sistema).

Respondé ÚNICAMENTE con un JSON válido con esta forma exacta:
{"subject":"asunto para la bandeja","bodyHtml":"<p>…</p>"}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error:
        "ANTHROPIC_API_KEY no está configurada en Vercel. Agregala en Project → Settings → Environment Variables (Production).",
    });
  }

  const authCheck = await verifySupabaseSession(req);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.error });
  }

  const body = req.body || {};
  const userContent = buildUserPrompt(body);
  const model = (process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim();

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system:
          "Sos un asistente que solo responde con JSON válido: {\"subject\":\"...\",\"bodyHtml\":\"...\"}. El bodyHtml usa solo <p>, <strong> y <br>. Sin markdown fuera del JSON.",
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }

    if (!response.ok) {
      const msg = data.error?.message || raw.slice(0, 200) || response.statusText;
      return res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json({
        success: false,
        error: msg || "Error al llamar a Anthropic",
      });
    }

    const text = data.content?.find((b) => b.type === "text")?.text;
    if (!text) {
      return res.status(502).json({ success: false, error: "Respuesta vacía de Claude." });
    }

    let parsed;
    try {
      parsed = JSON.parse(stripJsonFence(text));
    } catch (e) {
      return res.status(502).json({
        success: false,
        error: "Claude no devolvió JSON válido. Probá de nuevo o acortá el contexto.",
      });
    }

    const subject = String(parsed.subject || "").trim();
    const bodyHtml = String(parsed.bodyHtml || "").trim();
    if (!subject || !bodyHtml) {
      return res.status(502).json({ success: false, error: "Faltan subject o bodyHtml en la respuesta." });
    }

    return res.status(200).json({ success: true, data: { subject, bodyHtml } });
  } catch (err) {
    console.error("[cobranza-claude/suggest]", err);
    return res.status(500).json({ success: false, error: err.message || "Error interno" });
  }
}
