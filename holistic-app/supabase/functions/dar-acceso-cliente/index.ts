// Edge Function: da acceso al cliente enviando un email con link mágico (magic link).
// Usa el correo del cliente (ficha). Genera el link con Supabase Auth y lo envía por Resend.

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
  if (!apiKey) {
    console.warn("[dar-acceso-cliente] RESEND_API_KEY no configurado; no se envía email.");
    return { ok: false, error: "RESEND_API_KEY no configurado" };
  }
  const from = Deno.env.get("RESEND_FROM") || "Holistic Marketing <onboarding@resend.dev>";
  const subject = "Acceso a tu panel — Holistic Marketing";
  const html = `
    <p>Hola${clientName ? ` ${clientName}` : ""},</p>
    <p>Te enviamos un enlace para entrar a tu panel de Holistic Marketing. Haz clic abajo (el link caduca en 1 hora):</p>
    <p style="margin: 24px 0;"><a href="${actionLink}" style="display: inline-block; padding: 12px 24px; background: #1b2559; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Entrar al panel</a></p>
    <p style="color: #666; font-size: 13px;">Si no pediste este acceso, puedes ignorar este correo.</p>
  `;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.message || data?.error || res.statusText;
    console.error("[dar-acceso-cliente] Resend error:", err);
    return { ok: false, error: err };
  }
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

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: firstEmail,
      options: { redirectTo },
    });

    if (linkError) {
      const msg = linkError.message || "";
      if (msg.toLowerCase().includes("already") || linkError.status === 422) {
        if (regenerate) {
          const { data: linkData2, error: linkError2 } = await supabase.auth.admin.generateLink({
            type: "magiclink",
            email: firstEmail,
            options: { redirectTo },
          });
          if (linkError2) {
            return new Response(JSON.stringify({ error: linkError2.message || "Error al generar el link" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const actionLink = linkData2?.properties?.action_link;
          if (!actionLink) {
            return new Response(JSON.stringify({ error: "No se pudo generar el link" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const { error: upsertErr } = await supabase.from("clientes_acceso").upsert(
            { email: firstEmail, client_id: clientId, pin: null },
            { onConflict: "email" }
          );
          if (upsertErr) {
            return new Response(JSON.stringify({ error: upsertErr.message || "Error al vincular" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const sendResult = await sendEmailResend(firstEmail, actionLink, clientRow.name);
          if (sendResult.ok) {
            return new Response(
              JSON.stringify({ ok: true, email: firstEmail, message: "Se reenvió el correo con el link de acceso.", alreadyHadAccess: true }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({ ok: true, email: firstEmail, message: "Link generado. No se pudo enviar el email; copia el link y compártelo con el cliente.", link: actionLink, alreadyHadAccess: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data: accesoRow } = await supabase.from("clientes_acceso").select("email").eq("email", firstEmail).maybeSingle();
        if (accesoRow) {
          return new Response(
            JSON.stringify({ ok: true, alreadyHadAccess: true, email: firstEmail, message: "Este cliente ya tiene acceso. Usa «Reenviar link» para enviar de nuevo el correo." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      return new Response(JSON.stringify({ error: msg || "Error al generar el link" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      return new Response(JSON.stringify({ error: "No se pudo generar el link" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: upsertError } = await supabase.from("clientes_acceso").upsert(
      { email: firstEmail, client_id: clientId, pin: null },
      { onConflict: "email" }
    );
    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message || "Error al vincular el acceso" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sendResult = await sendEmailResend(firstEmail, actionLink, clientRow.name);
    if (sendResult.ok) {
      return new Response(
        JSON.stringify({ ok: true, email: firstEmail, message: "Se envió un correo al cliente con el link de acceso. Debe abrirlo para entrar al panel." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        email: firstEmail,
        message: "Link generado. No se pudo enviar el email automáticamente; copia el link y compártelo con el cliente (por WhatsApp, etc.).",
        link: actionLink,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[dar-acceso-cliente]", e);
    return new Response(JSON.stringify({ error: e?.message || "Error interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
