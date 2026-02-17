// Edge Function: crea usuario en Auth (correo + PIN) y vincula en clientes_acceso.
// Solo debe ser invocada por el panel del gerente (verificar JWT de gerente en producción).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, pin, client_id: clientId } = await req.json();
    if (!email || typeof email !== "string" || !email.trim()) {
      return new Response(JSON.stringify({ error: "Correo obligatorio" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 12) {
      return new Response(JSON.stringify({ error: "El PIN debe tener entre 4 y 12 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
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

    const emailTrim = email.trim().toLowerCase();
    const password = String(pin);

    // Crear usuario en Auth o actualizar contraseña si ya existe
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: emailTrim,
      password,
      email_confirm: true,
    });
    if (createError) {
      const msg = createError.message || "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered") || createError.status === 422) {
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list?.users?.find((u) => u.email?.toLowerCase() === emailTrim);
        if (existing) {
          const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, { password });
          if (updateErr) return new Response(JSON.stringify({ error: updateErr.message || "Error al actualizar la contraseña" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else {
          return new Response(JSON.stringify({ error: "El correo ya está registrado. Use otro correo o contacte soporte." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        return new Response(JSON.stringify({ error: msg || "Error al crear el usuario" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (!createData?.user) {
      return new Response(JSON.stringify({ error: "No se pudo crear el usuario" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Vincular correo al cliente en clientes_acceso (upsert por email)
    const { error: upsertError } = await supabase.from("clientes_acceso").upsert(
      { email: emailTrim, client_id: clientId },
      { onConflict: "email" }
    );
    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message || "Error al vincular el acceso" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, message: "Acceso creado. El cliente puede entrar con su correo y PIN." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[dar-acceso-cliente]", e);
    return new Response(JSON.stringify({ error: e?.message || "Error interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
