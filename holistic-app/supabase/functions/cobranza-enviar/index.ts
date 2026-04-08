// Envía un correo de cobranza aprobado vía Resend. Solo gerentes autenticados.
// Body: { id: uuid del registro en cobranza_bandeja, force?: boolean } (force ignora ventana 24h)

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

/** Solo URLs https para <img> (evita javascript: en src). */
function safeHttpsUrl(raw: string | undefined): string | null {
  const u = String(raw || "").trim();
  if (!u || !/^https:\/\//i.test(u)) return null;
  return u;
}

/** Misma línea visual que acceso Crédito (Resend): marca Holistic + firma con logo + panel.
 *  Mantener HTML alineado con holistic-app/src/cobranzaEmailLayout.js (vista previa en Cobranza). */
function buildCobranzaEmail(opts: {
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
              <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;line-height:1.45;">Correo enviado de forma segura desde el panel Crédito.</p>
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

  const text =
    `${opts.brandName}\n${opts.tagline}\n\n` +
    `${opts.plainBody.trim()}\n\n` +
    `---\n` +
    `${opts.brandName}\n` +
    `${opts.tagline}\n`;

  return { html, text };
}

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
      return new Response(JSON.stringify({ error: "Solo gerentes pueden enviar cobranzas." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const id = body.id;
    const force = !!body.force;
    if (!id || typeof id !== "string") {
      return new Response(JSON.stringify({ error: "Falta id del correo (cobranza_bandeja)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: row, error: rowErr } = await adminClient.from("cobranza_bandeja").select("*").eq("id", id).maybeSingle();
    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "Registro no encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.estado !== "approved" && row.estado !== "failed") {
      return new Response(
        JSON.stringify({ error: "Solo se pueden enviar correos aprobados (o reintentar fallidos)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const to = normalizeEmail(row.email_destino);
    if (!to.includes("@")) {
      return new Response(JSON.stringify({ error: "Email destino inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /** Pruebas: si está definido, el correo llega a esta bandeja pero el cuerpo sigue siendo el del borrador (firma igual). Quitar el secret en producción. */
    const redirectRaw = String(Deno.env.get("COBRANZA_REDIRECT_TO_EMAIL") || "").trim();
    const redirectTo = normalizeEmail(redirectRaw);
    const resendTo = redirectTo.includes("@") ? redirectTo : to;
    const subjectRedirectNote =
      resendTo !== to ? `[Prueba · iba a: ${to}] ` : "";

    if (!force) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      let q = adminClient
        .from("cobranza_bandeja")
        .select("id", { count: "exact", head: true })
        .eq("email_destino", to)
        .eq("estado", "sent")
        .gte("enviado_at", since);
      if (row.client_id) q = q.eq("client_id", row.client_id);
      const { count, error: cErr } = await q;
      if (cErr) console.warn("[cobranza-enviar] duplicate check", cErr);
      if ((count ?? 0) > 0) {
        return new Response(
          JSON.stringify({
            error: "Ya se envió un correo a este destino en las últimas 24h. Usá force:true para forzar.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "RESEND_API_KEY no configurado en el proyecto. Usá «Marcar enviado» desde la app o configurá Resend.",
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

    const subject = subjectRedirectNote + String(row.asunto || `Mensaje de ${brandName}`);
    const innerHtml = String(row.cuerpo_html || "<p>(sin cuerpo)</p>");
    const plainBody =
      (row.cuerpo_texto && String(row.cuerpo_texto).trim()) ||
      innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const { html, text } = buildCobranzaEmail({
      innerHtml,
      brandName,
      plainBody,
      logoUrl,
      tagline,
    });

    await adminClient.from("cobranza_bandeja").update({ estado: "sending", ultimo_error: null }).eq("id", id);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: resendTo, subject, html, text }),
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = resData?.message || resData?.error || res.statusText;
      await adminClient
        .from("cobranza_bandeja")
        .update({ estado: "failed", ultimo_error: msg, intentos: (row.intentos || 0) + 1 })
        .eq("id", id);
      await adminClient.from("cobranza_eventos").insert({
        correo_id: id,
        evento: "error_envio",
        detalle: { message: msg },
        actor_email: callerEmail,
      });
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient
      .from("cobranza_bandeja")
      .update({
        estado: "sent",
        enviado_at: new Date().toISOString(),
        ultimo_error: null,
        intentos: (row.intentos || 0) + 1,
      })
      .eq("id", id);

    await adminClient.from("cobranza_eventos").insert({
      correo_id: id,
      evento: "enviado_resend",
      detalle: {
        resend_id: resData?.id,
        ...(resendTo !== to ? { destino_original: to, entregado_en: resendTo, modo_prueba_redirect: true } : {}),
      },
      actor_email: callerEmail,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Correo enviado.",
        ...(resendTo !== to ? { entregado_en: resendTo, destino_registro: to } : {}),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[cobranza-enviar]", e);
    return new Response(JSON.stringify({ error: (e as Error)?.message || "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
