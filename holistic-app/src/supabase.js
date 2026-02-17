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
  // Añadir timestamp para que al cambiar la foto el navegador cargue la nueva (misma URL, archivo reemplazado = caché)
  const sep = data.publicUrl.includes("?") ? "&" : "?";
  return data.publicUrl + sep + "t=" + Date.now();
}

/** Slug para path de storage del gerente (email estable) */
function gerenteSlug(email) {
  if (!email || typeof email !== "string") return "gerente";
  return "gerente_" + email.trim().toLowerCase().replace(/@/g, "_at_").replace(/\./g, "_");
}

/** Sube la foto de perfil del gerente y devuelve la URL pública. email = correo del gerente. */
export async function uploadGerenteAvatar(email, file) {
  if (!supabase || !email) throw new Error("Configuración o correo no disponible");
  if (!file || !ALLOWED_AVATAR_TYPES.includes(file.type)) throw new Error("El archivo debe ser imagen (JPG, PNG, WebP o GIF)");
  if (file.size > MAX_AVATAR_SIZE) throw new Error("La imagen no puede superar 5 MB");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${gerenteSlug(email)}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message || "Error al subir la imagen");
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const sep = data.publicUrl.includes("?") ? "&" : "?";
  return data.publicUrl + sep + "t=" + Date.now();
}

/** Obtiene el perfil del gerente (id, avatar_url) por email. */
export async function getGerenteProfile(email) {
  if (!supabase || !email) return { id: null, avatar_url: null };
  const { data, error } = await supabase.from("gerentes").select("id, avatar_url").ilike("email", email).maybeSingle();
  if (error) {
    console.error("[getGerenteProfile]", error);
    return { id: null, avatar_url: null };
  }
  return { id: data?.id ?? null, avatar_url: data?.avatar_url ?? null };
}

/** Actualiza la foto de perfil del gerente por email (busca por email y actualiza por id si existe). */
export async function updateGerenteAvatar(email, avatarUrl) {
  if (!supabase || !email) throw new Error("Configuración o correo no disponible");
  const { data: row } = await supabase.from("gerentes").select("id").ilike("email", email).maybeSingle();
  if (row?.id) {
    const { error } = await supabase.from("gerentes").update({ avatar_url: avatarUrl || null }).eq("id", row.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("gerentes").update({ avatar_url: avatarUrl || null }).eq("email", email);
    if (error) throw error;
  }
}
