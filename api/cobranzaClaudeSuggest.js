/**
 * POST /api/cobranzaClaudeSuggest  (ruta plana: evita 404 en algunos deploys con carpetas anidadas en /api)
 * GET  /api/cobranzaClaudeSuggest  → health check (ver en navegador si la función existe)
 *
 * Variables: ANTHROPIC_API_KEY, opcional ANTHROPIC_MODEL, PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY
 *
 * Modelo por defecto: alias Haiku 4.5 (rápido / económico). Los viejos p.ej. claude-3-5-haiku-20241022
 * pueden devolver 404 desde Anthropic. Ver https://docs.anthropic.com/en/docs/about-claude/models
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
/** Alias estable a último Haiku 4.5; snapshot fijo alternativo: claude-haiku-4-5-20251001 */
const DEFAULT_MODEL = "claude-haiku-4-5";
const LOG = "[cobranzaClaudeSuggest]";

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
    console.log(LOG, "auth: sin PUBLIC_SUPABASE_URL/ANON → no se exige JWT");
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
      console.warn(LOG, "auth: Supabase /user status", r.status);
      return { ok: false, status: 401, error: "Sesión inválida o expirada." };
    }
    await r.json();
    console.log(LOG, "auth: sesión OK");
    return { ok: true };
  } catch (e) {
    console.error(LOG, "auth: fetch error", e?.message || e);
    return { ok: false, status: 503, error: "No se pudo validar la sesión." };
  }
}

function resolveAgencyName(body) {
  const fromBody = String(body.agencia_nombre || "").trim();
  if (fromBody) return fromBody;
  const fromEnv = String(process.env.COBRANZA_BRAND_NAME || process.env.EMAIL_BRAND_NAME || "").trim();
  if (fromEnv) return fromEnv;
  return "Holistic Marketing";
}

function buildUserPrompt(body, agenciaNombre) {
  const tipo = body.tipo === "agradecimiento" ? "agradecimiento" : "cobro";
  const nombre = String(body.cliente_nombre || "Cliente").trim();
  const empresa = String(body.empresa || "").trim();
  const monto = String(body.monto_pendiente ?? "").trim();
  const moneda = String(body.moneda || "USD").trim();
  const periodo = String(body.periodo_etiqueta || "").trim();
  const marcaAgencia = String(agenciaNombre || "Holistic Marketing").trim();

  const reglaMarca = `OBLIGATORIO — Agencia que envía el correo: "${marcaAgencia}".
- El cuerpo HTML debe incluir al menos una vez la cadena exacta ${marcaAgencia} (sin abreviar ni sustituir por "nosotros" solo).
- Frases útiles: "desde ${marcaAgencia}", "el equipo de ${marcaAgencia}", "en ${marcaAgencia}".
- El asunto puede incluir "${marcaAgencia}" si encaja.
- "${empresa || "(sin dato)"}" es el negocio del CLIENTE; no lo uses como nombre de la agencia.`;

  if (tipo === "agradecimiento") {
    return `Generá un correo en español (Perú/Latam, voseo o tú según suene natural).

Tipo: AGRADECIMIENTO — el cliente está al día, sin saldo pendiente según nuestros registros.
Cliente: ${nombre}${empresa ? `\nEmpresa o marca del cliente (su negocio): ${empresa}` : ""}
Contexto del período: ${periodo || "Cuenta al día."}

${reglaMarca}

Requisitos:
- Tono profesional, breve y humano (no frío ni amenazante).
- No inventes montos ni fechas que no te di.
- El cuerpo debe ser HTML simple: solo etiquetas <p>, <strong>, <br>. Sin <html>, <body>, ni estilos inline complejos.
- No incluyas firma de empresa al final (la agrega el sistema automáticamente).

Respondé ÚNICAMENTE con un JSON válido en una sola línea o bloque, sin texto antes ni después, con esta forma exacta:
{"subject":"asunto corto para la bandeja","bodyHtml":"<p>…</p>"}`;
  }

  return `Generá un correo en español (Perú/Latam).

Tipo: COBRO / recordatorio de saldo pendiente.
Cliente: ${nombre}${empresa ? `\nEmpresa o marca del cliente (su negocio): ${empresa}` : ""}
Monto pendiente: ${moneda} ${monto}
Contexto del período o deuda: ${periodo || "Saldo pendiente según cuenta."}

${reglaMarca}

Requisitos:
- Tono firme pero respetuoso; recordá el pago sin sonar agresivo.
- No inventes plazos, cuentas bancarias ni links de pago que no te di.
- El cuerpo debe ser HTML simple: solo <p>, <strong>, <br>.
- No incluyas firma corporativa al final (la agrega el sistema).

Respondé ÚNICAMENTE con un JSON válido con esta forma exacta:
{"subject":"asunto para la bandeja","bodyHtml":"<p>…</p>"}`;
}

export default async function handler(req, res) {
  res.setHeader("x-cobranza-endpoint", "cobranzaClaudeSuggest");

  console.log(LOG, "request", {
    method: req.method,
    url: req.url,
    vercelId: req.headers["x-vercel-id"],
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
  });

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Endpoint activo. Usá POST con JSON desde Crédito → Cobranza → Personalizar con IA.",
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      supabaseAuthEnforced: Boolean(
        (process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
          (process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
      ),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(LOG, "ANTHROPIC_API_KEY ausente");
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
  const agenciaNombre = resolveAgencyName(body);
  console.log(LOG, "POST body keys", Object.keys(body), "tipo", body.tipo, "agencia", agenciaNombre);
  const userContent = buildUserPrompt(body, agenciaNombre);
  const model = (process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim();

  try {
    console.log(LOG, "Anthropic request", { model });
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
          "Sos un asistente para redactar correos de una agencia de marketing. Si el prompt da un nombre de agencia entre comillas, el bodyHtml debe contener ese nombre textual al menos una vez; no lo omitas por brevedad. Respondé solo con JSON: {\"subject\":\"...\",\"bodyHtml\":\"...\"}. bodyHtml: solo <p>, <strong> y <br>. Sin markdown fuera del JSON.",
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

    console.log(LOG, "Anthropic response", { status: response.status, ok: response.ok });

    if (!response.ok) {
      const msg = data.error?.message || raw.slice(0, 200) || response.statusText;
      console.error(LOG, "Anthropic error body", raw.slice(0, 500));
      return res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json({
        success: false,
        error: msg || "Error al llamar a Anthropic",
      });
    }

    const text = data.content?.find((b) => b.type === "text")?.text;
    if (!text) {
      console.error(LOG, "sin content text", JSON.stringify(data).slice(0, 300));
      return res.status(502).json({ success: false, error: "Respuesta vacía de Claude." });
    }

    let parsed;
    try {
      parsed = JSON.parse(stripJsonFence(text));
    } catch (e) {
      console.error(LOG, "JSON parse fallo", text.slice(0, 400));
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

    console.log(LOG, "éxito", { subjectLen: subject.length, bodyLen: bodyHtml.length });
    return res.status(200).json({ success: true, data: { subject, bodyHtml } });
  } catch (err) {
    console.error(LOG, "excepción", err?.stack || err?.message || err);
    return res.status(500).json({ success: false, error: err.message || "Error interno" });
  }
}
