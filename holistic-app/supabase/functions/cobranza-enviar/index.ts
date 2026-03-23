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
    const subject = String(row.asunto || "Recordatorio — Holistic Marketing");
    const html = String(row.cuerpo_html || "<p>(sin cuerpo)</p>");

    await adminClient.from("cobranza_bandeja").update({ estado: "sending", ultimo_error: null }).eq("id", id);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html }),
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
