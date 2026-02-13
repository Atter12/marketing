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

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB

/** Sube una imagen como foto de perfil del cliente y devuelve la URL pública. clientId = uuid del cliente. */
export async function uploadAvatar(clientId, file) {
  if (!supabase || !clientId) throw new Error("Configuración o cliente no disponible");
  if (!file || !ALLOWED_AVATAR_TYPES.includes(file.type)) throw new Error("El archivo debe ser imagen (JPG, PNG, WebP o GIF)");
  if (file.size > MAX_AVATAR_SIZE) throw new Error("La imagen no puede superar 5 MB");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${clientId}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message || "Error al subir la imagen");
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
