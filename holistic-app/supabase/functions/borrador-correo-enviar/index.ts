// Envía un correo formal genérico vía Resend. Solo gerentes autenticados (misma regla que cobranza-enviar).
// Secretos: mismos que cobranza-enviar (RESEND_* en Supabase). Sin duplicar en Vercel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, prefer",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
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

function normalizeSubject(raw: string, brandName: string): string {
  const base = String(raw || "").replace(/\s+/g, " ").trim();
  if (!base) return `Mensaje de ${brandName}`;
  // Evita asuntos ultra genéricos que suelen ir a promociones/spam.
  if (/^solicitud de contacto$/i.test(base)) return `${brandName} · Solicitud de contacto`;
  if (base.length > 160) return base.slice(0, 160).trim();
  return base;
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

/** Plantilla minimalista para maximizar entregabilidad (menos decoración HTML). */
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
  const logoBlock = logo ? `<p style="margin:0 0 12px;"><img src="${logo}" width="120" alt="${brand}" style="display:block;max-width:120px;height:auto;border:0;" /></p>` : "";
  const inner = opts.innerHtml || "<p>(sin contenido)</p>";

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:20px 10px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e6e8eb;">
      <tr>
        <td style="padding:22px 22px 8px;color:#1f2937;font-size:15px;line-height:1.6;">
          ${logoBlock}
          <p style="margin:0 0 10px;font-size:17px;font-weight:700;color:#111827;">${brand}</p>
          ${inner}
        </td>
      </tr>
      <tr>
        <td style="padding:10px 22px 22px;">
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0 12px;" />
          <p style="margin:0;font-size:13px;color:#4b5563;"><strong>${brand}</strong><br/>${taglineEsc}</p>
          <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">Este correo es transaccional.</p>
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

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
    const rawSubject = String(body.subject || "").trim();
    const message = String(body.body || "");

    if (!to || !EMAIL_RE.test(to)) {
      return new Response(JSON.stringify({ error: "Indica un correo de destinatario válido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!rawSubject || rawSubject.length > 500) {
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
      "https://www.hecom.club/credito-app/logo/logoh.png"
    ).trim();
    const logoUrl = safeHttpsUrl(logoRaw);
    const subject = normalizeSubject(rawSubject, brandName);
    const replyTo = String(Deno.env.get("RESEND_REPLY_TO") || "").trim();

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
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
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
