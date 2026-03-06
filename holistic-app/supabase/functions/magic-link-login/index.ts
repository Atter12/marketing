// Edge Function: login por magic link o por código (OTP) para gerentes y clientes con acceso.
// method: "link" (default) → genera magic link y lo envía por Resend.
// method: "code" → solo valida que el email esté en gerentes/clientes_acceso; el cliente enviará el OTP con signInWithOtp.

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

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

async function sendEmailResend(to: string, actionLink: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY no configurado" };
  const from = Deno.env.get("RESEND_FROM") || "Holistic Marketing <onboarding@resend.dev>";
  const subject = "Tu enlace para entrar — Holistic Marketing";
  const html = `
    <p>Hola,</p>
    <p>Usá el siguiente enlace para entrar a tu panel (caduca en 1 hora):</p>
    <p style="margin: 24px 0;"><a href="${actionLink}" style="display: inline-block; padding: 12px 24px; background: #1b2559; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Entrar al panel</a></p>
    <p style="color: #666; font-size: 13px;">Si no pediste este enlace, podés ignorar este correo.</p>
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
    const rawEmail = body.email ?? body.e ?? "";
    const email = normalizeEmail(rawEmail);
    const method = (body.method ?? "link") === "code" ? "code" : "link";
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Indicá un correo válido." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuración del servidor incompleta" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // Solo permitir correos que están en gerentes o en clientes_acceso
    const { data: gerenteRow } = await supabase.from("gerentes").select("email").ilike("email", email).maybeSingle();
    const { data: accesoRow } = await supabase.from("clientes_acceso").select("email").ilike("email", email).maybeSingle();
    const allowed = !!(gerenteRow || accesoRow);

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Correo no registrado. Solo pueden entrar gerentes y clientes con acceso." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Si eligió código: solo validamos; el cliente enviará el OTP con signInWithOtp
    if (method === "code") {
      return new Response(
        JSON.stringify({ ok: true, use_otp: true, message: "Correo autorizado. Enviá el código desde la app." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // method === "link": generar magic link y enviar por Resend
    const row = gerenteRow || accesoRow!;
    const appUrl = body.redirect_to || getAppUrl();
    const redirectTo = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: row.email,
      options: { redirectTo },
    });
    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message || "Error al generar el link" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      return new Response(JSON.stringify({ error: "No se pudo generar el link" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sendResult = await sendEmailResend(row.email, actionLink);
    if (sendResult.ok) {
      return new Response(
        JSON.stringify({ ok: true, message: "Revisá tu correo. Abrí el enlace para entrar al panel." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const resendHint = /testing|resend\.dev|domain|verify/i.test(sendResult.error || "")
      ? " Con el dominio de prueba de Resend solo se puede enviar al correo de tu cuenta."
      : "";
    return new Response(
      JSON.stringify({ ok: true, message: "No se pudo enviar el correo (" + (sendResult.error || "") + ")." + resendHint, link: actionLink }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[magic-link-login]", e);
    return new Response(JSON.stringify({ error: e?.message || "Error interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
