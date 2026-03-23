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

/** Misma línea visual que acceso Crédito (Resend): marca Holistic + panel. */
function buildCobranzaEmail(opts: {
  innerHtml: string;
  brandName: string;
  panelUrl: string;
  plainBody: string;
}): { html: string; text: string } {
  const brand = escapeHtml(opts.brandName);
  const panel = opts.panelUrl.replace(/\/$/, "");
  const panelEsc = escapeHtml(panel);

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
          <div style="font-size:22px;font-weight:800;color:#ffffff;margin-top:10px;letter-spacing:-.03em;line-height:1.2;">${brand}</div>
          <div style="font-size:13px;color:rgba(255,255,255,.88);margin-top:8px;line-height:1.45;">Marketing digital · Gestión de cuentas</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 8px;color:#0f172a;font-size:15px;line-height:1.65;">
          ${opts.innerHtml || "<p>(sin contenido)</p>"}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 24px;">
          <div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);"></div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;">
          <p style="margin:0 0 14px;font-size:13px;color:#64748b;line-height:1.5;">¿Necesitás ver tu cuenta o subir un comprobante?</p>
          <a href="${panelEsc}" style="display:inline-block;padding:12px 22px;background:#1b2559;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Entrar al panel Crédito</a>
          <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">Si no reconocés este mensaje, podés ignorarlo o responder a este correo.</p>
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
    `${opts.brandName}\n\n` +
    `${opts.plainBody.trim()}\n\n` +
    `---\n` +
    `Entrar al panel Crédito: ${panel}\n` +
    `Si no reconocés este mensaje, podés ignorarlo.\n`;

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
    const panelUrl =
      (Deno.env.get("COBRANZA_PANEL_URL") || Deno.env.get("APP_URL") || Deno.env.get("PUBLIC_APP_URL") || "https://www.marketingconholistic.com/credito").trim();

    const subject = String(row.asunto || `Mensaje de ${brandName}`);
    const innerHtml = String(row.cuerpo_html || "<p>(sin cuerpo)</p>");
    const plainBody =
      (row.cuerpo_texto && String(row.cuerpo_texto).trim()) ||
      innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const { html, text } = buildCobranzaEmail({
      innerHtml,
      brandName,
      panelUrl,
      plainBody,
    });

    await adminClient.from("cobranza_bandeja").update({ estado: "sending", ultimo_error: null }).eq("id", id);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html, text }),
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
      detalle: { resend_id: resData?.id },
      actor_email: callerEmail,
    });

    return new Response(JSON.stringify({ ok: true, message: "Correo enviado." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[cobranza-enviar]", e);
    return new Response(JSON.stringify({ error: (e as Error)?.message || "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
