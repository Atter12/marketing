import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/** Devuelve true si el usuario logueado está en la tabla gerentes */
export async function isGerente() {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const { data, error } = await supabase.from("gerentes").select("email").ilike("email", user.email).maybeSingle();
  if (error) console.error("[isGerente]", error);
  return !error && data != null;
}

/** Devuelve el client_id (uuid) si el usuario es un cliente vinculado; si no, null */
export async function getClientIdForUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data, error } = await supabase.from("clientes_acceso").select("client_id").ilike("email", user.email).maybeSingle();
  if (error) console.error("[getClientIdForUser]", error);
  return data?.client_id ?? null;
}
