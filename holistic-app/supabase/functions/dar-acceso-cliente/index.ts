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
  return "https://www.marketingconholistic.com/credito";
}

async function sendEmailResend(to: string, actionLink: string, clientName: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY no configurado" };
  const from = Deno.env.get("RESEND_FROM") || "Holistic Marketing <onboarding@resend.dev>";
  const subject = "Acceso a tu panel — Holistic Marketing";
  const html = `
    <p>Hola${clientName ? ` ${clientName}` : ""},</p>
    <p>Te enviamos un nuevo enlace para entrar a tu panel. Haz clic abajo (el link caduca en 1 hora):</p>
    <p style="margin: 24px 0;"><a href="${actionLink}" style="display: inline-block; padding: 12px 24px; background: #1b2559; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Entrar al panel</a></p>
    <p style="color: #666; font-size: 13px;">Si no pediste este acceso, puedes ignorar este correo.</p>
  `;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html }),
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
