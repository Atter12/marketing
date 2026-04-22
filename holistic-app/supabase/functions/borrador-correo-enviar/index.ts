// Envía un correo formal genérico vía Resend. Solo gerentes autenticados (misma regla que cobranza-enviar).
// Secretos: mismos que cobranza-enviar (RESEND_* en Supabase). Sin duplicar en Vercel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHttpsUrl(raw: string | undefined): string | null {
  const u = String(raw || "").trim();
  if (!u || !/^https:\/\//i.test(u)) return null;
  return u;
}

/** Texto plano del formulario → HTML seguro (párrafos + br). */
function plainToInnerHtml(text: string): string {
  const t = String(text || "").trim();
  if (!t) return "<p>(sin contenido)</p>";
  const esc = escapeHtml(t);
  return esc
    .split(/\n\n+/)
    .map((block) => `<p style="margin:0 0 12px;">${block.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/**
 * Misma plantilla que cobranza-enviar (cobranzaEmailLayout); solo cambia el texto del bloque intermedio
 * bajo Firma para indicar el origen de la herramienta.
 */
function buildBorradorEmail(opts: {
  innerHtml: string;
  brandName: string;
  plainBody: string;
  logoUrl: string | null;
  tagline: string;
}): { html: string; text: string } {
  const brand = escapeHtml(opts.brandName);
  const taglineEsc = escapeHtml(opts.tagline);
  const logo = opts.logoUrl ? escapeHtml(opts.logoUrl) : "";
  const logoBlock = logo
    ? `<img src="${logo}" width="140" alt="${brand}" style="display:block;max-width:140px;height:auto;border:0;margin:0 0 12px 0;" />`
    : "";
  const headerInner = logo
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:12px;width:100%;"><tr><td style="vertical-align:middle;padding-right:16px;width:1%;"><img src="${logo}" width="120" alt="" style="display:block;max-width:120px;height:auto;border:0;" /></td><td style="vertical-align:middle;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.03em;line-height:1.2;">${brand}</div>
          <div style="font-size:13px;color:rgba(255,255,255,.88);margin-top:8px;line-height:1.45;">${taglineEsc}</div>
        </td></tr></table>`
    : `<div style="font-size:22px;font-weight:800;color:#ffffff;margin-top:10px;letter-spacing:-.03em;line-height:1.2;">${brand}</div>
          <div style="font-size:13px;color:rgba(255,255,255,.88);margin-top:8px;line-height:1.45;">${taglineEsc}</div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 14px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,.08);border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:26px 28px;background:linear-gradient(135deg,#1b2559 0%,#2d3a6e 100%);">
          <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.72);font-weight:600;">Comunicación oficial</div>
          ${headerInner}
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 8px;color:#0f172a;font-size:15px;line-height:1.65;">
          ${opts.innerHtml || "<p>(sin contenido)</p>"}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 20px;">
          <div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);"></div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;background:#fafafa;padding:18px 20px;">
            <tr><td>
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">Firma</p>
              ${logoBlock}
              <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">${brand}</p>
              <p style="margin:6px 0 0;font-size:13px;color:#64748b;line-height:1.5;">${taglineEsc}</p>
              <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;line-height:1.45;">Correo enviado de forma segura desde la herramienta Borrador correo formal (mismo canal que cobranza).</p>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;text-align:center;">© ${brand} · Este correo es transaccional.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const plain = opts.plainBody.trim();
  const text =
    `${opts.brandName}\n${opts.tagline}\n\n` +
    `${plain}\n\n` +
    `---\n` +
    `${opts.brandName}\n` +
    `${opts.tagline}\n`;

  return { html, text };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Falta sesión (Authorization)." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuración del servidor incompleta." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user?.email) {
      return new Response(JSON.stringify({ error: "Sesión no válida." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerEmail = normalizeEmail(user.email);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: gerenteRow } = await adminClient.from("gerentes").select("email").ilike("email", callerEmail).maybeSingle();
    if (!gerenteRow) {
      return new Response(JSON.stringify({ error: "Solo gerentes pueden enviar desde esta herramienta." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const to = normalizeEmail(String(body.to || ""));
    const subject = String(body.subject || "").trim();
    const message = String(body.body || "");

    if (!to || !EMAIL_RE.test(to)) {
      return new Response(JSON.stringify({ error: "Indica un correo de destinatario válido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!subject || subject.length > 500) {
      return new Response(JSON.stringify({ error: "El asunto es obligatorio (máx. 500 caracteres)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.length > 50000) {
      return new Response(JSON.stringify({ error: "El mensaje es demasiado largo." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "RESEND_API_KEY no configurado (Supabase secrets). Igual que cobranza-enviar.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const from = Deno.env.get("RESEND_FROM") || "Holistic Marketing <onboarding@resend.dev>";
    const brandName = (Deno.env.get("COBRANZA_BRAND_NAME") || Deno.env.get("EMAIL_BRAND_NAME") || "Holistic Marketing").trim();
    const tagline = (
      Deno.env.get("COBRANZA_TAGLINE") ||
      Deno.env.get("EMAIL_TAGLINE") ||
      "Marketing digital · Gestión de cuentas"
    ).trim();
    const logoRaw = (
      Deno.env.get("COBRANZA_LOGO_URL") ||
      Deno.env.get("EMAIL_LOGO_URL") ||
      "https://www.marketingconholistic.com/credito-app/logo/logoh.png"
    ).trim();
    const logoUrl = safeHttpsUrl(logoRaw);

    const innerHtml = plainToInnerHtml(message);
    const { html, text } = buildBorradorEmail({
      innerHtml,
      brandName,
      plainBody: message,
      logoUrl,
      tagline,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = resData?.message || resData?.error || res.statusText;
      return new Response(JSON.stringify({ error: String(msg) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Correo enviado.",
        id: resData?.id ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[borrador-correo-enviar]", e);
    return new Response(JSON.stringify({ error: (e as Error)?.message || "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
