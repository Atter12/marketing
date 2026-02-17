// Edge Function: da acceso al cliente usando su número de teléfono (como está en la ficha)
// y genera una contraseña aleatoria. Crea usuario en Auth con email sintético y vincula en clientes_acceso.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHONE_SUFFIX = "@phone.holistic";

function normalizePhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits;
}

function syntheticEmail(phone: string): string {
  return normalizePhone(phone) + PHONE_SUFFIX;
}

function generatePassword(length = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
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

    const { data: clientRow, error: clientError } = await supabase.from("clientes").select("phones, name").eq("id", clientId).single();
    if (clientError || !clientRow) {
      return new Response(JSON.stringify({ error: "Cliente no encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const phones = Array.isArray(clientRow.phones) ? clientRow.phones : (clientRow.phones ? [clientRow.phones] : []);
    const firstPhone = phones.map((p: string) => String(p || "").trim()).find((p: string) => p.length > 0);
    if (!firstPhone) {
      return new Response(JSON.stringify({ error: "El cliente no tiene teléfono registrado. Agrega al menos uno en Editar cliente." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const normalized = normalizePhone(firstPhone);
    if (normalized.length < 8) {
      return new Response(JSON.stringify({ error: "El número de teléfono no es válido (mínimo 8 dígitos)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailAuth = syntheticEmail(firstPhone);
    const password = generatePassword(8);

    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: emailAuth,
      password,
      email_confirm: true,
    });
    if (createError) {
      const msg = createError.message || "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered") || createError.status === 422) {
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list?.users?.find((u) => u.email?.toLowerCase() === emailAuth);
        if (existing) {
          if (regenerate) {
            const newPassword = generatePassword(8);
            const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, { password: newPassword });
            if (updateErr) {
              return new Response(JSON.stringify({ error: updateErr.message || "Error al actualizar la contraseña" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            const { error: upsertErr } = await supabase.from("clientes_acceso").upsert(
              { email: emailAuth, client_id: clientId },
              { onConflict: "email" }
            );
            if (upsertErr) {
              return new Response(JSON.stringify({ error: upsertErr.message || "Error al vincular" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(
              JSON.stringify({ ok: true, phone: firstPhone, password: newPassword, regenerated: true }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({ ok: true, alreadyHadAccess: true, phone: firstPhone }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ error: "El número ya está registrado. Contacte soporte." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: msg || "Error al crear el usuario" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (!createData?.user) {
      return new Response(JSON.stringify({ error: "No se pudo crear el usuario" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: upsertError } = await supabase.from("clientes_acceso").upsert(
      { email: emailAuth, client_id: clientId },
      { onConflict: "email" }
    );
    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message || "Error al vincular el acceso" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        phone: firstPhone,
        password,
        message: "Comparte con el cliente: número y contraseña para que entre al panel.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[dar-acceso-cliente]", e);
    return new Response(JSON.stringify({ error: e?.message || "Error interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
