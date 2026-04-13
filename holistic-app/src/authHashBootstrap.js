import { isAuthBootstrapDebugEnabled, maskLocationHashForLog } from "./authDebug.js";
import { getSupabaseAuthDebugMeta } from "./supabase.js";

/**
 * Handoff mismo-navegador (ej. hecom.club → marketing): fragmento tipo implicit grant
 * (#access_token=…&refresh_token=…). Debe ejecutarse después de createClient y antes de montar React,
 * para que localStorage tenga sesión antes de AuthGate. detectSessionInUrl está en false en supabase.js
 * para que GoTrue no compita leyendo el mismo # en initialize().
 */
export async function consumeAuthHashIfPresent(client) {
  if (typeof window === "undefined" || !client) return;
  const raw = window.location.hash || "";
  const pathname = window.location.pathname || "";
  const onCreditoPath = pathname === "/credito" || pathname.startsWith("/credito/");
  const dbg = isAuthBootstrapDebugEnabled();

  // Paso 1 (Hecom): confirmar que el hash llegó — sin imprimir tokens.
  if (onCreditoPath || raw.length > 0) {
    console.info("[authHashBootstrap] hash?", {
      pathname,
      hashLen: raw.length,
      hashStartsWithAccessToken: raw.startsWith("#access_token"),
      includesAccessTokenLiteral: raw.includes("access_token"),
      ...getSupabaseAuthDebugMeta(),
    });
  }

  if (dbg) {
    console.log("[authHashBootstrap] enter (verbose)", {
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

  // Paso 2: resultado setSession + getSession (crítico). Nunca loguear tokens.
  try {
    const { error } = await client.auth.setSession({ access_token, refresh_token });
    console.info("[authHashBootstrap] setSession", { ok: !error, message: error?.message ?? null });
    if (error) {
      if (dbg) console.log("[authHashBootstrap] exit after setSession error");
      return;
    }
    const { data: s } = await client.auth.getSession();
    console.info("[authHashBootstrap] getSession after setSession", { hasSession: !!s?.session });
  } catch (e) {
    console.warn("[authHashBootstrap] setSession throw:", e?.message || e);
    if (dbg) console.log("[authHashBootstrap] exit after setSession throw");
    return;
  }

  if (dbg) console.log("[authHashBootstrap] setSession ok → replaceState");
  const { search } = window.location;
  window.history.replaceState(null, "", pathname + (search || ""));
  if (dbg) {
    console.log("[authHashBootstrap] exit ok", {
      hashAfter: maskLocationHashForLog(window.location.hash),
    });
  }
}
