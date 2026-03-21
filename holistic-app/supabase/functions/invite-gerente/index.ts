// Invitación por correo (Supabase Auth) para un email ya dado de alta en public.gerentes.
// Solo puede invocarla un gerente con perm_admin. Requiere SUPABASE_SERVICE_ROLE_KEY en secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
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
      return new Response(JSON.stringify({ error: "Ese correo no está en gerentes. Regístralo primero desde Tareas." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectRaw = typeof body.redirect_to === "string" ? body.redirect_to.trim() : "";
    const fallback = Deno.env.get("INVITE_REDIRECT_URL") || "https://www.marketingconholistic.com/tareas/tarea.html";
    const redirectTo = redirectRaw.startsWith("http") ? redirectRaw : fallback;

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
