import { isAuthBootstrapDebugEnabled, maskLocationHashForLog } from "./authDebug.js";

/**
 * Handoff mismo-navegador (ej. hecom.club → marketing): fragmento tipo implicit grant
 * (#access_token=…&refresh_token=…). Debe ejecutarse después de createClient y antes de montar React,
 * para que localStorage tenga sesión antes de AuthGate. detectSessionInUrl está en false en supabase.js
 * para que GoTrue no compita leyendo el mismo # en initialize().
 */
export async function consumeAuthHashIfPresent(client) {
  if (typeof window === "undefined" || !client) return;
  const raw = window.location.hash || "";
  const dbg = isAuthBootstrapDebugEnabled();

  if (dbg) {
    console.log("[authHashBootstrap] enter", {
      hashPreview: maskLocationHashForLog(raw),
      hashLen: raw.length,
    });
  }

  if (!raw.includes("access_token")) {
    if (dbg) console.log("[authHashBootstrap] exit early (no access_token in hash)");
    return;
  }
  let params;
  try {
    params = new URLSearchParams(raw.startsWith("#") ? raw.slice(1) : raw);
  } catch {
    if (dbg) console.log("[authHashBootstrap] exit (URLSearchParams parse error)");
    return;
  }
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const type = params.get("type");
  if (!access_token || !refresh_token) {
    if (dbg) console.log("[authHashBootstrap] exit early (missing access_token or refresh_token in params)", { type });
    return;
  }
  if (dbg) console.log("[authHashBootstrap] setSession start", { type });
  try {
    const { error } = await client.auth.setSession({ access_token, refresh_token });
    if (error) {
      console.warn("[authHashBootstrap] setSession error:", error.message);
      if (dbg) console.log("[authHashBootstrap] exit after setSession error");
      return;
    }
  } catch (e) {
    console.warn("[authHashBootstrap]", e);
    if (dbg) console.log("[authHashBootstrap] exit after setSession throw");
    return;
  }
  if (dbg) console.log("[authHashBootstrap] setSession ok → replaceState");
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", pathname + (search || ""));
  if (dbg) {
    console.log("[authHashBootstrap] exit ok", {
      hashAfter: maskLocationHashForLog(window.location.hash),
    });
  }
}
