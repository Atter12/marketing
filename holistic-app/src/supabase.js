import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storage: localStorage, detectSessionInUrl: true },
    })
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

/**
 * CDN de WhatsApp/Meta/Instagram suele responder 403 (o expira el enlace) al usarlo como <img src> fuera de su app.
 * En Crédito conviene subir la foto al bucket `avatars` (URL pública de Supabase) u otra URL estable.
 */
export function isLikelyBlockedAvatarHotlinkUrl(raw) {
  const u = String(raw || "").trim().replace(/&amp;/gi, "&");
  if (!u || /^data:/i.test(u)) return false;
  const lower = u.toLowerCase();
  if (!/^https?:\/\//i.test(u)) {
    return /whatsapp\.net|fbcdn\.net|cdninstagram\.com/i.test(lower);
  }
  try {
    const host = new URL(u).hostname.toLowerCase();
    if (host === "whatsapp.com" || host.endsWith(".whatsapp.net")) return true;
    if (host.endsWith("fbcdn.net") || host.includes("fbcdn.net")) return true;
    if (host.includes("cdninstagram.com")) return true;
    return false;
  } catch {
    return /whatsapp\.net|fbcdn\.net|cdninstagram\.com/i.test(lower);
  }
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

/** Convierte un valor de login a email: si es número de celular (solo dígitos/+) usa email sintético. */
export function loginToEmail(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 15) return digits + "@phone.holistic";
  return trimmed;
}

/** Solicita magic link para entrar al panel. Solo envía si el email está en gerentes o clientes_acceso. */
export async function solicitarMagicLink(email, options = {}) {
  if (!supabase) throw new Error("App no configurada");
  const e = String(email || "").trim();
  if (!e || !e.includes("@")) throw new Error("Indicá un correo válido.");
  const { data, error } = await supabase.functions.invoke("magic-link-login", {
    body: { email: e, redirect_to: options.redirect_to || null },
  });
  if (error) throw new Error(error.message || "Error al enviar el enlace");
  const body = data?.data ?? data;
  if (body?.error) throw new Error(body.error);
  return body;
}

/** Valida que el email pueda entrar (gerentes/clientes_acceso). Si ok, el cliente puede llamar signInWithOtp y luego verifyOtp. */
export async function solicitarCodigoLogin(email) {
  if (!supabase) throw new Error("App no configurada");
  const e = String(email || "").trim();
  if (!e || !e.includes("@")) throw new Error("Indicá un correo válido.");
  const { data, error } = await supabase.functions.invoke("magic-link-login", {
    body: { email: e, method: "code" },
  });
  if (error) throw new Error(error.message || "Error al verificar el correo");
  const body = data?.data ?? data;
  if (body?.error) throw new Error(body.error);
  return body;
}

/** Verifica el código de 6 dígitos enviado por Supabase (signInWithOtp) y crea la sesión. */
export async function verificarCodigoLogin(email, token) {
  if (!supabase) throw new Error("App no configurada");
  const e = String(email || "").trim();
  const t = String(token || "").trim().replace(/\s/g, "");
  if (!e || !e.includes("@")) throw new Error("Indicá un correo válido.");
  if (!t || t.length < 4) throw new Error("Ingresá el código que recibiste por correo.");
  const { data, error } = await supabase.auth.verifyOtp({ email: e, token: t, type: "email" });
  if (error) throw new Error(error.message || "Código inválido o expirado.");
  return data;
}

/** Da acceso al panel: envía un email al cliente (correo de la ficha) con un link mágico. Al abrirlo entra al panel.
 *  Opciones: { regenerate: true } para reenviar el link; { redirect_to: url } para la URL de redirección tras el login. */
export async function darAccesoCliente(clientId, options = {}) {
  if (!supabase || !clientId) throw new Error("Cliente no indicado");
  const { data, error } = await supabase.functions.invoke("dar-acceso-cliente", {
    body: { client_id: clientId, regenerate: !!options.regenerate, redirect_to: options.redirect_to || null },
  });
  if (error) throw new Error(error.message || "Error al dar acceso");
  const body = data?.data ?? data;
  if (body?.error) throw new Error(body.error);
  return body;
}

// ═══ Comprobantes (Cobros y Garantías) ═══
const ALLOWED_COMPROBANTE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_COMPROBANTE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Sube un comprobante de pago para un cobro. Devuelve la ruta a guardar en comprobante_urls. */
export async function uploadComprobanteCobro(cobroId, file) {
  if (!supabase || !cobroId) throw new Error("Configuración o cobro no disponible");
  if (!file || !ALLOWED_COMPROBANTE_TYPES.includes(file.type)) throw new Error("Archivo debe ser imagen (JPG, PNG, WebP, GIF) o PDF");
  if (file.size > MAX_COMPROBANTE_SIZE) throw new Error("El archivo no puede superar 10 MB");
  let ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  if (ext === "jpeg") ext = "jpg";
  const name = `${crypto.randomUUID()}.${ext}`;
  const path = `cobros/${cobroId}/${name}`;
  const { error } = await supabase.storage.from("comprobantes").upload(path, file, { upsert: false });
  if (error) throw new Error(error.message || "Error al subir el comprobante");
  return path;
}

/** Sube una imagen para una garantía. Devuelve la ruta a guardar en imagen_urls. */
export async function uploadComprobanteGarantia(garantiaId, file) {
  if (!supabase || !garantiaId) throw new Error("Configuración o garantía no disponible");
  if (!file || !ALLOWED_COMPROBANTE_TYPES.includes(file.type)) throw new Error("Archivo debe ser imagen (JPG, PNG, WebP, GIF) o PDF");
  if (file.size > MAX_COMPROBANTE_SIZE) throw new Error("El archivo no puede superar 10 MB");
  let ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  if (ext === "jpeg") ext = "jpg";
  const name = `${crypto.randomUUID()}.${ext}`;
  const path = `garantias/${garantiaId}/${name}`;
  const { error } = await supabase.storage.from("comprobantes").upload(path, file, { upsert: false });
  if (error) throw new Error(error.message || "Error al subir la imagen");
  return path;
}

/** Devuelve una URL firmada para ver un comprobante (bucket privado). path = ej. "cobros/uuid/archivo.jpg". */
export async function getComprobanteSignedUrl(path, expiresIn = 3600) {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}
