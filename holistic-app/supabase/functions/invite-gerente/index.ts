// Invitación por correo (Supabase Auth) para un email ya dado de alta en public.gerentes.
// Solo puede invocarla un gerente con perm_admin. Requiere SUPABASE_SERVICE_ROLE_KEY en secrets.
//
// Si existe RESEND_API_KEY: se genera el link con admin.generateLink (invite) y el correo lo envía
// Resend con texto en español y branding Holistic (no el template inglés de Supabase).
// Sin Resend: se usa inviteUserByEmail (personalizá el template en Supabase → Authentication → Email).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function escapeHtmlAttr(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendInviteEmailResend(
  to: string,
  actionLink: string,
  opts: { alreadyHadAccount: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY no configurado" };
  const from = Deno.env.get("RESEND_FROM") || "Holistic Marketing <onboarding@resend.dev>";
  const subject = opts.alreadyHadAccount
    ? "Acceso a Pendientes — Holistic Marketing"
    : "Invitación a Pendientes — Holistic Marketing";
  const bodyIntro = opts.alreadyHadAccount
    ? "<p>Hola,</p><p>Tu correo ya tiene cuenta en el sistema. Podés usar este enlace para entrar a <strong>Pendientes</strong> (caduca en 1 hora):</p>"
    : "<p>Hola,</p><p>Te invitaron a unirte al equipo en <strong>Pendientes</strong> (Holistic Marketing). Hacé clic en el botón para crear tu acceso y definir tu contraseña:</p>";
  const cta = opts.alreadyHadAccount ? "Entrar a Pendientes" : "Aceptar invitación";
  const safeHref = escapeHtmlAttr(actionLink);
  const html = `
    ${bodyIntro}
    <p style="margin: 24px 0;"><a href="${safeHref}" style="display: inline-block; padding: 12px 24px; background: #1b2559; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">${cta}</a></p>
    <p style="color: #666; font-size: 13px;">Si no esperabas este correo, podés ignorarlo.</p>
    <p style="color: #999; font-size: 12px; margin-top: 24px;">— Equipo Holistic Marketing</p>
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

    const { data: callerRow, error: callerErr } = await adminClient
      .from("gerentes")
      .select("perm_admin")
      .eq("email", callerEmail)
      .maybeSingle();

    if (callerErr || !callerRow?.perm_admin) {
      return new Response(JSON.stringify({ error: "Solo un administrador puede enviar invitaciones." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const inviteEmail = normalizeEmail(body.email ?? "");
    if (!inviteEmail || !inviteEmail.includes("@")) {
      return new Response(JSON.stringify({ error: "Indica un correo válido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: target } = await adminClient.from("gerentes").select("email").eq("email", inviteEmail).maybeSingle();
    if (!target) {
      return new Response(JSON.stringify({ error: "Ese correo no está en gerentes. Regístralo primero desde Pendientes." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectRaw = typeof body.redirect_to === "string" ? body.redirect_to.trim() : "";
    const fallback = Deno.env.get("INVITE_REDIRECT_URL") || "https://www.marketingconholistic.com/pendientes/tarea.html";
    const redirectTo = redirectRaw.startsWith("http") ? redirectRaw : fallback;

    const useResend = !!Deno.env.get("RESEND_API_KEY");

    if (useResend) {
      const { data: inviteLinkData, error: inviteLinkErr } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email: inviteEmail,
        options: { redirectTo },
      });

      let actionLink = inviteLinkData?.properties?.action_link as string | undefined;
      let alreadyHadAccount = false;

      if (inviteLinkErr || !actionLink) {
        const msg = inviteLinkErr?.message || "";
        const already = /already|registered|duplicate|exists|422/i.test(msg);
        if (already) {
          const { data: magicData, error: magicErr } = await adminClient.auth.admin.generateLink({
            type: "magiclink",
            email: inviteEmail,
            options: { redirectTo },
          });
          if (magicErr || !magicData?.properties?.action_link) {
            return new Response(
              JSON.stringify({
                error: magicErr?.message || msg || "No se pudo generar el enlace.",
                hint: "El usuario puede que ya exista en Auth. Puede usar «Olvidé mi contraseña» o el acceso por magic link.",
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          actionLink = magicData.properties.action_link;
          alreadyHadAccount = true;
        } else {
          return new Response(
            JSON.stringify({
              error: msg || "No se pudo generar la invitación.",
              hint: "Revisá logs de la función y configuración de Auth en Supabase.",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      const sendResult = await sendInviteEmailResend(inviteEmail, actionLink, { alreadyHadAccount });
      if (sendResult.ok) {
        return new Response(
          JSON.stringify({
            ok: true,
            message: alreadyHadAccount
              ? "Ese correo ya tenía cuenta: se envió un enlace para entrar a Pendientes."
              : "Invitación enviada al correo (mensaje en español).",
            alreadyHadAccount,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const resendHint = /testing|resend\.dev|domain|verify/i.test(sendResult.error || "")
        ? " Con Resend de prueba solo podés enviar al correo de tu cuenta; verificá un dominio y RESEND_FROM para producción."
        : "";
      return new Response(
        JSON.stringify({
          ok: true,
          message: `No se pudo enviar el correo automáticamente (${sendResult.error || "Resend"}).${resendHint} Compartí el enlace manualmente si hace falta.`,
          link: actionLink,
          alreadyHadAccount,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(inviteEmail, {
      redirectTo,
    });

    if (inviteErr) {
      const msg = inviteErr.message || String(inviteErr);
      const already = /already|registered|exists/i.test(msg);
      return new Response(
        JSON.stringify({
          error: msg,
          hint: already
            ? "El usuario puede que ya exista en Auth. Puede usar «Olvidé mi contraseña» o un magic link desde Crédito."
            : "Revisa plantillas de correo y SMTP en Supabase (Authentication → Email).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, message: "Invitación enviada al correo." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[invite-gerente]", e);
    return new Response(JSON.stringify({ error: (e as Error)?.message || "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
