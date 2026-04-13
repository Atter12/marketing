/**
 * Logs de carrera initialize() vs consumeAuthHashIfPresent.
 * - Producción: ?hm_debug_auth=1 en la query, o localStorage.setItem('HM_DEBUG_AUTH','1') y recargá.
 * - Vite: además, si el hash parece handoff (#access_token), los logs se activan solos en esa carga.
 */
export function isAuthBootstrapDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("HM_DEBUG_AUTH") === "1") return true;
    if (sessionStorage.getItem("hm_debug_auth") === "1") return true;
    const q = new URLSearchParams(window.location.search).get("hm_debug_auth");
    if (q === "1") {
      sessionStorage.setItem("hm_debug_auth", "1");
      return true;
    }
    if (import.meta.env.DEV && window.location.hash.includes("access_token")) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Hash listo para consola sin exponer JWT. */
export function maskLocationHashForLog(raw) {
  if (!raw) return "(empty)";
  return String(raw)
    .replace(/access_token=[^&]+/gi, "access_token=(redacted)")
    .replace(/refresh_token=[^&]+/gi, "refresh_token=(redacted)")
    .slice(0, 160);
}
