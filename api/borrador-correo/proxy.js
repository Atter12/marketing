/**
 * POST /api/borrador-correo/proxy
 * Reenvía al Edge Function de Supabase (mismo sitio = sin CORS en el navegador).
 *
 * Vercel env (mismo patrán que otras APIs, p. ej. cobranzaClaudeSuggest):
 *   PUBLIC_SUPABASE_URL  o  SUPABASE_URL
 *   PUBLIC_SUPABASE_ANON_KEY  o  SUPABASE_ANON_KEY
 *
 * GET: health y comprobación de config (abrir en el navegador).
 */

const FN_SLUG = "borrador-correo-enviar";
const LOG = "[borrador-correo/proxy]";

function baseUrl() {
  return (process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
}

function anonKey() {
  return (process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
}

function edgeUrl() {
  const b = baseUrl();
  if (!b) return "";
  return `${b}/functions/v1/${FN_SLUG}`;
}

function jsonWithCors(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const url = baseUrl();
    const key = !!anonKey();
    return jsonWithCors(res, 200, {
      ok: true,
      service: "borrador-correo-proxy",
      hasSupabaseUrl: !!url,
      hasAnonKey: key,
      edgeTarget: url ? edgeUrl() : null,
      hint: !url || !key
        ? "Definí PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY en Vercel (Settings → Environment Variables) y redeploy."
        : "Listo. El formulario de Borrador debería usar este proxy (mismo dominio) para evitar CORS con Supabase.",
    });
  }

  if (req.method !== "POST") {
    return jsonWithCors(res, 405, { ok: false, error: "Usá POST", step: "method" });
  }

  const target = edgeUrl();
  const akey = anonKey();
  if (!target || !akey) {
    console.error(LOG, "falta config");
    return jsonWithCors(res, 503, {
      ok: false,
      error:
        "El servidor (Vercel) no tiene PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY. Son las mismas de Supabase → Settings → API. Guardalas en el proyecto y redeploy.",
      step: "vercel_config",
    });
  }

  const auth = req.headers.authorization;
  if (!auth || !/^Bearer\s+\S+/i.test(String(auth))) {
    return jsonWithCors(res, 401, {
      ok: false,
      error: "Falta Authorization: iniciá sesión en Crédito y volvé a esta página.",
      step: "client_auth",
    });
  }

  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    return jsonWithCors(res, 400, {
      ok: false,
      error: "Cuerpo JSON inválido o vacío (to, subject, body).",
      step: "body",
    });
  }

  let edgeRes;
  try {
    edgeRes = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: String(auth).trim(),
        apikey: akey,
      },
      body: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
      }),
    });
  } catch (e) {
    console.error(LOG, "fetch error", e?.message || e);
    return jsonWithCors(res, 502, {
      ok: false,
      error: "No se pudo contactar a Supabase desde el proxy: " + (e?.message || String(e)),
      step: "edge_fetch",
      target,
    });
  }

  const text = await edgeRes.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 500) };
  }

  if (!edgeRes.ok) {
    const msg = data.error || data.message || data.raw || text || edgeRes.statusText;
    console.warn(LOG, "edge no OK", edgeRes.status, String(msg).slice(0, 200));
    return jsonWithCors(res, edgeRes.status >= 400 && edgeRes.status < 600 ? edgeRes.status : 502, {
      ok: false,
      error: typeof msg === "string" ? msg : JSON.stringify(msg),
      step: "supabase_function",
      edgeStatus: edgeRes.status,
      edgeSlug: FN_SLUG,
    });
  }

  if (data.ok) {
    return jsonWithCors(res, 200, {
      ok: true,
      message: data.message || "Correo enviado.",
      id: data.id || null,
    });
  }

  return jsonWithCors(res, 200, {
    ok: data.ok,
    error: data.error,
    id: data.id,
    message: data.message,
    step: "edge_response",
  });
}
