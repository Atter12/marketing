// Edge Function: da acceso al cliente enviando un email con link (magic link).
// Nuevos: Supabase inviteUserByEmail (sin API key). Ya existentes: generateLink + envío por Resend si hay RESEND_API_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getAppUrl(): string {
  const url = Deno.env.get("APP_URL") || Deno.env.get("PUBLIC_APP_URL") || "";
  if (url) return url.replace(/\/$/, "");
  return "https://www.hecom.club/credito";
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escHref(u: string): string {
  return String(u || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Misma plantilla visual que cobranza-enviar (marca Holistic + botón principal). */
function buildAccesoPanelEmail(opts: { actionLink: string; clientName: string; brandName: string; panelUrl: string }): { html: string; text: string } {
  const brand = escapeHtml(opts.brandName);
  const href = escHref(opts.actionLink);
  const panel = escHref(opts.panelUrl);
  const hola = opts.clientName ? `Hola <strong>${escapeHtml(opts.clientName)}</strong>,` : "Hola,";
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 14px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,.08);border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:26px 28px;background:linear-gradient(135deg,#1b2559 0%,#2d3a6e 100%);">
          <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.72);font-weight:600;">Acceso seguro</div>
          <div style="font-size:22px;font-weight:800;color:#ffffff;margin-top:10px;letter-spacing:-.03em;line-height:1.2;">${brand}</div>
          <div style="font-size:13px;color:rgba(255,255,255,.88);margin-top:8px;line-height:1.45;">Panel Crédito · Tu cuenta</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 8px;color:#0f172a;font-size:15px;line-height:1.65;">
          <p style="margin:0 0 14px;">${hola}</p>
          <p style="margin:0 0 20px;color:#475569;">Te enviamos un enlace para entrar a tu panel. El link <strong>caduca en 1 hora</strong>.</p>
          <p style="margin:0 0 24px;text-align:center;">
            <a href="${href}" style="display:inline-block;padding:14px 28px;background:#1b2559;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Entrar al panel Crédito</a>
          </p>
          <p style="margin:0;font-size:13px;color:#64748b;">Si no pediste este acceso, podés ignorar este correo.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">También podés abrir el panel desde: <a href="${panel}" style="color:#2563eb;">${escapeHtml(opts.panelUrl)}</a></p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;text-align:center;">© ${brand} · Correo transaccional</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
  const text =
    `${opts.brandName}\n\n` +
    `Hola${opts.clientName ? ` ${opts.clientName}` : ""},\n\n` +
    `Enlace para entrar (1 hora): ${opts.actionLink}\n\n` +
    `Panel: ${opts.panelUrl}\n` +
    `Si no pediste este acceso, ignorá este mensaje.\n`;
  return { html, text };
}

async function sendEmailResend(to: string, actionLink: string, clientName: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY no configurado" };
  const from = Deno.env.get("RESEND_FROM") || "Holistic Marketing <onboarding@resend.dev>";
  const brandName = (Deno.env.get("EMAIL_BRAND_NAME") || Deno.env.get("COBRANZA_BRAND_NAME") || "Holistic Marketing").trim();
  const panelUrl = getAppUrl();
  const subject = `Acceso a tu panel — ${brandName}`;
  const { html, text } = buildAccesoPanelEmail({
    actionLink,
    clientName: clientName || "",
    brandName,
    panelUrl,
  });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.message || data?.error || res.statusText };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const clientId = body.client_id ?? body.clientId;
    const regenerate = !!body.regenerate;
    if (!clientId || typeof clientId !== "string") {
      return new Response(JSON.stringify({ error: "ID de cliente obligatorio" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuración del servidor incompleta" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: clientRow, error: clientError } = await supabase.from("clientes").select("emails, name").eq("id", clientId).single();
    if (clientError || !clientRow) {
      return new Response(JSON.stringify({ error: "Cliente no encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emails = Array.isArray(clientRow.emails) ? clientRow.emails : (clientRow.emails ? [clientRow.emails] : []);
    const firstEmail = emails.map((e: string) => String(e || "").trim()).find((e: string) => e.length > 0 && e.includes("@"));
    if (!firstEmail) {
      return new Response(JSON.stringify({ error: "El cliente no tiene correo registrado. Agrega al menos uno en Editar cliente." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const appUrl = body.redirect_to || getAppUrl();
    const redirectTo = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;

    const { error: upsertError } = await supabase.from("clientes_acceso").upsert(
      { email: firstEmail, client_id: clientId, pin: null },
      { onConflict: "email" }
    );
    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message || "Error al vincular el acceso" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(firstEmail, {
      redirectTo,
      data: { client_id: clientId },
    });

    if (!inviteError) {
      return new Response(
        JSON.stringify({ ok: true, email: firstEmail, message: "Se envió un correo al cliente con el link de acceso. Debe abrirlo para entrar al panel." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const msg = inviteError.message || "";
    const alreadyExists = /already|registered|duplicate|exists|422/i.test(msg);

    if (alreadyExists) {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: firstEmail,
        options: { redirectTo },
      });
      if (linkError) {
        return new Response(JSON.stringify({ error: linkError.message || "Error al generar el link" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const actionLink = linkData?.properties?.action_link;
      if (!actionLink) {
        return new Response(JSON.stringify({ error: "No se pudo generar el link" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sendResult = await sendEmailResend(firstEmail, actionLink, clientRow.name);
      if (sendResult.ok) {
        return new Response(
          JSON.stringify({ ok: true, email: firstEmail, message: "Se reenvió el correo al cliente con el nuevo link de acceso. Debe abrirlo para entrar al panel.", alreadyHadAccess: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const resendHint = /testing|resend\.dev|domain|verify/i.test(sendResult.error || "")
        ? " Con el dominio de prueba (onboarding@resend.dev) Resend solo permite enviar al correo de tu cuenta. Para enviar a clientes: verifica un dominio en resend.com y en Supabase añade el secret RESEND_FROM (ej. Holistic <noreply@tudominio.com>)."
        : "";
      return new Response(
        JSON.stringify({
          ok: true,
          email: firstEmail,
          message: "No se pudo enviar el correo automáticamente (" + (sendResult.error || "error de Resend") + ")." + resendHint + " Copia el link de abajo y compártelo con el cliente (WhatsApp, etc.).",
          link: actionLink,
          alreadyHadAccess: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: msg || "Error al enviar la invitación" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[dar-acceso-cliente]", e);
    return new Response(JSON.stringify({ error: e?.message || "Error interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
